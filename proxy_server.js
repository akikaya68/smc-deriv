const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'Deriv Proxy', timestamp: Date.now() });
});

app.post('/api/deriv', async (req, res) => {
    const payload = req.body;
    try {
        const result = await sendToDeriv(payload);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

function sendToDeriv(payload) {
    return new Promise((resolve, reject) => {
        const url = 'wss://ws.derivws.com/websockets/v3?app_id=1';
        const ws = new WebSocket(url);
        let settled = false;
        const timeout = setTimeout(() => {
            if (!settled) { settled = true; ws.close(); reject(new Error('Timeout Deriv')); }
        }, 25000);

        ws.on('open', () => ws.send(JSON.stringify(payload)));

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (!msg.msg_type && !msg.error) return;
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                ws.close();
                if (msg.error) reject(new Error(msg.error.message));
                else resolve(msg);
            } catch (e) {
                if (!settled) { settled = true; clearTimeout(timeout); ws.close(); reject(e); }
            }
        });

        ws.on('error', (err) => {
            if (!settled) { settled = true; clearTimeout(timeout); reject(err); }
        });

        ws.on('close', () => {
            if (!settled) { settled = true; clearTimeout(timeout); reject(new Error('Fermé avant réponse')); }
        });
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Proxy Deriv actif sur port ' + PORT));
