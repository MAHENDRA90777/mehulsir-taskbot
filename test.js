
  const ICONS = { daily: '📌', weekly: '📅', monthly: '💳' };

  // ── FETCH TASKS ──────────────────────────────────────────────
  async function loadTasks() {
    try {
      const res = await fetch('/api/tasks');
      const tasks = await res.json();
      renderTasks(tasks);
      renderStats(tasks);
    } catch (e) {
      showToast('Failed to load tasks', 'error');
    }
  }

  function renderStats(tasks) {
    document.getElementById('statTotal').textContent = tasks.length;
    document.getElementById('statDaily').textContent = tasks.filter(t => t.type === 'daily').length;
    document.getElementById('statWeekly').textContent = tasks.filter(t => t.type === 'weekly').length;
    document.getElementById('statMonthly').textContent = tasks.filter(t => t.type === 'monthly').length;
  }

  function renderTasks(tasks) {
    const list = document.getElementById('taskList');
    if (!tasks.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">🎉</div><p>No tasks yet — add one above!</p></div>`;
      return;
    }
    list.innerHTML = tasks.map(t => `
      <div class="task-card" id="task-${t.id}">
        <div class="task-icon">${ICONS[t.type] || '📌'}</div>
        <div class="task-info">
          <div class="task-name">${escHtml(t.name)}</div>
          <div class="task-meta">
            <span class="badge badge-${t.type}">${t.type}</span>
            <span class="badge badge-time">🕐 ${t.time}</span>
            ${t.dueDay ? `<span class="badge badge-time">${t.dueDay}</span>` : ''}
            ${t.dueDate ? `<span class="badge badge-time">Day ${t.dueDate}</span>` : ''}
          </div>
          ${t.note ? `<div class="task-note">💬 ${escHtml(t.note)}</div>` : ''}
        </div>
        <button class="btn btn-danger" onclick="deleteTask(${t.id})">🗑 Delete</button>
      </div>
    `).join('');
  }

  // ── DELETE ────────────────────────────────────────────────────
  async function deleteTask(id) {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      const card = document.getElementById(`task-${id}`);
      card.style.transition = 'opacity .2s, transform .2s';
      card.style.opacity = '0';
      card.style.transform = 'translateX(20px)';
      setTimeout(() => loadTasks(), 220);
      showToast('Task deleted', 'success');
    } catch {
      showToast('Failed to delete task', 'error');
    }
  }

  // ── ADD TASK MODAL ────────────────────────────────────────────
  function openModal() {
    document.getElementById('overlay').classList.add('open');
    document.getElementById('taskName').focus();
  }
  function closeModal() { document.getElementById('overlay').classList.remove('open'); }
  function closeModalOnBg(e) { if (e.target === document.getElementById('overlay')) closeModal(); }

  function onTypeChange() {
    const t = document.getElementById('taskType').value;
    document.getElementById('weeklyField').classList.toggle('show', t === 'weekly');
    document.getElementById('monthlyField').classList.toggle('show', t === 'monthly');
  }

  async function submitTask(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.classList.add('loading');
    const type = document.getElementById('taskType').value;
    const body = {
      name: document.getElementById('taskName').value.trim(),
      type,
      time: document.getElementById('taskTime').value,
      note: document.getElementById('taskNote').value.trim() || undefined,
    };
    if (type === 'weekly') body.dueDay = document.getElementById('taskDueDay').value;
    if (type === 'monthly') body.dueDate = document.getElementById('taskDueDate').value;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error();
      closeModal();
      document.getElementById('taskForm').reset();
      onTypeChange();
      await loadTasks();
      showToast('Task added!', 'success');
    } catch {
      showToast('Failed to add task', 'error');
    } finally {
      btn.classList.remove('loading');
    }
  }

  // ── TEST MESSAGE ──────────────────────────────────────────────
  async function sendTest() {
    const btn = document.getElementById('testBtn');
    btn.classList.add('loading');
    try {
      const res = await fetch('/api/test', { method: 'POST' });
      if (!res.ok) throw new Error();
      showToast('Test message sent to Telegram!', 'success');
    } catch {
      showToast('Failed to send test message', 'error');
    } finally {
      btn.classList.remove('loading');
    }
  }

  // ── TOAST ─────────────────────────────────────────────────────
  let toastTimer;
  function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    const icon = type === 'success' ? '✅' : '❌';
    t.innerHTML = `<span>${icon}</span> ${msg}`;
    t.className = `show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, 3000);
  }

  // ── UTILS ─────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── LOGIN ─────────────────────────────────────────────────────
  async function doLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const err = document.getElementById('loginError');
    const pw  = document.getElementById('loginPassword').value;
    btn.classList.add('loading');
    err.classList.remove('show');
    try {
      const res  = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw })
      });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem('bot_auth', '1');
        showApp();
      } else {
        err.classList.add('show');
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginPassword').focus();
      }
    } catch {
      err.textContent = 'Connection error, try again';
      err.classList.add('show');
    } finally {
      btn.classList.remove('loading');
    }
  }

  function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appWrapper').classList.add('visible');
    loadTasks();
  }

  // ── INIT ──────────────────────────────────────────────────────
  if (localStorage.getItem('bot_auth') === '1') {
    showApp();
  } else {
    document.getElementById('loginPassword').focus();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
