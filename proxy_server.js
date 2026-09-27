const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const APP_ID = '34vKV1G0NztPGAGnedRWK';
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'Deriv Proxy REST', timestamp: Date.now(), app_id: APP_ID });
});

// Endpoint générique qui relaie une requête vers l'API REST de Deriv
app.post('/api/deriv', async (req, res) => {
    const payload = req.body;
    try {
        const result = await callDerivAPI(payload);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

function callDerivAPI(payload) {
    return new Promise((resolve, reject) => {
        // Requête vers l'API REST de Deriv
        const body = JSON.stringify({
            ...payload,
            app_id: APP_ID,
            req_id: Date.now()
        });

        const options = {
            hostname: 'api.deriv.com',
            path: '/websockets/v3',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        const req = https.request(options, (resp) => {
            let data = '';
            resp.on('data', (chunk) => data += chunk);
            resp.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.error) reject(new Error(json.error.message));
                    else resolve(json);
                } catch (e) {
                    reject(new Error('Réponse invalide: ' + data.slice(0, 100)));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

app.listen(PORT, '0.0.0.0', () => console.log('Proxy actif sur port ' + PORT));
