/* The Work List — app.js (enhanced)
   - Keyboard shortcuts (N, /, Ctrl/Cmd+E, ?)
   - Export / Import JSON
   - Desktop notifications (permission handling)
   - PWA install prompt handling
   - Service Worker registration
   - Toast UI
   - All variables declared and initialized
*/

'use strict';

// ---------------------------
// Storage keys & defaults
// ---------------------------
const STORAGE_KEY = 'worklist_v1';
const STORAGE_UI = 'worklist_ui_v1';
const DEFAULT_STATE = {
  tasks: [],
  nextId: 1,
  classes: [],
  nextClassId: 1
};
const DEFAULT_UI = {
  theme: 'default',
  focusDate: null,
  calendarWeekStart: null,
  selectedClassId: 'all',
  scratchpad: ''
};

// ---------------------------
// DOM element references
// ---------------------------
const appRoot = document.getElementById('app');
const taskListEl = document.getElementById('taskList');
const newTaskBtn = document.getElementById('newTaskBtn');
const modal = document.getElementById('modal');
const closeModalBtn = document.getElementById('closeModal');
const taskForm = document.getElementById('taskForm');
const modalTitleEl = document.getElementById('modalTitle');
const deleteTaskBtn = document.getElementById('deleteTaskBtn');

const taskTitleInput = document.getElementById('taskTitle');
const taskDescInput = document.getElementById('taskDesc');
const taskDueInput = document.getElementById('taskDue');
const taskPriorityInput = document.getElementById('taskPriority');
const taskTagsInput = document.getElementById('taskTags');
const taskSubtasksInput = document.getElementById('taskSubtasks');
const taskClassSelect = document.getElementById('taskClass');
const dueQuickButtons = document.querySelectorAll('[data-due-option]');

const searchInput = document.getElementById('searchInput');
const filterSelect = document.getElementById('filterSelect');
const remainingCountEl = document.getElementById('remainingCount');
const totalCountEl = document.getElementById('totalCount');
const emptyStateEl = document.getElementById('emptyState');
const tagListEl = document.getElementById('tagList');
const classListEl = document.getElementById('classList');
const classNameInput = document.getElementById('classNameInput');
const classAddBtn = document.getElementById('classAddBtn');
const progressPercentEl = document.getElementById('progressPercent');
const progressFillEl = document.getElementById('progressFill');
const completedCountStatEl = document.getElementById('completedCount');
const activeCountStatEl = document.getElementById('activeCount');
const notesArea = document.getElementById('notesArea');
const notesClearBtn = document.getElementById('notesClear');

const themeBtn = document.getElementById('themeBtn');
const presetButtons = document.querySelectorAll('.preset');
const priorityChips = document.querySelectorAll('.priority-filters .chip');
const completeAllBtn = document.getElementById('completeAll');
const clearDoneBtn = document.getElementById('clearDone');
const boardTitle = document.getElementById('boardTitle');
const calendarGrid = document.getElementById('calendarGrid');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');
const calendarDayLabel = document.getElementById('calendarDayLabel');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const calendarPicker = document.getElementById('calendarPicker');
const calendarTodayBtn = document.getElementById('calendarTodayBtn');
const calendarAllBtn = document.getElementById('calendarAllBtn');

const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');
const installBtn = document.getElementById('installBtn');

const toastEl = document.getElementById('toast');

// ---------------------------
// App state
// ---------------------------
let state = loadState();
ensureStateShape();
let uiState = loadUI();
ensureCalendarDefaults();
ensureUIStateDefaults();
let editingTaskId = null; // null means creating
let deferredInstallPrompt = null;

// ---------------------------
// Initialize app
// ---------------------------
function init() {
  applyUI();
  bindEvents();
  applyNotes();
  render();
  registerServiceWorker();
}

// ---------------------------
// Storage helpers
// ---------------------------
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load state', e);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function loadUI() {
  try {
    const raw = localStorage.getItem(STORAGE_UI);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_UI));
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load UI', e);
    return JSON.parse(JSON.stringify(DEFAULT_UI));
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state', e);
  }
}

function saveUI() {
  try {
    localStorage.setItem(STORAGE_UI, JSON.stringify(uiState));
  } catch (e) {
    console.error('Failed to save UI', e);
  }
}

