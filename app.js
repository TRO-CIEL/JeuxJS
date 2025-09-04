'use strict';

/* *********************** Serveur Web *************************** */

// Importer le module Express
var express = require('express');

var exp = express();

// Port HTTP (80 necessite droits admin sous Windows)
var port = 80;

// Servir les fichiers statiques du dossier www/
exp.use(express.static(__dirname + '/www'));

// Réponse pour la racine "/"
// Page d'accueil
exp.get('/', function (req, res) {
    console.log('Reponse envoyee a un client');
    res.sendFile(__dirname + '/www/index.html');
});

// Endpoint simple pour tests de sante
exp.get('/health', function (req, res) {
    res.status(200).send('OK');
});

/* *************** serveur WebSocket express ********************* */
const expressWs = require('express-ws')(exp);

// Connexion des clients a la WebSocket /echo et evenements associes
exp.ws('/echo', function (ws, req) {
    console.log('Connection WebSocket %s sur le port %s',
        req.connection.remoteAddress, req.connection.remotePort);
    ws.on('message', function (message) {
        console.log('De %s %s, message :%s', req.connection.remoteAddress,
            req.connection.remotePort, message);
        ws.send(message);
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