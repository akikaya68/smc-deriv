const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const APP_ID = '34vKV1G0NztPGAGnedRWK';
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'Deriv Proxy WS', timestamp: Date.now(), app_id: APP_ID });
});

app.post('/api/deriv', async (req, res) => {
    const payload = req.body;
    try {
        const result = await sendViaWSProxy(payload);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Essaie plusieurs méthodes pour joindre Deriv
function sendViaWSProxy(payload) {
    return new Promise((resolve, reject) => {
        const url = 'wss://ws.derivws.com/websockets/v3?app_id=' + APP_ID + '&l=EN';
        
        const ws = new WebSocket(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://app.deriv.com',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'Upgrade',
                'Upgrade': 'websocket'
            },
            // Bypass via proxy HTTPS de contournement (Cloudflare-friendly)
            agent: new https.Agent({
                keepAlive: true,
                family: 4,  // Force IPv4 (certains blocages sont sur IPv6)
                rejectUnauthorized: false
            })
        });
        
        let settled = false;
        const timeout = setTimeout(() => {
            if (!settled) { settled = true; try { ws.close(); } catch (e) {} reject(new Error('Timeout')); }
        }, 15000);
        
        ws.on('open', () => ws.send(JSON.stringify(payload)));
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

app.listen(PORT, '0.0.0.0', () => console.log('Proxy actif sur port ' + PORT));