function ensureStateShape() {
  if (!Array.isArray(state.classes)) state.classes = [];
  if (typeof state.nextClassId !== 'number') state.nextClassId = 1;
  state.tasks.forEach(task => {
    if (!Object.prototype.hasOwnProperty.call(task, 'classId')) {
      task.classId = null;
    }
  });
}

function ensureCalendarDefaults() {
  if (typeof uiState.focusDate === 'undefined') {
    uiState.focusDate = null;
  }
  if (!uiState.calendarWeekStart) {
    uiState.calendarWeekStart = startOfWeekISO(uiState.focusDate || getTodayISO());
    saveUI();
  }
}

function ensureUIStateDefaults() {
  if (!uiState.selectedClassId) {
    uiState.selectedClassId = 'all';
  }
  if (typeof uiState.scratchpad !== 'string') {
    uiState.scratchpad = '';
  }
}

// ---------------------------
// Date helpers
// ---------------------------
function getTodayISO() {
  return formatISODate(new Date());
}

function parseISODate(iso) {
  if (!iso) return new Date();
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeekISO(iso) {
  const date = parseISODate(iso);
  const day = date.getDay(); // Sunday=0
  date.setDate(date.getDate() - day);
  return formatISODate(date);
}

function addDays(date, days) {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

function formatDateHeading(iso) {
  if (!iso) return 'All Tasks';
  const date = parseISODate(iso);
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatWeekLabel(startIso) {
  const startDate = parseISODate(startIso);
  const endDate = addDays(startDate, 6);
  const startStr = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = endDate.toLocaleDateString(undefined, { month: startDate.getMonth() === endDate.getMonth() ? undefined : 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

function diffFromToday(iso) {
  if (!iso) return null;
  const target = parseISODate(iso);
  const today = new Date();
  today.setHours(0,0,0,0);
  target.setHours(0,0,0,0);
  const diffMs = target - today;
  return Math.round(diffMs / (1000*60*60*24));
}

function formatDueLabel(iso) {
  if (!iso) return '';
  const diff = diffFromToday(iso);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff < 0) {
    const dateStr = parseISODate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `Overdue ${dateStr}`;
  }
  const dateStr = parseISODate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `Due ${dateStr}`;
}

// ---------------------------
// Event binding
// ---------------------------
function bindEvents() {
  newTaskBtn.addEventListener('click', () => openModalForNew());
  closeModalBtn.addEventListener('click', closeModal);
  taskForm.addEventListener('submit', onSaveTask);
  deleteTaskBtn.addEventListener('click', onDeleteTask);

  searchInput.addEventListener('input', render);
  filterSelect.addEventListener('change', render);

  themeBtn.addEventListener('click', toggleThemeMenu);

  presetButtons.forEach(btn => {
    btn.addEventListener('click', (ev) => {
      const t = ev.currentTarget.dataset.theme;
      uiState.theme = t;
      applyUI();
      saveUI();
      showToast(`Theme set: ${t}`);
    });
  });
  dueQuickButtons.forEach(btn => {
    btn.addEventListener('click', () => applyDueQuick(btn.dataset.dueOption));
  });
  if (taskDueInput) {
    taskDueInput.addEventListener('input', () => {
      syncDueQuickFromValue();
    });
  }
  if (notesArea) {
    notesArea.addEventListener('input', onNotesChange);
  }
  if (notesClearBtn) {
    notesClearBtn.addEventListener('click', onNotesClear);
  }
  if (classAddBtn) {
    classAddBtn.addEventListener('click', onAddClass);
  }
  if (classNameInput) {
    classNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onAddClass();
      }
    });
  }

  priorityChips.forEach(chip => {
    chip.addEventListener('click', () => {
      priorityChips.forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      render();
    });
  });

  completeAllBtn.addEventListener('click', () => {
    state.tasks.forEach(t => t.completed = true);
    saveState();
    render();
    showToast('All tasks marked done');
  });

  clearDoneBtn.addEventListener('click', () => {
    state.tasks = state.tasks.filter(t => !t.completed);
    saveState();
    render();
    showToast('Cleared completed tasks');
  });

  exportBtn.addEventListener('click', exportJSON);
  importFile.addEventListener('change', onImportFile);

  // keyboard shortcuts
  window.addEventListener('keydown', onKeyDown);

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn.classList.remove('hidden');
  });
  installBtn.addEventListener('click', onInstallClicked);

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => shiftCalendarWeek(-1));
  }
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => shiftCalendarWeek(1));
  }
  if (calendarTodayBtn) {
    calendarTodayBtn.addEventListener('click', () => setFocusDate(getTodayISO()));
  }
  if (calendarAllBtn) {
    calendarAllBtn.addEventListener('click', () => {
      clearFocusDate();
      showToast('Showing all tasks');
    });
  }
  if (calendarPicker) {
    calendarPicker.addEventListener('change', (e) => {
      const value = e.target.value;
      if (!value) {
        clearFocusDate();
        return;
      }
      setFocusDate(value);
    });
  }
  if (calendarGrid) {
    calendarGrid.addEventListener('click', (e) => {
      const cell = e.target.closest('.calendar-cell');
      if (!cell || !calendarGrid.contains(cell)) return;
      const date = cell.dataset.date;
      if (date) {
        setFocusDate(date);
      }
    });
  }
}

