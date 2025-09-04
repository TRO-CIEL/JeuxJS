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
            message = ip + prt + ' : ' + message;
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

/* *************** WebSocket Q/R sur /qr ********************* */
// Variables globales pour Q/R
var question = '?';
var bonneReponse = 0;

// Broadcaster pour /qr
var aWssQr = expressWs.getWss('/qr');

// Connexion des clients a la WebSocket /qr et evenements associes
exp.ws('/qr', function (ws, req) {
    console.log('Connection WebSocket %s sur le port %s',
        req.connection.remoteAddress, req.connection.remotePort);

    // Envoie une premiere question a la connexion d'un client
    NouvelleQuestion();

    ws.on('message', TraiterReponse);

    ws.on('close', function (reasonCode, description) {
        console.log('Deconnexion WebSocket %s sur le port %s',
            req.connection.remoteAddress, req.connection.remotePort);
    });

    function TraiterReponse(message) {
        var brut = (message !== undefined && message !== null) ? String(message) : '';
        var nettoye = brut.trim();
        var valeur = parseInt(nettoye, 10);
        console.log('De %s %s, message :%s (nettoye:%s, valeur:%s)', req.connection.remoteAddress,
            req.connection.remotePort, brut, nettoye, valeur);
        if (!Number.isNaN(valeur) && valeur === bonneReponse) {
            // Confirmer au client qui a repondu
            try { ws.send('Bonne reponse'); } catch (e) {}
            // Attendre 3 secondes puis poser une nouvelle question a tout le monde
            setTimeout(function(){
                NouvelleQuestion();
            }, 3000);
        } else {
            // Indiquer que la reponse est incorrecte
            try { ws.send('Mauvaise reponse'); } catch (e) {}
        }
    }

    function NouvelleQuestion() {
        var x = GetRandomInt(11);
        var y = GetRandomInt(11);
        question = x + '*' + y + ' = ?';
        bonneReponse = x * y;
        // Diffuser la question a tous les clients connectes sur /qr
        aWssQr.clients.forEach(function each(client) {
            if (client.readyState == WebSocket.OPEN) {
                client.send(question);
            }
        });
    }

    function GetRandomInt(max) {
        return Math.floor(Math.random() * Math.floor(max));
    }
});