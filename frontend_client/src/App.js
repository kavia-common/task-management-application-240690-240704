import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const STORAGE_KEY = 'retro_todos_v1';

/**
 * @typedef {'all'|'active'|'completed'} Filter
 */

/**
 * @typedef {{
 *  id: string,
 *  title: string,
 *  completed: boolean,
 *  createdAt: string,
 *  updatedAt: string
 * }} Task
 */

/**
 * Best-effort API base:
 * - In CRA dev, you can set REACT_APP_API_BASE_URL=http://localhost:3001
 * - In hosted environments, this can be set to the backend public URL.
 */
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

/**
 * @param {any} e
 * @returns {string}
 */
function getErrorMessage(e) {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error';
  }
}

/**
 * @returns {Task[]}
 */
function loadLocalTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * @param {Task[]} tasks
 */
function saveLocalTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

/**
 * @param {Filter} filter
 * @returns {string}
 */
function filterLabel(filter) {
  if (filter === 'active') return 'ACTIVE';
  if (filter === 'completed') return 'DONE';
  return 'ALL';
}

// PUBLIC_INTERFACE
function App() {
  /** @type {[Task[], Function]} */
  const [tasks, setTasks] = useState(() => loadLocalTasks());
  /** @type {[Filter, Function]} */
  const [filter, setFilter] = useState('all');

  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const [apiStatus, setApiStatus] = useState({ state: 'idle', message: '' }); // idle|ok|error|syncing
  const [toast, setToast] = useState('');

  const inputRef = useRef(null);

  // Persist locally
  useEffect(() => {
    saveLocalTasks(tasks);
  }, [tasks]);

  // Small toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const remainingCount = useMemo(
    () => tasks.filter((t) => !t.completed).length,
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    if (filter === 'active') return tasks.filter((t) => !t.completed);
    if (filter === 'completed') return tasks.filter((t) => t.completed);
    return tasks;
  }, [tasks, filter]);

  /**
   * Creates a new task locally. Optionally syncs to backend if configured.
   * @param {string} title
   */
  function addTask(title) {
    const trimmed = title.trim();
    if (!trimmed) return;

    const now = new Date().toISOString();
    const task = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      title: trimmed,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    setTasks((prev) => [task, ...prev]);
    setNewTitle('');
    setToast('Task added');
  }

  /**
   * @param {string} id
   */
  function toggleTask(id) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, completed: !t.completed, updatedAt: new Date().toISOString() }
          : t
      )
    );
  }

  /**
   * @param {string} id
   */
  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setToast('Task deleted');
  }

  /**
   * @param {string} id
   * @param {string} title
   */
  function startEdit(id, title) {
    setEditingId(id);
    setEditingTitle(title);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTitle('');
  }

  function commitEdit() {
    if (!editingId) return;
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setToast('Title cannot be empty');
      return;
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === editingId ? { ...t, title: trimmed, updatedAt: new Date().toISOString() } : t
      )
    );
    setEditingId(null);
    setEditingTitle('');
    setToast('Task updated');
  }

  function clearCompleted() {
    setTasks((prev) => prev.filter((t) => !t.completed));
    setToast('Cleared completed');
  }

  /**
   * Best-effort: if API is configured and reachable, import tasks from server.
   */
  async function fetchFromApi() {
    if (!API_BASE_URL) {
      setApiStatus({ state: 'idle', message: 'API not configured (set REACT_APP_API_BASE_URL)' });
      return;
    }

    setApiStatus({ state: 'syncing', message: 'Fetching from API…' });
    try {
      const res = await fetch(`${API_BASE_URL}/tasks`, { method: 'GET' });
      if (!res.ok) throw new Error(`GET /tasks failed (${res.status})`);
      const data = await res.json();
      const serverTasks = Array.isArray(data.tasks) ? data.tasks : [];
      setTasks(serverTasks);
      setApiStatus({ state: 'ok', message: 'Loaded from API' });
      setToast('Synced from API');
    } catch (e) {
      setApiStatus({ state: 'error', message: getErrorMessage(e) });
    }
  }

  /**
   * Best-effort: replace API in-memory store with local tasks.
   */
  async function pushToApi() {
    if (!API_BASE_URL) {
      setApiStatus({ state: 'idle', message: 'API not configured (set REACT_APP_API_BASE_URL)' });
      return;
    }

    setApiStatus({ state: 'syncing', message: 'Pushing to API…' });
    try {
      const res = await fetch(`${API_BASE_URL}/tasks/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
      });
      if (!res.ok) throw new Error(`POST /tasks/import failed (${res.status})`);
      setApiStatus({ state: 'ok', message: 'Pushed to API' });
      setToast('Synced to API');
    } catch (e) {
      setApiStatus({ state: 'error', message: getErrorMessage(e) });
    }
  }

  return (
    <div className="rtApp">
      <div className="rtScanlines" aria-hidden="true" />
      <header className="rtHeader">
        <div className="rtTitleBlock">
          <div className="rtKicker">RETRO TASK TERMINAL</div>
          <h1 className="rtTitle">TO-DO</h1>
        </div>

        <div className="rtStatus" role="status" aria-live="polite">
          <span className={`rtPill rtPill--${apiStatus.state}`}>
            {apiStatus.state === 'idle' ? 'LOCAL' : apiStatus.state.toUpperCase()}
          </span>
          <span className="rtStatusText">
            {apiStatus.message || 'Local persistence enabled'}
          </span>
        </div>
      </header>

      <main className="rtMain">
        <section className="rtPanel" aria-label="Add task">
          <form
            className="rtAddForm"
            onSubmit={(e) => {
              e.preventDefault();
              addTask(newTitle);
              if (inputRef.current) inputRef.current.focus();
            }}
          >
            <label className="rtLabel" htmlFor="newTask">
              NEW TASK
            </label>
            <div className="rtInputRow">
              <input
                id="newTask"
                ref={inputRef}
                className="rtInput"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Type something…"
                autoComplete="off"
              />
              <button className="rtBtn rtBtn--primary" type="submit">
                ADD
              </button>
            </div>
            <div className="rtHint">
              Tip: Click a title to edit. Enter to save, Esc to cancel.
            </div>
          </form>
        </section>

        <section className="rtPanel" aria-label="Task list">
          <div className="rtToolbar">
            <div className="rtFilters" role="tablist" aria-label="Filters">
              {/** @type {Filter[]} */}
              {(['all', 'active', 'completed']).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`rtTab ${filter === f ? 'rtTab--active' : ''}`}
                  onClick={() => setFilter(f)}
                  role="tab"
                  aria-selected={filter === f}
                >
                  {filterLabel(f)}
                </button>
              ))}
            </div>

            <div className="rtCounts">
              <span className="rtMono">{remainingCount} left</span>
              <button
                type="button"
                className="rtBtn rtBtn--ghost"
                onClick={clearCompleted}
                disabled={!tasks.some((t) => t.completed)}
              >
                CLEAR DONE
              </button>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="rtEmpty" role="note">
              {tasks.length === 0 ? 'No tasks. Add one above.' : 'No tasks in this filter.'}
            </div>
          ) : (
            <ul className="rtList" aria-label="Tasks">
              {filteredTasks.map((t) => {
                const isEditing = editingId === t.id;
                return (
                  <li key={t.id} className={`rtItem ${t.completed ? 'rtItem--done' : ''}`}>
                    <button
                      type="button"
                      className={`rtCheck ${t.completed ? 'rtCheck--on' : ''}`}
                      aria-label={t.completed ? 'Mark as incomplete' : 'Mark as complete'}
                      onClick={() => toggleTask(t.id)}
                    >
                      {t.completed ? '✓' : ''}
                    </button>

                    <div className="rtItemBody">
                      {isEditing ? (
                        <input
                          className="rtEditInput"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') cancelEdit();
                            if (e.key === 'Enter') commitEdit();
                          }}
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          className="rtTitleBtn"
                          onClick={() => startEdit(t.id, t.title)}
                          aria-label="Edit task title"
                        >
                          {t.title}
                        </button>
                      )}

                      <div className="rtMeta">
                        <span className="rtMono">
                          {new Date(t.updatedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="rtActions">
                      <button
                        type="button"
                        className="rtBtn rtBtn--small"
                        onClick={() => toggleTask(t.id)}
                      >
                        TOGGLE
                      </button>
                      <button
                        type="button"
                        className="rtBtn rtBtn--small rtBtn--danger"
                        onClick={() => deleteTask(t.id)}
                      >
                        DEL
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="rtSyncRow" aria-label="Optional API sync">
            <div className="rtSyncLeft">
              <div className="rtLabelSmall">OPTIONAL API SYNC</div>
              <div className="rtSmall">
                Set <span className="rtMono">REACT_APP_API_BASE_URL</span> to enable.
              </div>
            </div>
            <div className="rtSyncRight">
              <button type="button" className="rtBtn" onClick={fetchFromApi}>
                PULL
              </button>
              <button type="button" className="rtBtn" onClick={pushToApi}>
                PUSH
              </button>
            </div>
          </div>
        </section>
      </main>

      {toast ? (
        <div className="rtToast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}

      <footer className="rtFooter">
        <span className="rtMono">LOCAL SAVE: ON</span>
        <span className="rtDot" aria-hidden="true" />
        <a className="rtLink" href="/docs" target="_blank" rel="noreferrer">
          API DOCS
        </a>
      </footer>
    </div>
  );
}

export default App;