// ---------------------------
// UI & background handling
// ---------------------------
function applyUI() {
  document.body.setAttribute('data-theme', uiState.theme || 'default');
  document.body.style.backgroundImage = '';
}

function toggleThemeMenu() {
  const next = uiState.theme === 'default' ? 'sunset' : (uiState.theme === 'sunset' ? 'midnight' : 'default');
  uiState.theme = next;
  saveUI();
  applyUI();
  showToast(`Theme: ${next}`);
}

// ---------------------------
// Modal & form
// ---------------------------
function openModalForNew() {
  editingTaskId = null;
  modalTitleEl.textContent = 'New Task';
  deleteTaskBtn.classList.add('hidden');
  taskForm.reset();
  taskPriorityInput.value = 'medium';
  syncDueQuickFromValue();
  highlightDueQuick('clear');
  if (taskClassSelect) taskClassSelect.value = '';
  showModal();
}

function openModalForEdit(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  editingTaskId = taskId;
  modalTitleEl.textContent = 'Edit Task';
  deleteTaskBtn.classList.remove('hidden');

  taskTitleInput.value = task.title || '';
  taskDescInput.value = task.description || '';
  taskDueInput.value = task.dueDate || '';
  taskPriorityInput.value = task.priority || 'medium';
  taskTagsInput.value = (task.tags || []).join(', ');
  taskSubtasksInput.value = (task.subtasks || []).map(s => s.title).join('\n');
  if (taskClassSelect) {
    taskClassSelect.value = task.classId != null ? String(task.classId) : '';
  }
  syncDueQuickFromValue();

  showModal();
}

function showModal() {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  taskTitleInput.focus();
}

function closeModal() {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  editingTaskId = null;
}

// ---------------------------
// Task CRUD
// ---------------------------
function onSaveTask(e) {
  e.preventDefault();
  const title = taskTitleInput.value.trim();
  const description = taskDescInput.value.trim();
  const dueDate = taskDueInput.value || null;
  const priority = taskPriorityInput.value || 'medium';
  const tags = taskTagsInput.value.split(',').map(s => s.trim()).filter(Boolean);
  const subtasks = taskSubtasksInput.value.split('\n').map(s => s.trim()).filter(Boolean).map((t, i) => ({ id: i+1, title: t, done: false }));
  const classIdValue = taskClassSelect ? taskClassSelect.value : '';
  const classId = classIdValue ? Number(classIdValue) : null;

  if (!title) {
    showToast('Please provide a title for the task.');
    return;
  }

  if (editingTaskId == null) {
    const newTask = {
      id: state.nextId,
      title,
      description,
      dueDate,
      priority,
      tags,
      classId,
      subtasks,
      completed: false,
      createdAt: new Date().toISOString()
    };
    state.tasks.unshift(newTask); // newest first
    state.nextId += 1;
    saveState();
    closeModal();
    render();
    showToast('Task added');
    // quick notification for due today
    if (dueDate && dueDate === (new Date()).toISOString().slice(0,10)) {
      notify('Task due today', `${title} is due today`);
    }
  } else {
    const task = state.tasks.find(t => t.id === editingTaskId);
    if (!task) return;
    task.title = title;
    task.description = description;
    task.dueDate = dueDate;
    task.priority = priority;
    task.tags = tags;
    task.classId = classId;
    // convert subtasks preserving existing done flags if titles match
    task.subtasks = (task.subtasks || []).slice(); // keep reference copy
    task.subtasks = subtasks.map(s => {
      const prev = (task.subtasks || []).find(ps => ps.title === s.title);
      return { id: prev ? prev.id : Date.now(), title: s.title, done: prev ? prev.done : false };
    });
    saveState();
    closeModal();
    render();
    showToast('Task updated');
  }
}

