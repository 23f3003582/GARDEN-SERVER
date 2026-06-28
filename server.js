const express = require('express');
const cors = require('cors');
const path = require('path');
const { JSONFilePreset } = require('lowdb/node');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

let db;
let pendingCommand = null;

async function initDB() {
    db = await JSONFilePreset('garden.db.json', { readings: [] });
}

// ESP32 posts sensor data
app.post('/api/data', async (req, res) => {
    const { moisture, temp, humidity, pumpRunning } = req.body;
    await db.update(({ readings }) => readings.push({
        moisture, temp, humidity,
        pump: pumpRunning ? 1 : 0,
        ts: Date.now()
    }));
    res.json({ ok: true });
});

// ESP32 polls for command
app.get('/api/command', (req, res) => {
    res.json(pendingCommand ?? { startPump: false });
    pendingCommand = null;
});

// Browser sends command
app.post('/api/command', (req, res) => {
    pendingCommand = { startPump: true };
    res.json({ queued: true });
});

// Browser reads data
app.get('/api/data', (req, res) => {
    const rows = db.data.readings.slice(-100).reverse();
    res.json(rows);
});

initDB().then(() => {
    app.listen(3000, () => console.log('Server running on http://localhost:3000'));
});