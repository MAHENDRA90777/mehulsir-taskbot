require('dotenv').config();
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const express = require('express');
const twilio = require('twilio');

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TASKS_FILE = path.join(__dirname, 'tasks.json');

// ── HELPERS ──────────────────────────────────────────────────────────────────

function loadTasks() {
    return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
}

function saveTasks(tasks) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 4), 'utf8');
}

function getNow() {
    const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    return {
        hours: ist.getHours(),
        minutes: ist.getMinutes(),
        dayName: DAYS[ist.getDay()],
        date: ist.getDate(),
        timeStr: `${String(ist.getHours()).padStart(2, '0')}:${String(ist.getMinutes()).padStart(2, '0')}`
    };
}

function getTasksDueNow() {
    const tasks = loadTasks();
    const now = getNow();
    const due = [];

    for (const task of tasks) {
        if (task.time !== now.timeStr) continue;
        if (task.type === 'daily') {
            due.push(task);
        } else if (task.type === 'weekly' && task.dueDay === now.dayName) {
            due.push(task);
        } else if (task.type === 'monthly' && String(task.dueDate) === String(now.date)) {
            due.push(task);
        }
    }
    return due;
}

function buildMessage(tasks) {
  const now = getNow();
  const greet = now.hours < 12 ? 'Good morning' : now.hours < 17 ? 'Good afternoon' : 'Good evening';
  const lines = tasks.map(t => {
    const icon = t.type === 'monthly' ? '💳' : t.type === 'weekly' ? '📅' : '📌';
    const tag = t.type !== 'daily' ? ' [' + t.type + ']' : '';
    const note = t.note ? '\n    ' + t.note : '';
    return icon + ' ' + t.name + tag + note;
  });
  return '🔔 Reminder\n' + greet + ' Sir!\n\n' + lines.join('\n\n') + '\n\nTap done once completed.';
}

async function sendWhatsApp(message) {
  try {
    const msg = await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: process.env.SIR_WHATSAPP,
      body: message
    });
    console.log('✅ WhatsApp sent! SID:', msg.sid);
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
}

// ── CRON JOB ─────────────────────────────────────────────────────────────────

// Runs every minute
cron.schedule('* * * * *', async () => {
    const due = getTasksDueNow();
    if (due.length === 0) return;
    console.log(`⏰ ${due.length} task(s) due:`, due.map(t => t.name));
    await sendWhatsApp(buildMessage(due));
});

// ── EXPRESS WEB SERVER ───────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET /api/tasks — return all tasks
app.get('/api/tasks', (req, res) => {
    try {
        res.json(loadTasks());
    } catch (err) {
        res.status(500).json({ error: 'Could not read tasks' });
    }
});

// POST /api/tasks — add a new task
app.post('/api/tasks', (req, res) => {
    try {
        const { name, type, time, dueDay, dueDate, note } = req.body;
        if (!name || !type || !time) {
            return res.status(400).json({ error: 'name, type, and time are required' });
        }
        const tasks = loadTasks();
        const newTask = { id: Date.now(), name, type, time };
        if (dueDay)  newTask.dueDay  = dueDay;
        if (dueDate) newTask.dueDate = dueDate;
        if (note)    newTask.note    = note;
        tasks.push(newTask);
        saveTasks(tasks);
        res.status(201).json(newTask);
    } catch (err) {
        res.status(500).json({ error: 'Could not save task' });
    }
});

// DELETE /api/tasks/:id — remove a task by id
app.delete('/api/tasks/:id', (req, res) => {
    try {
        const id = Number(req.params.id);
        const tasks = loadTasks();
        const filtered = tasks.filter(t => t.id !== id);
        if (filtered.length === tasks.length) {
            return res.status(404).json({ error: 'Task not found' });
        }
        saveTasks(filtered);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete task' });
    }
});

// POST /api/login — verify dashboard password
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    const expected = (process.env.DASHBOARD_PASSWORD || '').trim();
    if ((password || '').trim() === expected) {
        res.json({ ok: true });
    } else {
        res.json({ ok: false });
    }
});

// POST /api/test — send a test WhatsApp message
app.post('/api/test', async (req, res) => {
    try {
        await sendWhatsApp('🔔 Test message from Reminder Bot! Bot is working correctly ✅');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send test message' });
    }
});

app.listen(3000, () => {
    console.log('🌐 Dashboard running at http://localhost:3000');
});

// ── STARTUP LOGS ─────────────────────────────────────────────────────────────

console.log('🤖 Reminder bot started (IST)');
console.log('📬 Sending WhatsApp to:', process.env.SIR_WHATSAPP);