function onDeleteTask() {
  if (editingTaskId == null) return;
  const confirmDelete = confirm('Delete this task? This cannot be undone.');
  if (!confirmDelete) return;
  state.tasks = state.tasks.filter(t => t.id !== editingTaskId);
  saveState();
  closeModal();
  render();
  showToast('Task deleted');
}

// ---------------------------
// Render tasks & UI
// ---------------------------
function render() {
  // filters & search
  const searchTerm = (searchInput.value || '').toLowerCase().trim();
  const filter = filterSelect.value;
  const activePriorityFilterEl = document.querySelector('.priority-filters .chip.selected');
  const priorityFilter = activePriorityFilterEl ? activePriorityFilterEl.dataset.priority || 'all' : 'all';
  const focusDate = uiState.focusDate;
  const selectedClassId = uiState.selectedClassId || 'all';
  if (boardTitle) {
    boardTitle.textContent = focusDate ? formatDateHeading(focusDate) : 'All Tasks';
  }

  // derived lists
  let tasksToShow = [...state.tasks];

  // apply search
  if (searchTerm) {
    tasksToShow = tasksToShow.filter(t => {
      const inTitle = (t.title || '').toLowerCase().includes(searchTerm);
      const inDesc = (t.description || '').toLowerCase().includes(searchTerm);
      const inTags = (t.tags || []).some(tag => tag.toLowerCase().includes(searchTerm));
      return inTitle || inDesc || inTags;
    });
  }

  // apply filters
  const todayStr = (new Date()).toISOString().slice(0,10);
  tasksToShow = tasksToShow.filter(t => {
    if (filter === 'active' && t.completed) return false;
    if (filter === 'done' && !t.completed) return false;
    if (filter === 'today' && t.dueDate !== todayStr) return false;
    if (filter === 'overdue' && !isOverdue(t)) return false;
    return true;
  });

  if (priorityFilter && priorityFilter !== 'all') {
    tasksToShow = tasksToShow.filter(t => t.priority === priorityFilter);
  }

  if (selectedClassId && selectedClassId !== 'all') {
    tasksToShow = tasksToShow.filter(t => String(t.classId) === String(selectedClassId));
  }

  if (focusDate) {
    tasksToShow = tasksToShow.filter(t => {
      if (!t.dueDate) return true;
      if (t.dueDate >= focusDate) return true;
      // keep overdue items visible until completed
      return !t.completed;
    });
  }

  // render counts & tags
  const remaining = state.tasks.filter(t => !t.completed).length;
  const completedTotal = state.tasks.filter(t => t.completed).length;
  remainingCountEl.textContent = String(remaining);
  totalCountEl.textContent = String(state.tasks.length);

  renderClassList();
  renderTagList();
  updateProgressUI(completedTotal, remaining);

  // render list
  taskListEl.innerHTML = '';
  const isEmpty = tasksToShow.length === 0;
  emptyStateEl.style.display = isEmpty ? 'block' : 'none';
  updateEmptyStateCopy();

  tasksToShow.forEach(task => {
    const li = createTaskCard(task);
    taskListEl.appendChild(li);
  });

  // attach drag/drop
  attachDragAndDrop();

  renderCalendar();
}

function renderTagList() {
  const tags = new Set();
  state.tasks.forEach(t => (t.tags || []).forEach(tag => tags.add(tag)));
  tagListEl.innerHTML = '';
  if (tags.size === 0) {
    tagListEl.innerHTML = '<div class="small muted">No tags yet</div>';
    return;
  }
  tags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag';
    btn.textContent = tag;
    btn.addEventListener('click', () => {
      searchInput.value = tag;
      render();
    });
    tagListEl.appendChild(btn);
  });
}

function renderClassList() {
  if (!classListEl) return;
  const selected = uiState.selectedClassId || 'all';
  if (selected !== 'all' && !state.classes.some(c => String(c.id) === String(selected))) {
    uiState.selectedClassId = 'all';
    saveUI();
  }
  classListEl.innerHTML = '';
  const fragment = document.createDocumentFragment();
  const allBtn = createClassChip('All', 'all', state.tasks.length, selected === 'all');
  fragment.appendChild(allBtn);
  state.classes.forEach(cls => {
    const count = state.tasks.filter(t => t.classId === cls.id).length;
    const btn = createClassChip(cls.name, String(cls.id), count, String(cls.id) === String(selected));
    fragment.appendChild(btn);
  });
  classListEl.appendChild(fragment);
  populateTaskClassSelect();
}

