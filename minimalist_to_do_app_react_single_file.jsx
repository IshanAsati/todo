import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Minimalist To-Do App — Weekly view (TeuxDeux-style)
// - Single-file React component
// - TailwindCSS utility classes assumed available
// - Persists per-day tasks to localStorage (object keyed by YYYY-MM-DD)
// - Week row (Mon..Sun). Click a day to view/edit its tasks
// - "Import yesterday" copies unfinished tasks from yesterday into selected day
// - Add tasks for Today (selected day) or Next day quickly
// - Smooth fade animations via framer-motion

const STORAGE_KEY = "minimalist_todo_weekly_v1";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function isoDate(d) {
  // returns YYYY-MM-DD for a Date instance
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeek(date) {
  // Monday as first day of week
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function MinimalistTodoApp() {
  // tasksByDate: { '2025-11-18': [ {id,text,done,createdAt} ] }
  const [tasksByDate, setTasksByDate] = useState({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [dark, setDark] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    // default to today's weekday index (0 = Monday)
    const today = new Date();
    return (today.getDay() + 6) % 7;
  });

  const inputRef = useRef(null);
  const dragItem = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTasksByDate(JSON.parse(raw));
    } catch (e) {
      console.warn("Could not load tasks", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksByDate));
  }, [tasksByDate]);

  // compute current week's dates (Mon..Sun) based on today
  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return { index: i, date: d, key: isoDate(d) };
    });
  }, [weekStart]);

  const selectedKey = weekDates[selectedDayIndex].key;
  const nextDayKey = weekDates[(selectedDayIndex + 1) % 7].key;
  const yesterdayKey = weekDates[(selectedDayIndex + 6) % 7].key; // wrap-around

  function tasksForKey(key) {
    return tasksByDate[key] ? tasksByDate[key] : [];
  }

  function setTasksForKey(key, arr) {
    setTasksByDate(prev => ({ ...prev, [key]: arr }));
  }

  function addTask(text, targetKey = selectedKey) {
    const t = (text || "").trim();
    if (!t) return;
    const newTask = { id: uid(), text: t, done: false, createdAt: Date.now() };
    const existing = tasksForKey(targetKey);
    setTasksForKey(targetKey, [newTask, ...existing]);
    setQuery("");
    inputRef.current?.focus();
  }

  function toggleDone(key, id) {
    const arr = tasksForKey(key).map(t => (t.id === id ? { ...t, done: !t.done } : t));
    setTasksForKey(key, arr);
  }

  function deleteTask(key, id) {
    const arr = tasksForKey(key).filter(t => t.id !== id);
    setTasksForKey(key, arr);
  }

  function editTask(key, id, newText) {
    const arr = tasksForKey(key).map(t => (t.id === id ? { ...t, text: newText } : t));
    setTasksForKey(key, arr);
  }

  function clearCompleted(key) {
    const arr = tasksForKey(key).filter(t => !t.done);
    setTasksForKey(key, arr);
  }

  function clearAll(key) {
    setTasksForKey(key, []);
  }

  function importYesterday() {
    // copy unfinished tasks from yesterdayKey into selectedKey (as new items)
    const from = tasksForKey(yesterdayKey).filter(t => !t.done);
    if (!from.length) return;
    const copies = from.map(f => ({ id: uid(), text: f.text, done: false, createdAt: Date.now() }));
    setTasksForKey(selectedKey, [...copies, ...tasksForKey(selectedKey)]);
  }

  function handleKey(e) {
    if (e.key === "Enter") addTask(query);
    if (e.key === "Escape") setQuery("");
  }

  // Drag & drop handlers (HTML5) — scoped to selectedKey list
  function onDragStart(e, index) {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = "move";
    try {
      const img = document.createElement("img");
      img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
      e.dataTransfer.setDragImage(img, 0, 0);
    } catch (err) {}
  }

  function onDragOver(e, index) {
    e.preventDefault();
    const dragIndex = dragItem.current;
    if (dragIndex === null || dragIndex === undefined || dragIndex === index) return;
    setTasksForKey(selectedKey, prev => {
      const copy = [...prev];
      const [moved] = copy.splice(dragIndex, 1);
      copy.splice(index, 0, moved);
      dragItem.current = index;
      return copy;
    });
  }

  function onDragEnd() {
    dragItem.current = null;
  }

  // visible list considering filter
  const visible = tasksForKey(selectedKey).filter(t => {
    if (filter === "active") return !t.done;
    if (filter === "done") return t.done;
    return true;
  });

  const stats = {
    total: tasksForKey(selectedKey).length,
    active: tasksForKey(selectedKey).filter(t => !t.done).length,
    done: tasksForKey(selectedKey).filter(t => t.done).length,
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-300 ${dark ? "bg-gray-900 text-gray-100" : "bg-gradient-to-b from-white to-gray-50 text-gray-900"}`}>
      <div className="w-full max-w-3xl">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-semibold tracking-tight ${dark ? "text-gray-100" : "text-gray-900"}`}>Week</h1>
              <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-500"} mt-1`}>Click a day to view tasks. Import unfinished from yesterday, or add tasks to tomorrow.</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setDark(!dark)}
                className={`px-3 py-1 rounded-lg border ${dark ? "border-gray-600 hover:bg-gray-800" : "border-gray-300 hover:bg-gray-100"} text-sm`}
              >
                {dark ? "Light" : "Dark"}
              </button>
            </div>
          </div>

          {/* Week row */}
          <div className="mt-6 flex items-center gap-2 overflow-x-auto">
            {weekDates.map(wd => {
              const isSelected = wd.index === selectedDayIndex;
              return (
                <button
                  key={wd.key}
                  onClick={() => setSelectedDayIndex(wd.index)}
                  className={`px-3 py-2 rounded-lg min-w-[88px] text-left transition-all ${isSelected ? (dark ? "bg-gray-700 text-gray-100" : "bg-gray-100 text-gray-900") : (dark ? "text-gray-300 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-50")}`}
                >
                  <div className="text-xs font-medium">{wd.date.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                  <div className="text-sm mt-1">{wd.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                </button>
              );
            })}
          </div>
        </header>

        <section className={`shadow-lg rounded-2xl p-4 transition-colors duration-300 ${dark ? "bg-gray-800 border border-gray-700" : "bg-white"}`}>
          <div className="flex gap-3 items-center">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder={`Add a task for ${weekDates[selectedDayIndex].date.toLocaleDateString(undefined, { weekday: 'long' })}`}
              className={`flex-1 bg-transparent outline-none py-3 px-2 text-lg ${dark ? "placeholder-gray-500" : "placeholder-gray-400"}`}
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => addTask(query, selectedKey)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 border ${dark ? "border-gray-600 hover:bg-gray-700" : "border-gray-200 hover:bg-gray-50"} transition`}
                aria-label="Add task to selected day"
              >
                Add
              </button>

              <button
                onClick={() => addTask(query, nextDayKey)}
                title="Add this task to tomorrow"
                className={`px-3 py-2 rounded-lg border ${dark ? "border-gray-600 hover:bg-gray-700" : "border-gray-200 hover:bg-gray-50"}`}
              >
                → Tomorrow
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className={`flex items-center gap-2 text-sm ${dark ? "text-gray-300" : "text-gray-600"}`}>
              <span>{stats.active} open</span>
              <span className="px-2">•</span>
              <span>{stats.done} done</span>
            </div>

            <div className="ml-auto flex gap-2 items-center">
              <button onClick={importYesterday} className={`px-3 py-1 rounded-full text-sm ${dark ? "bg-gray-700" : "bg-gray-100"}`}>Import yesterday</button>

              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1 rounded-full text-sm ${filter === "all" ? (dark ? "bg-gray-700" : "bg-gray-100") : ""}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("active")}
                className={`px-3 py-1 rounded-full text-sm ${filter === "active" ? (dark ? "bg-gray-700" : "bg-gray-100") : ""}`}
              >
                Active
              </button>
              <button
                onClick={() => setFilter("done")}
                className={`px-3 py-1 rounded-full text-sm ${filter === "done" ? (dark ? "bg-gray-700" : "bg-gray-100") : ""}`}
              >
                Done
              </button>
            </div>
          </div>

          <div className="mt-4">
            <ul className="space-y-2">
              <AnimatePresence>
                {visible.map((task, i) => (
                  <motion.li
                    key={task.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: "easeInOut" }}
                    layout
                    draggable
                    onDragStart={e => onDragStart(e, i)}
                    onDragOver={e => onDragOver(e, i)}
                    onDragEnd={onDragEnd}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${dark ? "border-gray-700" : "border-gray-100"} shadow-sm transition-colors duration-200`}
                  >
                    <label className="flex items-center gap-3 w-full">
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => toggleDone(selectedKey, task.id)}
                        className="w-5 h-5 rounded-md"
                        aria-label={`Mark ${task.text} as done`}
                      />

                      <EditableText
                        text={task.text}
                        done={task.done}
                        dark={dark}
                        onSave={newText => editTask(selectedKey, task.id, newText)}
                      />
                    </label>

                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => deleteTask(selectedKey, task.id)}
                        className={`text-sm ${dark ? "text-gray-400 hover:text-red-400" : "text-gray-400 hover:text-red-500"} p-1`}
                        aria-label="Delete task"
                      >
                        ✕
                      </button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            {tasksForKey(selectedKey).length === 0 && (
              <div className={`mt-6 py-6 text-center ${dark ? "text-gray-400" : "text-gray-400"}`}>No tasks for this day. Add something small to start.</div>
            )}
          </div>

          <footer className={`mt-4 flex items-center gap-3 text-sm ${dark ? "text-gray-400" : "text-gray-500"}`}>
            <button
              onClick={() => clearAll(selectedKey)}
              className={`px-3 py-1 rounded-md border border-transparent ${dark ? "hover:bg-gray-700" : "hover:bg-gray-50"}`}
            >
              Clear all
            </button>
            <button
              onClick={() => clearCompleted(selectedKey)}
              className={`px-3 py-1 rounded-md border border-transparent ${dark ? "hover:bg-gray-700" : "hover:bg-gray-50"}`}
            >
              Clear completed
            </button>

            <div className={`ml-auto text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>Minimalist — built for focus</div>
          </footer>
        </section>
      </div>
    </div>
  );
}

function EditableText({ text, done, dark, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const ref = useRef(null);

  useEffect(() => setValue(text), [text]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function save() {
    const trimmed = value.trim();
    if (trimmed) onSave(trimmed);
    else setValue(text);
    setEditing(false);
  }

  return (
    <div className="flex-1">
      {!editing ? (
        <div
          onDoubleClick={() => setEditing(true)}
          className={`text-lg ${done ? "line-through text-gray-400" : (dark ? "text-gray-100" : "text-gray-900")} cursor-text transition-colors duration-150`}
        >
          {text}
        </div>
      ) : (
        <input
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setValue(text);
              setEditing(false);
            }
          }}
          className="w-full bg-transparent outline-none text-lg"
        />
      )}
    </div>
  );
}
