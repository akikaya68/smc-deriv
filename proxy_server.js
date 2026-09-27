const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const APP_ID = '34vKV1G0NztPGAGnedRWK';

// Endpoints Deriv à essayer dans l'ordre
const DERIV_ENDPOINTS = [
    'wss://ws.derivws.com/websockets/v3?app_id=' + APP_ID + '&l=EN&brand=deriv&v=3',
    'wss://ws.binaryws.com/websockets/v3?app_id=' + APP_ID + '&l=EN&brand=deriv',
    'wss://ws.derivws.com/websockets/v3?app_id=' + APP_ID,
    'wss://ws.binaryws.com/websockets/v3?app_id=' + APP_ID
];

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'Deriv Proxy', timestamp: Date.now(), app_id: APP_ID });
});

app.post('/api/deriv', async (req, res) => {
    const payload = req.body;
    let lastError = null;

    // Essayer chaque endpoint l'un après l'autre
    for (const url of DERIV_ENDPOINTS) {
        try {
            const result = await sendToDeriv(url, payload);
            res.json(result);
            return;
        } catch (e) {
            lastError = e;
            console.log('Endpoint échoué: ' + url.slice(0, 60) + '... — ' + e.message);
        }
    }

    res.status(500).json({ error: lastError ? lastError.message : 'Tous les endpoints Deriv ont échoué' });
});

function sendToDeriv(url, payload) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://app.deriv.com'
            }
        });
        let settled = false;
        const timeout = setTimeout(() => {
            if (!settled) { settled = true; try { ws.close(); } catch (e) {} reject(new Error('Timeout')); }
        }, 20000);

        ws.on('open', () => {
            ws.send(JSON.stringify(payload));
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (!msg.msg_type && !msg.error) return;
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                try { ws.close(); } catch (e) {}
                if (msg.error) reject(new Error(msg.error.message));
                else resolve(msg);
            } catch (e) {
                if (!settled) { settled = true; clearTimeout(timeout); try { ws.close(); } catch (ee) {} reject(e); }
            }
        });

        ws.on('error', (err) => {
            if (!settled) { settled = true; clearTimeout(timeout); reject(err); }
        });

        ws.on('close', (code) => {
            if (!settled) { settled = true; clearTimeout(timeout); reject(new Error('Fermé (code ' + code + ')')); }
        });
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Proxy Deriv actif sur port ' + PORT + ' — App ID: ' + APP_ID));