function createClassChip(label, value, count, isSelected) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'class-chip' + (isSelected ? ' selected' : '');
  btn.dataset.classId = value;
  btn.textContent = label;
  if (typeof count === 'number') {
    const countEl = document.createElement('span');
    countEl.className = 'count';
    countEl.textContent = `(${count})`;
    btn.appendChild(countEl);
  }
  btn.addEventListener('click', () => setSelectedClass(value));
  return btn;
}

function populateTaskClassSelect() {
  if (!taskClassSelect) return;
  const prev = taskClassSelect.value;
  taskClassSelect.innerHTML = '';
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'No class';
  taskClassSelect.appendChild(defaultOpt);
  state.classes.forEach(cls => {
    const opt = document.createElement('option');
    opt.value = String(cls.id);
    opt.textContent = cls.name;
    taskClassSelect.appendChild(opt);
  });
  if (prev && taskClassSelect.querySelector(`option[value="${prev}"]`)) {
    taskClassSelect.value = prev;
  } else {
    taskClassSelect.value = '';
  }
}

function onAddClass() {
  const name = (classNameInput && classNameInput.value || '').trim();
  if (!name) {
    showToast('Enter a class name');
    return;
  }
  const exists = state.classes.some(cls => cls.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    showToast('Class already exists');
    return;
  }
  const newClass = { id: state.nextClassId++, name };
  state.classes.push(newClass);
  classNameInput.value = '';
  saveState();
  render();
  showToast(`Class added: ${name}`);
}

function setSelectedClass(value) {
  uiState.selectedClassId = value || 'all';
  saveUI();
  render();
}

function getClassNameById(id) {
  if (id == null) return '';
  const cls = state.classes.find(c => c.id === id);
  return cls ? cls.name : '';
}

function applyNotes() {
  if (!notesArea) return;
  notesArea.value = uiState.scratchpad || '';
}

function onNotesChange() {
  if (!notesArea) return;
  uiState.scratchpad = notesArea.value;
  saveUI();
}

function onNotesClear() {
  if (!notesArea) return;
  notesArea.value = '';
  uiState.scratchpad = '';
  saveUI();
}

function applyDueQuick(option) {
  if (!taskDueInput) return;
  const today = new Date();
  let targetValue = null;
  switch (option) {
    case 'today':
      targetValue = getTodayISO();
      break;
    case 'tomorrow':
      targetValue = formatISODate(addDays(today, 1));
      break;
    case 'nextweek':
      targetValue = formatISODate(addDays(today, 7));
      break;
    case 'clear':
      taskDueInput.value = '';
      highlightDueQuick('clear');
      taskDueInput.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    case 'pick':
      highlightDueQuick(null);
      if (typeof taskDueInput.showPicker === 'function') {
        taskDueInput.showPicker();
      } else {
        taskDueInput.focus();
      }
      return;
    default:
      break;
  }

  if (targetValue) {
    taskDueInput.value = targetValue;
    highlightDueQuick(option);
    taskDueInput.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    highlightDueQuick(null);
  }
}

function highlightDueQuick(option) {
  dueQuickButtons.forEach(btn => {
    btn.classList.toggle('selected', !!option && btn.dataset.dueOption === option);
  });
}

function syncDueQuickFromValue() {
  if (!taskDueInput) return;
  const value = taskDueInput.value;
  if (!value) {
    highlightDueQuick('clear');
    return;
  }
  const todayISO = getTodayISO();
  const tomorrowISO = formatISODate(addDays(new Date(), 1));
  const nextWeekISO = formatISODate(addDays(new Date(), 7));
  if (value === todayISO) return highlightDueQuick('today');
  if (value === tomorrowISO) return highlightDueQuick('tomorrow');
  if (value === nextWeekISO) return highlightDueQuick('nextweek');
  highlightDueQuick(null);
}

function updateProgressUI(completed, remaining) {
  if (!progressPercentEl || !progressFillEl || !completedCountStatEl || !activeCountStatEl) return;
  const total = completed + remaining;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  progressPercentEl.textContent = `${percent}%`;
  progressFillEl.style.width = `${percent}%`;
  completedCountStatEl.textContent = String(completed);
  activeCountStatEl.textContent = String(remaining);
}

