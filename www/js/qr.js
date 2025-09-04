console.log('qr.js charge');

// Host du serveur = celui qui a servi la page
var ipServeur = location.hostname;
// Schema selon http/https
var wsScheme = (location.protocol === 'https:' ? 'wss://' : 'ws://');
// Pour cette etape, on change l'URL vers /qr
var wsBase = wsScheme + ipServeur + ':80';
var wsUrl = wsBase + '/qr';
var ws;

window.onload = function () {
    // Laisser le DOM se stabiliser
    setTimeout(function () {
        if (TesterLaCompatibilite()) {
            ConnexionAuServeurWebsocket();
        }
        ControleIHM();
    }, 300);
};

function TesterLaCompatibilite() {
    if (!('WebSocket' in window)) {
        window.alert('WebSocket non supporte par le navigateur');
        return false;
    }
    return true;
}

function ConnexionAuServeurWebsocket() {
    try {
        console.log('Tentative de connexion a ' + wsUrl);
        ws = new WebSocket(wsUrl);

        ws.onopen = function () {
            console.log('WebSocket ouverte avec ' + wsUrl);
            // Pour Q/R, on active le bouton quand la WS est ouverte
            document.getElementById('Valider').disabled = false;
        };

        ws.onmessage = function (evt) {
            // Pour l'instant, on suppose que le serveur envoie la question en clair
            console.log('Message recu du serveur : ' + evt.data);
            document.getElementById('questionTexte').value = evt.data;
        };

        ws.onclose = function (event) {
            console.warn('WebSocket fermee - Code:', event.code, 'Raison:', event.reason);
            document.getElementById('Valider').disabled = true;
        };

        ws.onerror = function (error) {
            console.error('Erreur WebSocket : ', error);
            console.error('Verifiez que le serveur est demarre et accessible sur ' + wsBase);
        };

    } catch (err) {
        console.error('Impossible de creer WebSocket : ', err);
    }
}

function ControleIHM() {
    document.getElementById('Valider').disabled = true;
    document.getElementById('Valider').onclick = BPValider;
}

function BPValider() {
    var reponse = document.getElementById('reponseTexte').value;
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(reponse);
        console.log('Reponse envoyee : ' + reponse);
    } else {
        console.warn('WebSocket pas encore prete (etat = ' + (ws ? ws.readyState : 'inconnue') + ')');
    }
}
