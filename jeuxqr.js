'use strict';

var WebSocket = require('ws');

class CQr {
    constructor() {
        this.question = '?';
        this.bonneReponse = 0;
        this.joueurs = new Array();
    }

    GetRandomInt(max) {
        return Math.floor(Math.random() * Math.floor(max));
    }

    NouvelleQuestion() {
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
        this.EnvoyerResultatDiff();
    }

    NouvelleQuestionBinaire() {
        var n = Math.floor(Math.random() * 256);
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
        if (brut.length && brut.charAt(0) === '{') {
            try {
                var mess = JSON.parse(brut);
                nom = (mess && mess.nom) ? String(mess.nom) : '';
                repStr = (mess && mess.reponse !== undefined && mess.reponse !== null) ? String(mess.reponse) : '';
                if (repStr.trim() !== '' && !Number.isNaN(parseInt(repStr.trim(), 10))) {
                    valeur = parseInt(repStr.trim(), 10);
                    aRepValide = true;
                }

                if (nom) {
                    var indexjoueur = this.joueurs.findIndex(function (j) { return j.nom === nom; });
                    if (indexjoueur === -1) {
                        this.joueurs.push({ nom: nom, score: 0, ws: wsClient });
                        this.question = 'Nouveau joueur ajouté ' + nom;
                        this.EnvoyerResultatDiff();
                        if (!aRepValide) {
                            setTimeout(function () { this.NouvelleQuestion(); }.bind(this), 3000);
                            return;
                        }
                    } else {
                        this.joueurs[indexjoueur].ws = wsClient;
                        if (!aRepValide) {
                            this.EnvoyerEtatA(wsClient);
                            return;
                        }
                    }
                }
            } catch (e) {
                valeur = parseInt(brut.trim(), 10);
            }
        } else {
            valeur = parseInt(brut.trim(), 10);
        }

        if (!Number.isNaN(valeur) && valeur === this.bonneReponse) {
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
            setTimeout(function () { this.NouvelleQuestion(); }.bind(this), 3000);
        }
    }

    EnvoyerResultatDiff() {
        var joueursSimple = new Array();
        this.joueurs.forEach(function each(joueur) {
            joueursSimple.push({ nom: joueur.nom, score: joueur.score });
        });
        var messagePourLesClients = {
            joueurs: joueursSimple,
            question: this.question
        };
        var payload = JSON.stringify(messagePourLesClients);
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

    Deconnecter(ws) {
        var indexjoueur = this.joueurs.findIndex(function (j) { return j.ws === ws; });
        if (indexjoueur != -1) {
            this.joueurs[indexjoueur].ws = undefined;
        }
    }
}

module.exports = CQr;