function updateEmptyStateCopy() {
  if (!emptyStateEl) return;
  const heading = emptyStateEl.querySelector('h3');
  const body = emptyStateEl.querySelector('p');
  if (uiState.focusDate) {
    if (heading) heading.textContent = 'Nothing coming up';
    if (body) body.textContent = 'No tasks remain between this date and the due dates you have set.';
  } else {
    if (heading) heading.textContent = 'No tasks yet';
    if (body) body.textContent = 'Click “+ New Task” to add your first to-do.';
  }
}

function renderCalendar() {
  if (!calendarGrid || !calendarMonthLabel || !calendarDayLabel) return;
  if (!uiState.calendarWeekStart) {
    uiState.calendarWeekStart = startOfWeekISO(uiState.focusDate || getTodayISO());
    saveUI();
  }
  const weekStart = parseISODate(uiState.calendarWeekStart);
  calendarMonthLabel.textContent = formatWeekLabel(uiState.calendarWeekStart);
  calendarDayLabel.textContent = uiState.focusDate ? `Planning from ${formatDateHeading(uiState.focusDate)}` : 'Showing all tasks';
  if (calendarPicker) {
    calendarPicker.value = uiState.focusDate || '';
  }

  const taskCountByDate = state.tasks.reduce((acc, task) => {
    if (!task.dueDate) return acc;
    acc[task.dueDate] = (acc[task.dueDate] || 0) + 1;
    return acc;
  }, {});

  calendarGrid.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const current = addDays(weekStart, i);
    const iso = formatISODate(current);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'calendar-cell';
    cell.dataset.date = iso;
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `${current.toLocaleDateString()} (${taskCountByDate[iso] || 0} tasks)`);
    if (iso === uiState.focusDate) cell.classList.add('selected');
    if (iso === getTodayISO()) cell.classList.add('today');
    const number = document.createElement('span');
    number.textContent = current.getDate();
    cell.appendChild(number);
    const count = taskCountByDate[iso] || 0;
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'calendar-count';
      badge.textContent = count === 1 ? '1 task' : `${count} tasks`;
      cell.appendChild(badge);
    }
    calendarGrid.appendChild(cell);
  }
}

function setFocusDate(iso) {
  if (!iso) {
    clearFocusDate();
    return;
  }
  uiState.focusDate = iso;
  uiState.calendarWeekStart = startOfWeekISO(iso);
  saveUI();
  render();
}

function clearFocusDate() {
  uiState.focusDate = null;
  saveUI();
  render();
}

function shiftCalendarWeek(delta) {
  const baseIso = uiState.calendarWeekStart || startOfWeekISO(uiState.focusDate || getTodayISO());
  const baseDate = parseISODate(baseIso);
  baseDate.setDate(baseDate.getDate() + (delta * 7));
  const newStart = formatISODate(baseDate);
  uiState.calendarWeekStart = newStart;
  if (uiState.focusDate) {
    uiState.focusDate = newStart;
  }
  saveUI();
  render();
}

function isOverdue(task) {
  if (!task.dueDate) return false;
  const nowStr = (new Date()).toISOString().slice(0,10);
  return (!task.completed && task.dueDate < nowStr);
}

