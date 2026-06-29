const express = require('express');
const cors = require('cors');
const path = require('path');
const { WebSocketServer } = require('ws');
const { JSONFilePreset } = require('lowdb/node');
const http = require('http');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let db;
let pendingCommand = null;

async function initDB() {
    db = await JSONFilePreset('garden.db.json', { readings: [] });
}

// ESP32 posts sensor data via HTTP
app.post('/api/data', async (req, res) => {
    const { moisture, temp, humidity, pumpRunning } = req.body;
    const reading = {
        moisture, temp, humidity,
        pump: pumpRunning ? 1 : 0,
        ts: Date.now()
    };
    await db.update(({ readings }) => readings.push(reading));

    // push to all browser WebSocket clients instantly
    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(JSON.stringify(reading));
        }
    });

    res.json({ ok: true });
});

// ESP32 polls for command
app.get('/api/command', (req, res) => {
    res.json(pendingCommand ?? { startPump: false });
    pendingCommand = null;
});

// Browser sends pump command via HTTP
app.post('/api/command', (req, res) => {
    pendingCommand = { startPump: true };
    res.json({ queued: true });
});

// Browser reads history
app.get('/api/data', (req, res) => {
    const rows = db.data.readings.slice(-100).reverse();
    res.json(rows);
});

// WebSocket connection from browser
wss.on('connection', (ws) => {
    console.log('Browser connected via WebSocket');
    ws.on('close', () => console.log('Browser disconnected'));
});

initDB().then(() => {
    server.listen(3000, () => console.log('Server running on http://localhost:3000'));
});