const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'HF Proxy', timestamp: Date.now() });
});

// Relaie les requêtes vers Hugging Face
app.post('/api/hf', async (req, res) => {
    const { token, payload } = req.body;
    if (!token) return res.status(400).json({ error: 'Token manquant' });
    
    try {
        const data = await callHuggingFace(token, payload);
        res.json(data);
    } catch (e) {
        console.error('HF error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

function callHuggingFace(token, payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const options = {
            hostname: 'api-inference.huggingface.co',
            path: '/models/meta-llama/Meta-Llama-3-8B-Instruct',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };
        const req = https.request(options, (resp) => {
            let data = '';
            resp.on('data', (chunk) => data += chunk);
            resp.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(new Error('Réponse invalide : ' + data.slice(0, 200)));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

app.listen(PORT, '0.0.0.0', () => console.log('HF Proxy actif sur port ' + PORT));