function createTaskCard(task) {
  const li = document.createElement('li');
  li.className = 'task-card';
  li.dataset.taskId = String(task.id);
  li.setAttribute('draggable', 'true');

  if (task.completed) li.classList.add('completed');
  if (isOverdue(task)) li.classList.add('overdue');
  else if (task.dueDate) {
    // due soon within 2 days
    const today = new Date();
    const due = new Date(task.dueDate + 'T23:59:59');
    const diff = Math.ceil((due - today) / (1000*60*60*24));
    if (diff === 1 && !task.completed) li.classList.add('due-tomorrow');
    if (diff >= 0 && diff <= 2 && !task.completed) li.classList.add('due-soon');
  }

  // right: controls
  const right = document.createElement('div');
  right.className = 'task-right';

  const editBtn = document.createElement('button');
  editBtn.className = 'icon-btn small';
  editBtn.title = 'Edit';
  editBtn.textContent = '✏️';
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openModalForEdit(task.id);
  });

  const completeBtn = document.createElement('button');
  completeBtn.className = 'btn small';
  completeBtn.textContent = task.completed ? 'Undo' : 'Done';
  completeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleComplete(task.id);
  });

  right.appendChild(editBtn);
  right.appendChild(completeBtn);

  // left: content
  const left = document.createElement('div');
  left.className = 'task-left';

  // title row
  const head = document.createElement('div');
  head.className = 'task-head';

  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = task.title;

  const meta = document.createElement('div');
  meta.className = 'task-meta';
  const metaParts = [];
  const className = getClassNameById(task.classId);
  if (className) metaParts.push(className);
  metaParts.push(task.priority.toUpperCase());
  if (metaParts.length) {
    const text = document.createElement('span');
    text.textContent = metaParts.join(' • ');
    meta.appendChild(text);
  }
  if (task.dueDate) {
    const duePill = document.createElement('span');
    duePill.className = 'task-due-pill';
    duePill.textContent = formatDueLabel(task.dueDate);
    meta.appendChild(duePill);
  }

  head.appendChild(title);
  head.appendChild(meta);

  const desc = document.createElement('div');
  desc.className = 'task-desc';
  desc.textContent = task.description || '';

  // subtasks
  const subWrap = document.createElement('div');
  subWrap.className = 'subtasks';
  if (task.subtasks && task.subtasks.length) {
    task.subtasks.forEach((s) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '8px';
      row.style.alignItems = 'center';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!s.done;
      cb.addEventListener('change', (e) => {
        s.done = !!e.target.checked;
        saveState();
        render();
      });
      const label = document.createElement('div');
      label.textContent = s.title;
      label.style.fontSize = '13px';
      label.style.color = 'var(--muted)';
      if (s.done) label.style.textDecoration = 'line-through';
      row.appendChild(cb);
      row.appendChild(label);
      subWrap.appendChild(row);
    });
  }

  // tags
  const tagsWrap = document.createElement('div');
  tagsWrap.className = 'tags';
  (task.tags || []).forEach(tag => {
    const pill = document.createElement('span');
    pill.className = 'tag-pill';
    pill.textContent = tag;
    pill.addEventListener('click', () => {
      searchInput.value = tag;
      render();
    });
    tagsWrap.appendChild(pill);
  });

  left.appendChild(head);
  if (task.description) left.appendChild(desc);
  if (task.subtasks && task.subtasks.length) left.appendChild(subWrap);
  if (task.tags && task.tags.length) left.appendChild(tagsWrap);

  li.appendChild(left);
  li.appendChild(right);

  // clicking the card toggles selection / open
  li.addEventListener('dblclick', () => openModalForEdit(task.id));

  // context menu: quick delete on right-click
  li.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const ok = confirm('Delete this task?');
    if (ok) {
      state.tasks = state.tasks.filter(t => t.id !== task.id);
      saveState();
      render();
      showToast('Task deleted');
    }
  });

  return li;
}

function toggleComplete(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.completed = !task.completed;
  saveState();
  render();
  showToast(task.completed ? 'Marked complete' : 'Marked active');
  if (task.completed) notify('Task completed', task.title);
}

// ---------------------------
// Drag & Drop reordering
// ---------------------------
function attachDragAndDrop() {
  let draggedEl = null;
  let draggedId = null;

  // helper: reorder state.tasks based on DOM order
  function reorderFromDom() {
    const ids = Array.from(taskListEl.querySelectorAll('li')).map(li => Number(li.dataset.taskId));
    const newOrder = [];
    ids.forEach(id => {
      const t = state.tasks.find(tt => tt.id === id);
      if (t) newOrder.push(t);
    });
    // if any missing (filtered view), append them
    state.tasks.forEach(t => { if (!newOrder.includes(t)) newOrder.push(t); });
    state.tasks = newOrder;
    saveState();
    render();
  }

  taskListEl.querySelectorAll('li').forEach(li => {
    li.addEventListener('dragstart', (e) => {
      draggedEl = li;
      draggedId = li.dataset.taskId;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    li.addEventListener('dragend', () => {
      if (draggedEl) draggedEl.classList.remove('dragging');
      draggedEl = null;
      draggedId = null;
    });

    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      const target = e.currentTarget;
      if (draggedEl === target) return;
      // insert above/below based on pointer
      const rect = target.getBoundingClientRect();
      const halfway = rect.top + rect.height / 2;
      if (e.clientY < halfway) {
        taskListEl.insertBefore(draggedEl, target);
      } else {
        taskListEl.insertBefore(draggedEl, target.nextSibling);
      }
    });

    li.addEventListener('drop', (e) => {
      e.preventDefault();
      // finalize reorder
      reorderFromDom();
      showToast('Order saved');
    });
  });
}

