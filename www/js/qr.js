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
            console.log('Message recu du serveur : ' + evt.data);
            // Si le message ressemble a une question (contient '=' ou se termine par '?'),
            // on l'affiche dans le champ question, sinon c'est un feedback/resultat.
            var data = String(evt.data || '');
            var t = data.trim();
            var estQuestion = (t.indexOf('=') !== -1) || /\?$/.test(t) || t.indexOf('Convertir en base 10:') === 0;
            if (estQuestion) {
                document.getElementById('questionTexte').value = data;
                // effacer un ancien resultat pour clarte
                var res = document.getElementById('resultatTexte');
                if (res) res.value = '';
            } else {
                var res = document.getElementById('resultatTexte');
                if (res) res.value = data;
            }
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
    var reponseInput = document.getElementById('reponseTexte');
    var reponse = reponseInput.value;
    var nom = (document.getElementById('nom') && document.getElementById('nom').value) || '';
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            var payload = { nom: nom, reponse: reponse };
            ws.send(JSON.stringify(payload));
            console.log('Payload JSON envoye : ', payload);
        } catch (e) {
            // Fallback improbable
            ws.send(reponse);
            console.log('Reponse envoyee (fallback texte) : ' + reponse);
        }
        // Option: vider le champ reponse apres envoi
        reponseInput.value = '';
    } else {
        console.warn('WebSocket pas encore prete (etat = ' + (ws ? ws.readyState : 'inconnue') + ')');
    }
}
