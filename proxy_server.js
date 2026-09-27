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

app.post('/api/deriv', async (req, res) => {
    const payload = req.body;
    try {
        const result = await callDerivAPI(payload);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

function callDerivAPI(payload, host = 'api.deriv.com', path = '/websockets/v3', depth = 0) {
    if (depth > 5) return Promise.reject(new Error('Trop de redirections'));
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ ...payload, app_id: APP_ID, req_id: Date.now() });
        const options = {
            hostname: host,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        };
        const req = https.request(options, (resp) => {
            // Gérer les redirections (301, 302, 307, 308)
            if ([301, 302, 307, 308].includes(resp.statusCode) && resp.headers.location) {
                try {
                    const newUrl = new URL(resp.headers.location);
                    resolve(callDerivAPI(payload, newUrl.hostname, newUrl.pathname + newUrl.search, depth + 1));
                } catch (e) {
                    reject(new Error('Redirection invalide : ' + resp.headers.location));
                }
                return;
            }
            let data = '';
            resp.on('data', (chunk) => data += chunk);
            resp.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.error) reject(new Error(json.error.message));
                    else resolve(json);
                } catch (e) {
                    reject(new Error('Réponse non-JSON : ' + data.slice(0, 150)));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

app.listen(PORT, '0.0.0.0', () => console.log('Proxy actif sur port ' + PORT));
