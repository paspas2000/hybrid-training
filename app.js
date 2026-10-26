'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const { sections, db } = Hybrid;
  const limits = { weight: 100000, sets: 10000, reps: 100000, time: 100000 };
  const numericFields = ['weight', 'sets', 'reps', 'time'];
  let history = [], draft = emptyDraft(), ready = false, busy = false, pickerSection;
  let queue = Promise.resolve(), toastTimer, pendingImport, waitingWorker;
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => crypto.randomUUID();
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function emptyDraft() { return { date: today(), note: '', items: [] }; }
  function isEmpty(value) { return !value.items.length && !value.note; }
  function text(tag, value, className) {
    const el = document.createElement(tag);
    el.textContent = value;
    if (className) el.className = className;
    return el;
  }
  function dateLabel(value) { return new Date(value + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function result(item) {
    const parts = [];
    if (item.weight !== '') parts.push(`${item.weight} кг`);
    if (item.sets !== '' && item.reps !== '') parts.push(`${item.sets} × ${item.reps}`);
    else {
      if (item.sets !== '') parts.push(`${item.sets} подх.`);
      if (item.reps !== '') parts.push(`${item.reps} повт.`);
    }
    if (item.time !== '') parts.push(`${item.time} мин`);
    return parts.join(' · ') || 'Выполнено';
  }
  function sortedHistory() { return [...history].sort((a, b) => b.date.localeCompare(a.date) || b.completedAt.localeCompare(a.completedAt)); }
  function lastResult(exerciseId) {
    for (const workout of sortedHistory()) {
      const item = workout.items.find(entry => entry.exerciseId === exerciseId);
      if (item) return `${dateLabel(workout.date)} — ${result(item)}${item.note ? ' · ' + item.note : ''}`;
    }
    return 'Первый результат — начало истории';
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
  }
  function storageError(error) {
    console.error(error);
    $('#save-state').textContent = 'Не сохранено';
    $('#storage-error').textContent = 'Не удалось прочитать или сохранить данные. Не закрывай страницу: экспортируй JSON во вкладке «Данные». Проверь свободное место и доступ браузера к хранилищу. ' + (error.message || '');
    $('#storage-error').hidden = false;
  }
  function storageOK() { $('#storage-error').hidden = true; $('#save-state').textContent = 'Черновик сохранён'; }
  // Every mutation waits for the preceding write. A failed write does not block export or a retry.
  function enqueue(operation) {
    const task = queue.then(operation);
    queue = task.catch(() => {});
    return task;
  }
  function saveDraft() {
    if (!ready) return;
    $('#save-state').textContent = 'Сохраняю…';
    const snapshot = clone(draft);
    enqueue(() => db.draft(snapshot)).then(storageOK).catch(storageError);
  }
  function setBusy(value) {
    busy = value;
    document.querySelectorAll('#today-view input, #today-view textarea, #today-view button, #import-file, #confirm-import').forEach(el => { el.disabled = value || !ready; });
    updateTotal();
  }
  function updateTotal() {
    const count = draft.items.length;
    $('#exercise-total').textContent = `${count} ${plural(count, ['упражнение', 'упражнения', 'упражнений'])}`;
    $('#finish').disabled = !ready || busy || !count;
    $('#clear-draft').disabled = !ready || busy || isEmpty(draft);
  }
  function plural(n, words) { return words[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 1 : 2]; }
  function renderToday() {
    $('#workout-date').value = draft.date;
    $('#workout-note').value = draft.note;
    const container = $('#sections');
    container.replaceChildren();
    for (const section of sections) {
      const card = document.createElement('section');
      card.className = 'section-card'; card.dataset.section = section.id;
      const head = text('div', '', 'section-head');
      head.append(text('span', section.number, 'section-number'));
      const title = text('div', '', 'section-text');
      const heading = text('h2', section.title); heading.id = `heading-${section.id}`;
      card.setAttribute('aria-labelledby', heading.id);
      title.append(heading, text('p', section.subtitle));
      const symbol = text('span', section.icon, 'section-symbol'); symbol.setAttribute('aria-hidden', 'true');
      const add = text('button', '+ Добавить', 'add-button'); add.disabled = !ready || busy;
      add.setAttribute('aria-label', `Добавить упражнение: ${section.title}`);
      add.addEventListener('click', () => openPicker(section));
      head.append(title, symbol, add); card.append(head);
      const items = draft.items.filter(item => item.sectionId === section.id);
      if (!items.length) card.append(text('div', 'Выбери упражнение для этого блока', 'empty-section'));
      items.forEach(item => card.append(renderExercise(item)));
      container.append(card);
    }
    updateTotal();
  }
  function renderExercise(item) {
    const el = text('article', '', 'exercise'); el.dataset.item = item.id;
    const head = text('div', '', 'exercise-title');
    head.append(text('h3', item.name));
    const remove = text('button', '×', 'icon-button'); remove.setAttribute('aria-label', `Убрать ${item.name}`);
    remove.addEventListener('click', () => {
      if (numericFields.some(key => item[key] !== '') || item.note) {
        if (!confirm(`Убрать «${item.name}» и введённые результаты из черновика?`)) return;
      }
      draft.items = draft.items.filter(entry => entry.id !== item.id); saveDraft(); renderToday();
    });
    head.append(remove);
    el.append(head, text('p', lastResult(item.exerciseId), 'last-result'));
    const fields = text('div', '', 'fields');
    const names = { weight: 'Вес, кг', sets: 'Подходы', reps: 'Повторы', time: 'Время, мин' };
    for (const key of numericFields) {
      const label = text('label', names[key]);
      const input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.max = String(limits[key]);
      input.step = key === 'sets' || key === 'reps' ? '1' : 'any';
      input.inputMode = key === 'sets' || key === 'reps' ? 'numeric' : 'decimal';
      input.value = item[key]; input.placeholder = '—'; input.dataset.field = key;
      input.setAttribute('aria-label', `${item.name}: ${names[key]}`);
      input.addEventListener('input', () => { item[key] = input.value; saveDraft(); });
      label.append(input); fields.append(label);
    }
    const note = document.createElement('textarea'); note.rows = 1; note.maxLength = 1000;
    note.className = 'exercise-note'; note.placeholder = 'Заметка: дистанция, темп, отдых…';
    note.setAttribute('aria-label', `${item.name}: заметка`); note.value = item.note;
    note.addEventListener('input', () => { item.note = note.value; saveDraft(); });
    el.append(fields, note); return el;
  }
  function openPicker(section) {
    pickerSection = section;
    $('#picker-title').textContent = section.title;
    $('#exercise-search').value = ''; $('#custom-name').value = '';
    renderPicker(); $('#picker').showModal();
  }
  function renderPicker() {
    const container = $('#exercise-options'); container.replaceChildren();
    const query = $('#exercise-search').value.toLocaleLowerCase('ru').trim();
    // Retain custom exercises found in previous workouts for reuse and last-result lookup.
    const catalog = new Map(pickerSection.exercises);
    [...sortedHistory(), draft].forEach(workout => workout.items.filter(item => item.sectionId === pickerSection.id).forEach(item => { if (!catalog.has(item.exerciseId)) catalog.set(item.exerciseId, item.name); }));
    for (const [id, name] of catalog) {
      if (!name.toLocaleLowerCase('ru').includes(query)) continue;
      const selected = draft.items.some(item => item.exerciseId === id);
      const option = text('button', '', 'exercise-option');
      option.append(text('span', name), text('span', selected ? 'Добавлено' : '+'));
      option.disabled = selected;
      option.addEventListener('click', () => addExercise(id, name)); container.append(option);
    }
    if (!container.children.length) container.append(text('p', 'Ничего не найдено. Можно добавить своё упражнение.', 'muted'));
  }
  function addExercise(exerciseId, name) {
    if (!ready || busy) return;
    if (draft.items.length >= 100) { toast('В тренировке может быть до 100 упражнений.'); return; }
    if (draft.items.some(item => item.exerciseId === exerciseId)) { toast('Упражнение уже добавлено.'); return; }
    draft.items.push({ id: uid(), exerciseId, sectionId: pickerSection.id, name, weight: '', sets: '', reps: '', time: '', note: '' });
    saveDraft(); renderToday(); $('#picker').close();
    const target = document.querySelector(`[data-section="${pickerSection.id}"] .add-button`);
    target.focus({ preventScroll: true });
  }
  function renderHistory() {
    const summary = $('#history-summary'); summary.replaceChildren(text('strong', String(history.length)), text('span', plural(history.length, ['тренировка сохранена', 'тренировки сохранены', 'тренировок сохранено'])));
    const list = $('#history-list'); list.replaceChildren();
    if (!history.length) {
      const empty = text('div', '', 'empty-state');
      empty.append(text('h2', 'Здесь начинается прогресс'), text('p', 'Собери и заверши первую тренировку. Здесь появятся её упражнения и результаты.'));
      list.append(empty); return;
    }
    for (const workout of sortedHistory()) {
      const card = document.createElement('details'); card.className = 'history-card';
      const summaryEl = document.createElement('summary');
      summaryEl.append(text('span', dateLabel(workout.date), 'history-date'), text('span', `${workout.items.length} ${plural(workout.items.length, ['упражнение', 'упражнения', 'упражнений'])}`, 'history-meta'));
      const body = text('div', '', 'history-content');
      for (const section of sections) {
        const items = workout.items.filter(item => item.sectionId === section.id);
        if (!items.length) continue;
        body.append(text('h3', `${section.number} / ${section.title}`, 'history-section'));
        items.forEach(item => {
          const row = text('div', '', 'history-item'); row.append(text('strong', item.name), text('p', result(item)));
          if (item.note) row.append(text('p', item.note, 'muted note-text'));
          body.append(row);
        });
      }
      if (workout.note) body.append(text('p', workout.note, 'note-text'));
      card.append(summaryEl, body); list.append(card);
    }
  }
  function switchView(name) {
    document.querySelectorAll('.view').forEach(el => { el.hidden = el.id !== name + '-view'; });
    document.querySelectorAll('[data-view]').forEach(button => {
      const active = button.dataset.view === name;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    if (name === 'history') renderHistory();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + 'T12:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === value;
  }
  function string(value, max, label, required = false) {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Некорректное поле «${label}».`);
    return value;
  }
  function validateDraft(value, incomplete = false) {
    if (!value || typeof value !== 'object' || !(validDate(value.date) || (incomplete && value.date === '')) || !Array.isArray(value.items) || value.items.length > 100) throw new Error('Некорректная структура тренировки.');
    const ids = new Set(), exerciseIds = new Set();
    const items = value.items.map(item => {
      if (!item || !sections.some(section => section.id === item.sectionId)) throw new Error('Неизвестная секция упражнения.');
      const clean = {
        id: string(item.id, 150, 'id', true), exerciseId: string(item.exerciseId, 150, 'exerciseId', true),
        sectionId: item.sectionId, name: string(item.name, 100, 'Название', true)
      };
      if (ids.has(clean.id) || exerciseIds.has(clean.exerciseId)) throw new Error('Повторяющееся упражнение в тренировке.');
      ids.add(clean.id); exerciseIds.add(clean.exerciseId);
      for (const key of numericFields) {
        clean[key] = string(item[key], 30, key);
        if (clean[key] !== '') {
          const numeric = Number(clean[key]);
          const syntax = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(clean[key]);
          if (!syntax || !Number.isFinite(numeric) || (!incomplete && (numeric < 0 || numeric > limits[key] || ((key === 'sets' || key === 'reps') && !Number.isInteger(numeric))))) throw new Error('Некорректное числовое значение.');
        }
      }
      clean.note = string(item.note, 1000, 'Заметка упражнения'); return clean;
    });
    return { date: value.date, note: string(value.note, 2000, 'Заметка'), items };
  }
  function validateWorkout(value) {
    const workout = validateDraft(value);
    if (!workout.items.length || typeof value.completedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value.completedAt) || isNaN(Date.parse(value.completedAt))) throw new Error('Некорректная завершённая тренировка.');
    return { id: string(value.id, 150, 'id тренировки', true), ...workout, completedAt: new Date(value.completedAt).toISOString() };
  }
  function validateBackup(value) {
    if (!value || value.app !== 'hybrid-training' || value.schemaVersion !== 1 || !Array.isArray(value.history) || value.history.length > 10000) throw new Error('Нужен JSON-экспорт приложения «Гибрид», версия формата 1.');
    const history = value.history.map(validateWorkout), ids = new Set();
    for (const workout of history) { if (ids.has(workout.id)) throw new Error('В файле повторяются ID тренировок.'); ids.add(workout.id); }
    return { history, draft: value.draft == null ? null : validateDraft(value.draft, true) };
  }
  function planImport(backup, current) {
    const byId = new Map(current.history.map(workout => [workout.id, validateWorkout(workout)]));
    const added = [];
    let skipped = 0;
    for (const workout of backup.history) {
      const old = byId.get(workout.id);
      if (!old) added.push(workout);
      else if (JSON.stringify(old) === JSON.stringify(workout)) skipped++;
      else throw new Error('Конфликт: тренировки с одинаковым ID отличаются. Импорт отменён, данные не изменены.');
    }
    return { added, skipped, draft: backup.draft && (!current.draft || isEmpty(current.draft)) ? backup.draft : null };
  }
  async function finish() {
    if (!ready || busy || !draft.items.length) return;
    const inputs = [...document.querySelectorAll('#today-view input')];
    const invalid = inputs.find(input => !input.checkValidity());
    if (invalid) { invalid.reportValidity(); return; }
    let workout;
    try { workout = validateWorkout({ id: uid(), ...clone(draft), completedAt: new Date().toISOString() }); }
    catch (error) { toast(error.message); return; }
    setBusy(true);
    try {
      await enqueue(() => db.finish(workout));
      history.push(workout); draft = emptyDraft(); renderToday(); storageOK();
      switchView('history'); toast('Тренировка сохранена. Хорошая работа!');
    } catch (error) { storageError(error); }
    finally { setBusy(false); }
  }
  async function exportData() {
    if (busy) return;
    // Include the current in-memory draft even if the last IndexedDB write failed.
    const backup = { app: 'hybrid-training', schemaVersion: 1, exportedAt: new Date().toISOString(), history: clone(history), draft: clone(draft) };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `hybrid-training-${today()}.json`; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $('#backup-info').textContent = 'Экспорт подготовлен. Сохрани скачанный файл в надёжном месте.';
    if (ready) enqueue(() => db.backup(new Date().toISOString())).catch(storageError);
  }
  async function previewImport(event) {
    const file = event.target.files[0]; event.target.value = '';
    pendingImport = null;
    const preview = $('#import-preview'); preview.replaceChildren(); preview.hidden = true;
    if (!file || !ready || busy) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Файл слишком большой: максимум 10 МБ.');
      const backup = validateBackup(JSON.parse(await file.text()));
      await queue;
      const current = await db.read();
      const plan = planImport(backup, { history: current.history, draft });
      pendingImport = backup;
      preview.append(text('p', `Новых тренировок: ${plan.added.length}. Уже есть: ${plan.skipped}.${plan.draft ? ' Черновик будет восстановлен.' : ' Текущий черновик сохранится.'}`));
      const button = text('button', 'Импортировать', 'primary'); button.id = 'confirm-import';
      button.addEventListener('click', applyImport); preview.append(button); preview.hidden = false;
    } catch (error) {
      preview.append(text('p', error instanceof SyntaxError ? 'Не удалось прочитать JSON. Выбери файл экспорта приложения.' : error.message));
      preview.hidden = false;
    }
  }
  async function applyImport() {
    if (!pendingImport || busy || !ready) return;
    setBusy(true);
    try {
      const backup = pendingImport;
      const plan = await enqueue(async () => {
        const current = await db.read();
        const plan = planImport(backup, { history: current.history, draft });
        await db.import(plan.added, plan.draft);
        history = [...current.history, ...plan.added];
        return plan;
      });
      if (plan.draft) draft = plan.draft;
      pendingImport = null; $('#import-preview').hidden = true;
      renderToday(); renderHistory(); storageOK(); toast(`Импорт завершён. Добавлено тренировок: ${plan.added.length}.`);
    } catch (error) { toast(error.message); }
    finally { setBusy(false); }
  }
  function setupWorker() {
    if (!('serviceWorker' in navigator)) { $('#connection').textContent = 'Офлайн недоступен'; return; }
    let registration;
    function updateConnection() {
      if (!navigator.onLine) $('#connection').textContent = navigator.serviceWorker.controller ? 'Без сети · офлайн' : 'Без сети';
      else $('#connection').textContent = navigator.serviceWorker.controller ? 'Офлайн готов' : 'Готовим офлайн…';
    }
    navigator.serviceWorker.addEventListener('controllerchange', updateConnection);
    window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection);
    navigator.serviceWorker.register('./service-worker.js').then(reg => {
      registration = reg;
      const showUpdate = () => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          waitingWorker = registration.waiting; $('#update-banner').hidden = false;
        }
      };
      showUpdate();
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (worker) worker.addEventListener('statechange', showUpdate);
      });
      updateConnection();
    }).catch(error => { console.error(error); $('#connection').textContent = 'Офлайн недоступен'; });
    $('#update-app').addEventListener('click', async () => {
      if (!waitingWorker || busy || !ready) return;
      setBusy(true);
      try {
        await enqueue(() => db.draft(clone(draft)));
        navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      } catch (error) { storageError(error); setBusy(false); }
    });
  }
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
  $('#close-picker').addEventListener('click', () => $('#picker').close());
  $('#exercise-search').addEventListener('input', renderPicker);
  $('#custom-form').addEventListener('submit', event => {
    event.preventDefault(); const name = $('#custom-name').value.trim();
    if (!name) return;
    // Stable section + normalized name makes last results reusable across days.
    const normalized = name.toLocaleLowerCase('ru').replace(/\s+/g, ' ');
    const match = pickerSection.exercises.find(([, value]) => value.toLocaleLowerCase('ru') === normalized);
    addExercise(match ? match[0] : 'custom:' + pickerSection.id + ':' + normalized, name);
  });
  $('#workout-date').addEventListener('input', () => { draft.date = $('#workout-date').value; saveDraft(); });
  $('#workout-note').addEventListener('input', () => { draft.note = $('#workout-note').value; saveDraft(); updateTotal(); });
  $('#finish').addEventListener('click', finish);
  $('#clear-draft').addEventListener('click', () => {
    if (busy || !ready || !confirm('Очистить текущий черновик? Завершённые тренировки останутся в истории.')) return;
    draft = emptyDraft(); saveDraft(); renderToday();
  });
  $('#export').addEventListener('click', exportData);
  $('#import-file').addEventListener('change', previewImport);
  setBusy(true); renderToday();
  db.open().then(() => db.read()).then(data => {
    history = data.history; draft = data.draft || emptyDraft(); ready = true;
    renderToday(); storageOK(); setBusy(false);
    if (data.backup) $('#backup-info').textContent = 'Последний экспорт: ' + new Date(data.backup).toLocaleString('ru-RU');
  }).catch(error => { setBusy(false); storageError(error); });
  setupWorker();
})();