// ---------------------------
// Export / Import JSON
// ---------------------------
function exportJSON() {
  const payload = {
    meta: { exportedAt: new Date().toISOString(), version: 1 },
    ui: uiState,
    state: state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `the-work-list-export-${(new Date()).toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Exported tasks JSON');
}

function onImportFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) {
    showToast('No file selected');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (!parsed || !parsed.state || !Array.isArray(parsed.state.tasks)) {
        showToast('Invalid file format');
        return;
      }
      // merge carefully — append imported tasks with new ids if conflicts
      const incoming = parsed.state;
      // reassign ids to avoid clashes
      incoming.tasks.forEach(task => {
        task.id = state.nextId++;
      });
      state.tasks = incoming.tasks.concat(state.tasks);
      saveState();
      render();
      showToast('Imported tasks');
    } catch (err) {
      console.error(err);
      showToast('Unable to read JSON');
    }
  };
  reader.readAsText(file);
  // reset input so same file can be re-imported later
  e.target.value = '';
}

// ---------------------------
// Notifications & Toasts
// ---------------------------
function showToast(text, timeout = 2600) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.remove('hidden');
  setTimeout(() => {
    toastEl.classList.add('show');
  }, 10);
  setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 300);
  }, timeout);
}

function requestNotificationPermissionIfNeeded() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    // ask later on first meaningful action; we'll ask when user uses export/import or creates first task
    // But we'll ask now for a better UX (user can decline)
    Notification.requestPermission().then(permission => {
      console.log('Notification permission', permission);
    }).catch(() => {});
  }
}

function notify(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body });
    n.onclick = () => window.focus();
  } catch (err) {
    console.warn('Notification failed', err);
  }
}

// ---------------------------
// Keyboard shortcuts
// ---------------------------
function onKeyDown(e) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
  const targetTag = (e.target && e.target.tagName || '').toLowerCase();
  const typingTarget = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select' || (e.target && e.target.isContentEditable);
  if (typingTarget && !ctrlKey && !e.altKey) {
    return;
  }

  if (e.key === 'n' || e.key === 'N') {
    // new task
    e.preventDefault();
    openModalForNew();
    return;
  }
  if (e.key === '/') {
    e.preventDefault();
    searchInput.focus();
    return;
  }
  if ((e.key === 'e' || e.key === 'E') && ctrlKey) {
    e.preventDefault();
    exportJSON();
    return;
  }
  if (e.key === '?') {
    e.preventDefault();
    toggleHelp();
    return;
  }
}

function toggleHelp() {
  const helpEl = document.querySelector('.help');
  if (!helpEl) return;
  if (getComputedStyle(helpEl).display === 'none') {
    helpEl.style.display = 'block';
  } else {
    helpEl.style.display = 'none';
  }
}

// ---------------------------
// PWA / Service Worker
// ---------------------------
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    console.log('ServiceWorker registered', reg);
  }).catch(err => {
    console.warn('ServiceWorker failed', err);
  });
}

function onInstallClicked() {
  if (!deferredInstallPrompt) {
    showToast('Install unavailable');
    return;
  }
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      showToast('Thanks! App installed');
    } else {
      showToast('Install dismissed');
    }
    deferredInstallPrompt = null;
    installBtn.classList.add('hidden');
  });
}

// ---------------------------
// Boot with sample data if empty
// ---------------------------
function seedIfEmpty() {
  if (state.tasks.length === 0) {
    const sample = [
      {
        id: state.nextId++,
        title: 'Finish math practice set',
        description: 'Problems 12–30. Focus on optimization.',
        dueDate: nextDateString(1),
        priority: 'high',
        tags: ['school', 'math'],
        subtasks: [{id:1,title:'Read chapter 4',done:false},{id:2,title:'Do problems 12-20',done:false}],
        completed: false,
        createdAt: new Date().toISOString()
      },
      {
        id: state.nextId++,
        title: 'Plan weekend playlist',
        description: 'Pick 20 tracks for the study session.',
        dueDate: null,
        priority: 'low',
        tags: ['music','fun'],
        subtasks: [],
        completed: false,
        createdAt: new Date().toISOString()
      }
    ];
    state.tasks = sample;
    saveState();
  }
}

function nextDateString(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0,10);
}

// ---------------------------
// Initialize app
// ---------------------------
init();
