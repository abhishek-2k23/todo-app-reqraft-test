(() => {
  'use strict';

  // ===== Constants =====
  const STORAGE_KEY = 'todo.tasks.v1';
  const TITLE_MAX_LEN = 120;
  const DESC_MAX_LEN = 500;

  // ===== DOM =====
  const els = {
    form: document.getElementById('taskForm'),
    title: document.getElementById('title'),
    description: document.getElementById('description'),
    dueDate: document.getElementById('dueDate'),
    addBtn: document.getElementById('addTaskBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),

    titleError: document.getElementById('titleError'),
    descriptionError: document.getElementById('descriptionError'),
    dueDateError: document.getElementById('dueDateError'),
    feedback: document.getElementById('feedback'),

    taskList: document.getElementById('taskList'),
    taskCount: document.getElementById('taskCount'),

    runTestsBtn: document.getElementById('runTestsBtn'),
    testOutput: document.getElementById('testOutput')
  };

  // ===== State =====
  /** @type {Array<{id:string,title:string,description:string,dueDate:string|null,createdAt:string}>} */
  let tasks = [];

  // ===== Utils =====
  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function uuid() {
    // good-enough unique id for local use
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }

  function parseDateInput(value) {
    // value is "YYYY-MM-DD" from <input type="date">
    if (!value) return null;
    const m = /^\d{4}-\d{2}-\d{2}$/.exec(value);
    if (!m) return null;

    // Parse as local date (midnight)
    const [y, mo, d] = value.split('-').map(Number);
    const dt = new Date(y, mo - 1, d);
    if (Number.isNaN(dt.getTime())) return null;

    // Ensure it round-trips (guards against invalid dates like 2026-02-31)
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;

    return { date: dt, iso: value };
  }

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function isOverdueDateISO(yyyyMmDd) {
    const parsed = parseDateInput(yyyyMmDd);
    if (!parsed) return false;
    return parsed.date.getTime() < startOfToday().getTime();
  }

  // ===== Storage =====
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      // basic shape normalization
      return parsed
        .map((t) => ({
          id: typeof t.id === 'string' ? t.id : uuid(),
          title: typeof t.title === 'string' ? t.title : '',
          description: typeof t.description === 'string' ? t.description : '',
          dueDate: typeof t.dueDate === 'string' && t.dueDate ? t.dueDate : null,
          createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString()
        }))
        .filter((t) => t.title.trim().length > 0);
    } catch {
      return [];
    }
  }

  function saveTasks(next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  // ===== Validation =====
  function clearFieldErrors() {
    els.titleError.textContent = '';
    els.descriptionError.textContent = '';
    els.dueDateError.textContent = '';

    els.title.classList.remove('form__input--invalid');
    els.description.classList.remove('form__textarea--invalid');
    els.dueDate.classList.remove('form__input--invalid');
  }

  function setFieldError(el, errEl, message) {
    errEl.textContent = message;
    el.classList.add(el.tagName === 'TEXTAREA' ? 'form__textarea--invalid' : 'form__input--invalid');
  }

  function validateTaskInput({ title, description, dueDate }) {
    /** @type {{ok:true, value:{title:string,description:string,dueDate:string|null}} | {ok:false, errors:{title?:string,description?:string,dueDate?:string}, warning?:string}} */
    const result = { ok: true, value: { title: '', description: '', dueDate: null } };

    const trimmedTitle = String(title ?? '').trim();
    const trimmedDesc = String(description ?? '').trim();
    const due = String(dueDate ?? '').trim();

    /** @type {{title?:string,description?:string,dueDate?:string}} */
    const errors = {};

    if (!trimmedTitle) {
      errors.title = 'Title is required.';
    } else if (trimmedTitle.length > TITLE_MAX_LEN) {
      errors.title = `Title must be ${TITLE_MAX_LEN} characters or fewer.`;
    }

    if (trimmedDesc.length > DESC_MAX_LEN) {
      errors.description = `Description must be ${DESC_MAX_LEN} characters or fewer.`;
    }

    let dueIso = null;
    if (due) {
      const parsed = parseDateInput(due);
      if (!parsed) {
        errors.dueDate = 'Due date is invalid.';
      } else if (parsed.date.getTime() < startOfToday().getTime()) {
        // PRD asks for a warning for overdue due dates.
        // We still block creation to avoid creating already-overdue tasks.
        errors.dueDate = 'Due date must be today or later.';
      } else {
        dueIso = parsed.iso;
      }
    }

    if (Object.keys(errors).length > 0) {
      return { ok: false, errors };
    }

    return {
      ok: true,
      value: {
        title: trimmedTitle,
        description: trimmedDesc,
        dueDate: dueIso
      }
    };
  }

  // ===== Feedback =====
  function setFeedback(message, kind) {
    els.feedback.textContent = message;
    els.feedback.classList.remove('feedback--success', 'feedback--error', 'feedback--warning');
    if (kind === 'success') els.feedback.classList.add('feedback--success');
    if (kind === 'error') els.feedback.classList.add('feedback--error');
    if (kind === 'warning') els.feedback.classList.add('feedback--warning');
  }

  // ===== Rendering =====
  function renderTaskCount() {
    els.taskCount.textContent = String(tasks.length);
  }

  function renderTasks() {
    els.taskList.innerHTML = tasks
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((t) => {
        const due = t.dueDate;
        const overdue = due ? isOverdueDateISO(due) : false;
        const dueBadge = due
          ? `<span class="badge ${overdue ? 'badge--overdue' : ''}">Due: ${escapeHtml(due)}${
              overdue ? ' (overdue)' : ''
            }</span>`
          : '';

        const desc = t.description ? `<p class="task__desc">${escapeHtml(t.description)}</p>` : '';

        return `
          <li class="task" data-id="${escapeHtml(t.id)}">
            <p class="task__title">${escapeHtml(t.title)}</p>
            ${desc}
            <div class="task__meta">
              ${dueBadge}
              <span class="badge">Created: ${escapeHtml(new Date(t.createdAt).toLocaleString())}</span>
            </div>
          </li>
        `;
      })
      .join('');

    renderTaskCount();
  }

  // ===== Core flow =====
  function addTask({ title, description, dueDate }) {
    const task = {
      id: uuid(),
      title,
      description,
      dueDate,
      createdAt: new Date().toISOString()
    };

    tasks = [task, ...tasks];
    saveTasks(tasks);
    renderTasks();

    return task;
  }

  function clearAllTasks() {
    tasks = [];
    saveTasks(tasks);
    renderTasks();
    setFeedback('All tasks cleared.', 'success');
  }

  function handleSubmit(e) {
    e.preventDefault();

    setFeedback('', null);
    clearFieldErrors();

    const input = {
      title: els.title.value,
      description: els.description.value,
      dueDate: els.dueDate.value
    };

    const validated = validateTaskInput(input);

    if (!validated.ok) {
      setFeedback('Please fix the errors below.', 'error');

      if (validated.errors.title) setFieldError(els.title, els.titleError, validated.errors.title);
      if (validated.errors.description)
        setFieldError(els.description, els.descriptionError, validated.errors.description);
      if (validated.errors.dueDate) setFieldError(els.dueDate, els.dueDateError, validated.errors.dueDate);

      return;
    }

    const created = addTask(validated.value);

    // Reset form but keep date constraints/placeholder
    els.form.reset();
    els.title.focus();

    setFeedback(`Task created: “${created.title}”.`, 'success');
  }

  // ===== In-browser unit tests =====
  function formatTestLine(ok, name, details) {
    return `${ok ? 'PASS' : 'FAIL'}  ${name}${details ? ` — ${details}` : ''}`;
  }

  function runUnitTests() {
    const lines = [];
    let passed = 0;
    let failed = 0;

    function test(name, fn) {
      try {
        fn();
        passed += 1;
        lines.push(formatTestLine(true, name));
      } catch (err) {
        failed += 1;
        lines.push(formatTestLine(false, name, err && err.message ? err.message : String(err)));
      }
    }

    function assert(condition, message) {
      if (!condition) throw new Error(message);
    }

    function tomorrowISO() {
      const d = startOfToday();
      d.setDate(d.getDate() + 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    function yesterdayISO() {
      const d = startOfToday();
      d.setDate(d.getDate() - 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    // Validation tests
    test('Validation: rejects empty title', () => {
      const res = validateTaskInput({ title: '   ', description: '', dueDate: '' });
      assert(res.ok === false, 'Expected ok=false');
      assert(!!res.errors.title, 'Expected title error');
    });

    test('Validation: enforces title max length', () => {
      const longTitle = 'a'.repeat(TITLE_MAX_LEN + 1);
      const res = validateTaskInput({ title: longTitle, description: '', dueDate: '' });
      assert(res.ok === false, 'Expected ok=false');
      assert(!!res.errors.title, 'Expected title error');
    });

    test('Validation: rejects overdue due date', () => {
      const res = validateTaskInput({ title: 'X', description: '', dueDate: yesterdayISO() });
      assert(res.ok === false, 'Expected ok=false');
      assert(!!res.errors.dueDate, 'Expected dueDate error');
    });

    test('Validation: accepts future due date', () => {
      const res = validateTaskInput({ title: 'X', description: '', dueDate: tomorrowISO() });
      assert(res.ok === true, 'Expected ok=true');
      assert(res.value.dueDate === tomorrowISO(), 'Expected dueDate to pass through');
    });

    // Creation flow tests (non-destructive by isolating storage key)
    test('Creation flow: adds task and persists to localStorage', () => {
      const backup = localStorage.getItem(STORAGE_KEY);
      try {
        localStorage.removeItem(STORAGE_KEY);
        tasks = [];

        const valid = validateTaskInput({
          title: 'Test task',
          description: 'desc',
          dueDate: tomorrowISO()
        });
        assert(valid.ok === true, 'Expected valid input');

        const created = addTask(valid.value);
        assert(created.title === 'Test task', 'Expected created title');

        const reloaded = loadTasks();
        assert(reloaded.length === 1, 'Expected 1 task in storage');
        assert(reloaded[0].title === 'Test task', 'Expected stored title');
      } finally {
        if (backup === null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, backup);

        tasks = loadTasks();
        renderTasks();
      }
    });

    const summary = `\n${passed + failed} tests: ${passed} passed, ${failed} failed`;
    els.testOutput.textContent = lines.join('\n') + summary;
  }

  // ===== Init =====
  function init() {
    tasks = loadTasks();
    renderTasks();

    els.form.addEventListener('submit', handleSubmit);
    els.clearAllBtn.addEventListener('click', clearAllTasks);
    els.runTestsBtn.addEventListener('click', runUnitTests);

    // Subtle UX improvement: default due date min is today
    // Note: HTML date input min expects YYYY-MM-DD
    const today = startOfToday();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    els.dueDate.min = `${yyyy}-${mm}-${dd}`;
  }

  init();
})();
