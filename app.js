
const $ = id => document.getElementById(id);
const KEY = 'vita_cmms_tasks_v1';
let tasks = [];
let recognition = null;

try {
  tasks = JSON.parse(localStorage.getItem(KEY) || '[]');
} catch {
  tasks = [];
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(tasks));
  render();
}

function fa(n) {
  return String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

function safe(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  })[c]);
}

function render() {
  const open = tasks.filter(t => !t.done);
  $('openCount').textContent = fa(open.length);
  $('urgentCount').textContent = fa(
    open.filter(t => t.priority === 'urgent').length
  );

  const today = new Date().toDateString();
  $('todayCount').textContent = fa(
    open.filter(t => t.dueAt &&
      new Date(t.dueAt).toDateString() === today).length
  );

  const q = $('search').value.trim().toLowerCase();
  const status = $('statusFilter').value;
  const cat = $('categoryFilter').value;

  const list = tasks.filter(t =>
    (!q || (t.title + ' ' + t.assignee + ' ' + t.category)
      .toLowerCase().includes(q)) &&
    (status === 'all' || (status === 'done' ? t.done : !t.done)) &&
    (cat === 'all' || t.category === cat)
  );

  list.sort((a,b) =>
    (a.done - b.done) ||
    ((a.dueAt || '').localeCompare(b.dueAt || ''))
  );

  $('taskList').innerHTML = '';

  if (!list.length) {
    $('taskList').innerHTML =
      '<div class="empty">موردی برای نمایش وجود ندارد.</div>';
  }

  list.forEach(t => {
    const el = document.createElement('article');
    el.className = 'task' + (t.done ? ' done' : '');

    const priority = {
      urgent: 'فوری',
      high: 'مهم',
      normal: 'عادی'
    }[t.priority] || 'عادی';

    const due = t.dueAt
      ? new Date(t.dueAt).toLocaleString('fa-IR')
      : 'بدون موعد';

    el.innerHTML = `
      <div class="task-head">
        <strong>${safe(t.title)}</strong>
        <span class="priority p-${safe(t.priority)}">${priority}</span>
      </div>
      <div class="meta">
        <span>${safe(t.category)}</span>
        <span>مسئول: ${safe(t.assignee || 'تعیین نشده')}</span>
        <span>موعد: ${due}</span>
      </div>
      <div class="task-actions">
        <button class="complete">${t.done ? 'بازگشایی' : '✓ انجام شد'}</button>
        <button class="edit">ویرایش</button>
        <button class="delete">حذف</button>
      </div>`;

    el.querySelector('.complete').onclick = () => {
      t.done = !t.done;
      save();
    };

    el.querySelector('.delete').onclick = () => {
      if (confirm('این کار حذف شود؟')) {
        tasks = tasks.filter(x => x.id !== t.id);
        save();
      }
    };

    el.querySelector('.edit').onclick = () => {
      const title = prompt('شرح کار:', t.title);
      if (title === null) return;
      t.title = title.trim() || t.title;

      const assignee = prompt('مسئول پیگیری:', t.assignee || '');
      if (assignee !== null) t.assignee = assignee;

      save();
    };

    $('taskList').appendChild(el);
  });
}

function addTask() {
  const title = $('taskTitle').value.trim();

  if (!title) {
    alert('لطفاً شرح کار را وارد کنید.');
    return;
  }

  tasks.unshift({
    id: Date.now().toString(),
    title,
    category: $('category').value,
    priority: $('priority').value,
    assignee: $('assignee').value.trim(),
    dueAt: $('dueAt').value,
    done: false,
    createdAt: new Date().toISOString(),
    reminded: false
  });

  $('taskTitle').value = '';
  $('assignee').value = '';
  $('dueAt').value = '';
  save();
}

$('saveBtn').onclick = addTask;

['search', 'statusFilter', 'categoryFilter'].forEach(id => {
  $(id).addEventListener('input', render);
});

$('voiceBtn').onclick = () => {
  const SR = window.SpeechRecognition ||
             window.webkitSpeechRecognition;

  if (!SR) {
    $('voiceStatus').textContent =
      'تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود.';
    return;
  }

  if (recognition) {
    recognition.stop();
    return;
  }

  recognition = new SR();
  recognition.lang = 'fa-IR';
  recognition.interimResults = true;

  $('voiceStatus').textContent = 'در حال شنیدن...';

  recognition.onresult = e => {
    let text = '';
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
    }
    $('taskTitle').value = text;
  };

  recognition.onerror = e => {
    $('voiceStatus').textContent =
      'خطای تشخیص صدا: ' + e.error;
  };

  recognition.onend = () => {
    recognition = null;
    $('voiceStatus').textContent =
      'گفتار دریافت شد؛ متن را بررسی و ثبت کنید.';
  };

  try {
    recognition.start();
  } catch {
    $('voiceStatus').textContent = 'شروع میکروفون ممکن نشد.';
  }
};

$('notifyBtn').onclick = async () => {
  if (!('Notification' in window)) {
    alert('اعلان در این مرورگر پشتیبانی نمی‌شود.');
    return;
  }

  const permission = await Notification.requestPermission();
  alert(permission === 'granted'
    ? 'اجازه اعلان فعال شد.'
    : 'اجازه اعلان داده نشد.');
};

function checkReminders() {
  if (!('Notification' in window) ||
      Notification.permission !== 'granted') return;

  const now = Date.now();

  tasks.forEach(t => {
    if (!t.done && t.dueAt && !t.reminded &&
        new Date(t.dueAt).getTime() <= now) {
      try {
        new Notification('یادآوری VITA CMMS', {
          body: t.title,
          tag: t.id
        });
        t.reminded = true;
        localStorage.setItem(KEY, JSON.stringify(tasks));
      } catch {}
    }
  });
}

setInterval(checkReminders, 20000);

$('exportBtn').onclick = () => {
  const blob = new Blob(
    [JSON.stringify(tasks, null, 2)],
    {type: 'application/json'}
  );

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'VITA_CMMS_backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
};

$('importBtn').onclick = () => $('importFile').click();

$('importFile').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw Error();

    if (confirm('اطلاعات فعلی جایگزین شود؟')) {
      tasks = data;
      save();
      alert('بازیابی انجام شد.');
    }
  } catch {
    alert('فایل پشتیبان معتبر نیست.');
  }

  e.target.value = '';
};

render();
