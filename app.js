'use strict';

/* *********************** Serveur Web *************************** */

// Importer le module Express
var express = require('express');

var exp = express();

// Port HTTP (80 necessite droits admin sous Windows)
var port = 80;

// Servir les fichiers statiques du dossier www/
exp.use(express.static(__dirname + '/www'));

// Reponse pour la racine "/" -> sert la page de chat texte
exp.get('/', function (req, res) {
    console.log('Reponse envoyee a un client');
    res.sendFile(__dirname + '/www/textchat.html');
});

// Endpoint simple pour tests de sante
exp.get('/health', function (req, res) {
    res.status(200).send('OK');
});

/* *************** serveur WebSocket express ********************* */
const expressWs = require('express-ws')(exp);
// Outil de broadcast sur le endpoint /echo
var aWss = expressWs.getWss('/echo');
var WebSocket = require('ws');
aWss.broadcast = function broadcast(data) {
    console.log('Broadcast aux clients navigateur : %s', data);
    aWss.clients.forEach(function each(client) {
        if (client.readyState == WebSocket.OPEN) {
            client.send(data, function ack(error) {
                if (error) {
                    console.log('ERREUR websocket broadcast : %s', error.toString());
                }
            });
        }
    });
};

// Connexion des clients a la WebSocket /echo et evenements associes
exp.ws('/echo', function (ws, req) {
    console.log('Connection WebSocket %s sur le port %s',
        req.connection.remoteAddress, req.connection.remotePort);

    ws.on('message', function (message) {
        console.log('De %s %s, message :%s', req.connection.remoteAddress,
            req.connection.remotePort, message);

        // Prefixe avec IP et port du client pour diffusion
        try {
            var ip = (ws._socket && ws._socket._peername && ws._socket._peername.address) || req.connection.remoteAddress;
            var prt = (ws._socket && ws._socket._peername && ws._socket._peername.port) || req.connection.remotePort;
        } catch (e) {
            // si indisponible, garder le message tel quel
        }

        // Envoi a tous les clients connectes
        aWss.broadcast(message);
    });

    ws.on('close', function (reasonCode, description) {
        console.log('Deconnexion WebSocket %s sur le port %s',
            req.connection.remoteAddress, req.connection.remotePort);
    });
});

// Middleware de gestion des erreurs Express
exp.use(function (err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Erreur serveur Express');
});

// Lancer le serveur (liaison sur l'adresse IP du poste)
exp.listen(port, '172.17.50.138', function () {
    console.log('Serveur en ecoute sur http://172.17.50.138:' + port);
});

/* *************** Classe CQr et serveur WebSocket /qr ********************* */
class CQr {
    constructor() {
        this.question = '?';
        this.bonneReponse = 0;
        this.broadcaster = null; // sera defini apres creation de aWssQr
        this.joueurs = new Array();
    }

    setBroadcaster(b) { this.broadcaster = b; }

    GetRandomInt(max) {
        return Math.floor(Math.random() * Math.floor(max));
    }

    NouvelleQuestion() {
        // Aleatoire: multiplication ou binaire
        if (Math.random() < 0.5) {
            var x = this.GetRandomInt(11);
            var y = this.GetRandomInt(11);
            this.question = x + '*' + y + ' = ?';
            this.bonneReponse = x * y;
        } else {
            var qb = this.NouvelleQuestionBinaire();
            this.question = qb.question;
            this.bonneReponse = qb.bonneReponse;
        }
        // Diffuser via la methode centralisee
        this.EnvoyerResultatDiff();
    }

    NouvelleQuestionBinaire() {
        var n = Math.floor(Math.random() * 256); // 0..255
        var binaire = '';
        for (var i = 7; i >= 0; i--) {
            var bit = (n >> i) & 1;
            binaire += bit ? '1' : '0';
        }
        return { question: 'Convertir en base 10: ' + binaire, bonneReponse: n };
    }

