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
            console.log('Message recu du serveur : ', evt.data);
            var raw = evt.data;
            var shown = false;
            // Essayer JSON {question: '...', joueurs: [...]}
            if (typeof raw === 'string' && raw.length && raw.charAt(0) === '{') {
                try {
                    var obj = JSON.parse(raw);
                    if (obj && typeof obj.question === 'string') {
                        document.getElementById('questionTexte').value = obj.question;
                        var res1 = document.getElementById('resultatTexte');
                        if (res1) res1.value = '';
                        shown = true;
                    }
                    if (obj && Array.isArray(obj.joueurs)) {
                        var zone = document.getElementById('resultats');
                        if (zone) {
                            zone.textContent = JSON.stringify(obj.joueurs);
                        }
                    }
                } catch (e) { /* ignore, fallback */ }
            }
            if (!shown) {
                // Fallback heuristique texte
                var data = String(raw || '');
                var t = data.trim();
                var estQuestion = (t.indexOf('=') !== -1) || /\?$/.test(t) || t.indexOf('Convertir en base 10:') === 0;
                if (estQuestion) {
                    document.getElementById('questionTexte').value = data;
                    var res2 = document.getElementById('resultatTexte');
                    if (res2) res2.value = '';
                } else {
                    var res3 = document.getElementById('resultatTexte');
                    if (res3) res3.value = data;
                }
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
