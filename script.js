const API = "https://garden-server-j643.onrender.com";
const WS  = "wss://garden-server-j643.onrender.com";

// ── DOM refs ──
const statusDot     = document.getElementById('statusDot');
const statusText    = document.getElementById('statusText');
const lastUpdated   = document.getElementById('lastUpdated');
const tempValue     = document.getElementById('tempValue');
const humidityValue = document.getElementById('humidityValue');
const moistureValue = document.getElementById('moistureValue');
const moistureBar   = document.getElementById('moistureBar');
const pumpStatus    = document.getElementById('pumpStatus');
const btnOn         = document.getElementById('btnOn');
const btnOff        = document.getElementById('btnOff');

// ── Update UI with sensor data ──
function updateUI(d) {
    tempValue.innerHTML     = `${parseFloat(d.temp).toFixed(1)}<span class="unit">°C</span>`;
    humidityValue.innerHTML = `${d.humidity}<span class="unit">%</span>`;
    const m = d.moisture ?? 0;
    moistureValue.innerHTML = `${m}<span class="unit">%</span>`;
    moistureBar.style.width = `${m}%`;
    const isOn = d.pump === 1 || d.pumpRunning === true;
    setPumpUI(isOn);
    lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    setOnline(true);
}

function setPumpUI(isOn) {
    if (isOn) {
        btnOn.classList.add('active');
        btnOff.classList.remove('active');
        pumpStatus.textContent   = 'Currently: ON';
        pumpStatus.style.color   = 'var(--accent-green)';
    } else {
        btnOff.classList.add('active');
        btnOn.classList.remove('active');
        pumpStatus.textContent   = 'Currently: OFF';
        pumpStatus.style.color   = 'var(--text-secondary)';
    }
}

function setOnline(online) {
    if (online) {
        statusDot.className    = 'status-dot online';
        statusText.textContent = 'ESP32 Connected';
    } else {
        statusDot.className    = 'status-dot offline';
        statusText.textContent = 'Disconnected';
    }
}

// ── WebSocket ──
let ws;

function connectWS() {
    ws = new WebSocket(WS);
    ws.onopen    = () => { console.log('WebSocket connected'); setOnline(true); };
    ws.onmessage = (event) => { updateUI(JSON.parse(event.data)); };
    ws.onclose   = () => { setOnline(false); setTimeout(connectWS, 3000); };
    ws.onerror   = () => { ws.close(); };
}

// ── Load last reading on page open ──
async function loadLastReading() {
    try {
        const data = await fetch(API + "/api/data").then(r => r.json());
        if (data && data.length > 0) updateUI(data[0]);
    } catch (e) {
        console.log('Could not load initial data:', e);
    }
}

// ── Pump toggle ──
async function togglePump(state) {
    if (state === 'on') {
        try {
            await fetch(API + "/api/command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startPump: true })
            });
            showToast('💧 Pump ON command sent!');
            setPumpUI(true);
        } catch (e) {
            showToast('❌ Failed to send command');
        }
    } else {
        setPumpUI(false);
        showToast('Pump OFF (auto-control active)');
    }
}

// ── Sliders — POST to server ──
async function updateSpeed(value) {
    document.getElementById('speedValue').textContent = value + '%';
    await fetch(API + "/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pumpSpeed: parseInt(value) })
    });
}

async function updateThreshold(value) {
    document.getElementById('thresholdValue').textContent = value + '%';
    await fetch(API + "/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold: parseInt(value) })
    });
}

// ── Schedule — POST to server ──
async function saveSchedule() {
    const time     = document.getElementById('startTime').value;
    const duration = parseInt(document.getElementById('duration').value);
    await fetch(API + "/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleTime: time, scheduleDuration: duration })
    });
    showToast(`📅 Schedule saved: ${time} for ${duration} min`);
}

// ── Load settings from server on page open ──
async function loadSettings() {
    try {
        const s = await fetch(API + "/api/settings").then(r => r.json());
        if (s.threshold) {
            document.getElementById('moistureThreshold').value  = s.threshold;
            document.getElementById('thresholdValue').textContent = s.threshold + '%';
        }
        if (s.pumpSpeed) {
            document.getElementById('pumpSpeed').value          = s.pumpSpeed;
            document.getElementById('speedValue').textContent   = s.pumpSpeed + '%';
        }
        if (s.scheduleTime)     document.getElementById('startTime').value = s.scheduleTime;
        if (s.scheduleDuration) document.getElementById('duration').value  = s.scheduleDuration;
    } catch (e) {
        console.log('Could not load settings:', e);
    }
}

// ── Toast ──
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Init ──
loadLastReading();
connectWS();
loadSettings();  // loads settings from server, not localStorage