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

// ── Settings (in-memory, survives until server restarts) ──
let settings = {
    threshold: 30,
    pumpSpeed: 80,
    scheduleTime: "",
    scheduleDuration: 0
};

async function initDB() {
    db = await JSONFilePreset('garden.db.json', { readings: [] });
}

// ESP32 posts sensor data
app.post('/api/data', async (req, res) => {
    const { moisture, temp, humidity, pumpRunning } = req.body;
    const reading = {
        moisture, temp, humidity,
        pump: pumpRunning ? 1 : 0,
        ts: Date.now()
    };
    await db.update(({ readings }) => readings.push(reading));

    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(JSON.stringify(reading));
        }
    });

    res.json({ ok: true });
});

// ESP32 polls for command
app.get('/api/command', (req, res) => {
    res.json(pendingCommand ?? { startPump: false, stopPump: false });
    pendingCommand = null;
});

// Browser sends pump command
app.post('/api/command', (req, res) => {
    const { startPump, stopPump } = req.body;
    if (startPump) pendingCommand = { startPump: true,  stopPump: false };
    if (stopPump)  pendingCommand = { startPump: false, stopPump: true  };
    res.json({ queued: true });
});

// Browser sends pump command
app.post('/api/command', (req, res) => {
    pendingCommand = { startPump: true };
    res.json({ queued: true });
});

// Browser reads history
app.get('/api/data', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const rows = db.data.readings.slice(-limit).reverse();
    res.json(rows);
});

// Browser saves settings
app.post('/api/settings', (req, res) => {
    const { threshold, pumpSpeed, scheduleTime, scheduleDuration } = req.body;
    if (threshold !== undefined)        settings.threshold        = threshold;
    if (pumpSpeed !== undefined)        settings.pumpSpeed        = pumpSpeed;
    if (scheduleTime !== undefined)     settings.scheduleTime     = scheduleTime;
    if (scheduleDuration !== undefined) settings.scheduleDuration = scheduleDuration;
    console.log('Settings updated:', settings);
    res.json({ ok: true });
});

// ESP32 fetches settings
app.get('/api/settings', (req, res) => {
    res.json(settings);
});

wss.on('connection', (ws) => {
    console.log('Browser connected via WebSocket');
    ws.on('close', () => console.log('Browser disconnected'));
});

initDB().then(() => {
    server.listen(3000, () => console.log('Server running on http://localhost:3000'));
});
