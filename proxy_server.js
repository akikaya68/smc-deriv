const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

// Nouveau domaine Hugging Face (remplace l'ancien api-inference.huggingface.co)
const HF_HOST = 'router.huggingface.co';
const HF_PATH = '/hf-inference/models/meta-llama/Meta-Llama-3-8B-Instruct';

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'HF Proxy v2', timestamp: Date.now(), hf_host: HF_HOST });
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
            hostname: HF_HOST,
            path: HF_PATH,
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
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
                    if (json.error) reject(new Error(json.error));
                    else resolve(json);
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

app.listen(PORT, '0.0.0.0', () => console.log('HF Proxy actif sur port ' + PORT + ' — HF host: ' + HF_HOST));