    TraiterReponse(wsClient, message) {
        var brut = (message !== undefined && message !== null) ? String(message) : '';
        var nom = '';
        var valeur = NaN;
        var repStr = '';
        var aRepValide = false;
        // Essayer de parser JSON {nom, reponse}
        if (brut.length && brut.charAt(0) === '{') {
            try {
                var mess = JSON.parse(brut);
                nom = (mess && mess.nom) ? String(mess.nom) : '';
                repStr = (mess && mess.reponse !== undefined && mess.reponse !== null) ? String(mess.reponse) : '';
                if (repStr.trim() !== '' && !Number.isNaN(parseInt(repStr.trim(), 10))) {
                    valeur = parseInt(repStr.trim(), 10);
                    aRepValide = true;
                }

                // Gestion des joueurs selon le pseudo-code
                if (nom) {
                    var indexjoueur = this.joueurs.findIndex(function (j) { return j.nom === nom; });
                    if (indexjoueur === -1) {
                        // Ajouter nouveau joueur
                        this.joueurs.push({ nom: nom, score: 0, ws: wsClient });
                        // Nouveau joueur sans reponse numerique -> annoncer et sortir
                        this.question = 'Nouveau joueur ajouté ' + nom;
                        this.EnvoyerResultatDiff();
                        if (!aRepValide) {
                            // Afficher l'annonce 3s puis poser une question pour demarrer le jeu
                            setTimeout(function () { this.NouvelleQuestion(); }.bind(this), 3000);
                            return; // ne pas traiter comme mauvaise reponse
                        }
                    } else {
                        // Mettre a jour la reference WS au cas ou
                        this.joueurs[indexjoueur].ws = wsClient;
                        // Si joueur existant mais pas de reponse valide (ex: envoi du nom seul),
                        // renvoyer simplement l'etat sans marquer faux
                        if (!aRepValide) {
                            this.EnvoyerEtatA(wsClient);
                            return;
                        }
                    }
                }
            } catch (e) {
                // fallback texte
                valeur = parseInt(brut.trim(), 10);
            }
        } else {
            // message texte simple
            valeur = parseInt(brut.trim(), 10);
        }

        console.log('Reponse client nom:%s valeur:%s (brut:%s)', nom, valeur, brut);

        if (!Number.isNaN(valeur) && valeur === this.bonneReponse) {
            // Bonne reponse -> incrementer score si joueur connu
            if (nom) {
                var idx = this.joueurs.findIndex(function (j) { return j.nom === nom; });
                if (idx !== -1) {
                    this.joueurs[idx].score += 1;
                }
            }
            this.question = 'Bonne reponse de ' + (nom || 'inconnu');
            this.EnvoyerResultatDiff();
            setTimeout(function () { this.NouvelleQuestion(); }.bind(this), 3000);
        } else {
            this.question = 'Mauvaise reponse de ' + (nom || 'inconnu');
            this.EnvoyerResultatDiff();
            // En option selon l'enonce: poser une nouvelle question 3s apres un faux
            setTimeout(function () { this.NouvelleQuestion(); }.bind(this), 3000);
        }
    }

    EnvoyerResultatDiff() {
        // Recopie des joueurs sans l'objet WebSocket
        var joueursSimple = new Array();
        this.joueurs.forEach(function each(joueur) {
            joueursSimple.push({ nom: joueur.nom, score: joueur.score });
        });
        // Message a envoyer
        var messagePourLesClients = {
            joueurs: joueursSimple,
            question: this.question
        };
        var payload = JSON.stringify(messagePourLesClients);
        // Diffuser a chaque joueur via sa WS
        this.joueurs.forEach(function each(joueur) {
            if (joueur.ws !== undefined && joueur.ws && joueur.ws.readyState === WebSocket.OPEN) {
                joueur.ws.send(payload, function ack(error) {
                    try {
                        console.log(' - %s-%s', joueur.ws._socket._peername.address, joueur.ws._socket._peername.port);
                    } catch (e) { }
                    if (error) {
                        console.log('ERREUR websocket broadcast : %s', error.toString());
                    }
                });
            }
        });
    }

    // Envoyer l'etat courant (question + scores) a un seul client ws
    EnvoyerEtatA(ws) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        var joueursSimple = new Array();
        this.joueurs.forEach(function each(joueur) {
            joueursSimple.push({ nom: joueur.nom, score: joueur.score });
        });
        var messagePourLeClient = {
            joueurs: joueursSimple,
            question: this.question
        };
        try {
            ws.send(JSON.stringify(messagePourLeClient));
        } catch (e) {
            console.log('Erreur envoi etat au client: ' + e.toString());
        }
    }
}

var jeuxQr = new CQr();

// Broadcaster pour /qr
var aWssQr = expressWs.getWss('/qr');
// Lier le broadcaster a l'objet de jeu
jeuxQr.setBroadcaster(aWssQr);

// Connexion des clients a la WebSocket /qr et evenements associes
exp.ws('/qr', function (ws, req) {
    console.log('Connection WebSocket %s sur le port %s',
        req.connection.remoteAddress, req.connection.remotePort);

    // Ne pas generer une nouvelle question pour chaque connexion.
    // Si aucune question n'est definie, en creer une; sinon, envoyer l'etat courant au nouveau client uniquement.
    if (!jeuxQr.question || jeuxQr.question === '?') {
        jeuxQr.NouvelleQuestion();
    } else {
        jeuxQr.EnvoyerEtatA(ws);
    }

    // Option 1: fonction intermediaire
    ws.on('message', function TMessage(message) {
        jeuxQr.TraiterReponse(ws, message);
    });
    // Option 2 (a tester): lier this de la methode a l'objet
    // ws.on('message', jeuxQr.TraiterReponse.bind(jeuxQr)); // dans ce cas, il faudra adapter la methode pour recuperer ws autrement

    ws.on('close', function (reasonCode, description) {
        console.log('Deconnexion WebSocket %s sur le port %s',
            req.connection.remoteAddress, req.connection.remotePort);
    });
});