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
        jeuxQr.Deconnecter(ws);
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

/* *************** Serveur WebSocket /qr ********************* */

var Cjeuxqr = require('./jeuxqr.js'); // instanciation du jeux QR
var jeuxQr = new Cjeuxqr();

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
