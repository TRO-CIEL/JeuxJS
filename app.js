'use strict';

/* *********************** Serveur Web *************************** */

// Importer le module Express
var express = require('express');

var exp = express();

var port = 80;

exp.use(express.static(__dirname + '/www'));

// Réponse pour la racine "/"
exp.get('/', function (req, res) {
    console.log('Réponse envoyée à un client');
    res.sendFile(__dirname + '/www/index.html');
});

// Gestion des erreurs
exp.use(function (err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Erreur serveur Express');
});

// Lancer le serveur
exp.listen(port, function () {
    console.log('Serveur en ecoute sur le port ' + port);
});
