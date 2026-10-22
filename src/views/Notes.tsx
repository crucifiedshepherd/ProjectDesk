import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../db";
import type { Note, NoteField } from "../db";

type Props = { onClose: () => void; initialId?: number | null };

const SAVE_DELAY = 500;

// Поля для новой заметки берём из последней заметки той же категории
function templateFor(category: string, list: Note[], excludeId?: number): NoteField[] {
  const c = category.trim().toLowerCase();
  if (!c) return [];
  const same = list
    .filter((n) => n.id !== excludeId && n.category.trim().toLowerCase() === c && n.fields.length > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return same[0] ? same[0].fields.map((f) => ({ name: f.name, value: "" })) : [];
}

const emptyCount = (n: Note) => n.fields.filter((f) => f.name.trim() && !f.value.trim()).length;

export default function Notes({ onClose, initialId = null }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(initialId);
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pending = useRef(new Map<number, Note>());
  const timer = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const items = [...pending.current.values()];
    pending.current.clear();
    items.forEach((n) => api.saveNote(n).catch((e) => setError(String(e))));
  }, []);

  useEffect(() => {
    api
      .loadNotes()
      .then((list) => {
        setNotes(list);
        setSelectedId((cur) => cur ?? list[0]?.id ?? null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoaded(true));
    return () => flush(); // при закрытии панели сохраняем незаписанное
  }, [flush]);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = window.setTimeout(() => setConfirmDelete(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmDelete]);

  const update = (id: number, patch: Partial<Note>) => {
    const cur = pending.current.get(id) ?? notes.find((n) => n.id === id);
    if (!cur) return;
    const next: Note = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    pending.current.set(id, next);
    setNotes((list) => list.map((n) => (n.id === id ? next : n)));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY);
  };

  const create = async (category: string) => {
    try {
      const note = await api.createNote(category, templateFor(category, notes));
      setNotes((list) => [note, ...list]);
      setSelectedId(note.id);
      setConfirmDelete(false);
    } catch (e) {
      setError(String(e));
    }
  };

  const remove = async (id: number) => {
    pending.current.delete(id);
    try {
      await api.deleteNote(id);
      setNotes((list) => list.filter((n) => n.id !== id));
      setSelectedId(null);
      setConfirmDelete(false);
    } catch (e) {
      setError(String(e));
    }
  };

  const applyTemplate = (n: Note) => {
    if (n.fields.length === 0) {
      const f = templateFor(n.category, notes, n.id);
      if (f.length) update(n.id, { fields: f });
    }
  };

  const setField = (n: Note, i: number, patch: Partial<NoteField>) =>
    update(n.id, { fields: n.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });

  // --- список слева ---
  const q = query.trim().toLowerCase();
  const visible = notes
    .filter(
      (n) =>
        !q ||
        [n.title, n.category, n.body, ...n.fields.flatMap((f) => [f.name, f.value])]
          .join("\n")
          .toLowerCase()
          .includes(q)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const plain = visible.filter((n) => !n.category.trim());
  const catMap = new Map<string, { name: string; items: Note[] }>();
  visible.forEach((n) => {
    const key = n.category.trim().toLowerCase();
    if (!key) return;
    const entry = catMap.get(key) ?? { name: n.category.trim(), items: [] };
    entry.items.push(n);
    catMap.set(key, entry);
  });
  const categories = [...catMap.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const allCategories = [...new Set(notes.map((n) => n.category.trim()).filter(Boolean))];

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const row = (n: Note) => {
    const empty = emptyCount(n);
    return (
      <button
        key={n.id}
        className={`note-item ${n.id === selectedId ? "active" : ""}`}
        onClick={() => {
          setSelectedId(n.id);
          setConfirmDelete(false);
        }}
      >
        <span className="note-item-top">
          <span className="note-item-title">{n.title.trim() || "Без названия"}</span>
          {empty > 0 && <span className="pill pill-red">{empty}</span>}
        </span>
        <span className="muted small note-item-sub">{n.body.trim().split("\n")[0] || "Пустая заметка"}</span>
      </button>
    );
  };

  return (
    <div className="panel fill">
      <div className="panel-head">
        <h1>Заметки</h1>
        <div className="row">
          <button className="btn" onClick={() => create("")}>
            + Новая заметка
          </button>
          <button className="btn ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>

      {error && <div className="error-banner">Ошибка данных: {error}</div>}

      <div className="notes-layout">
        <div className="notes-side">
          <input
            className="add-input search"
            placeholder="Поиск по заметкам…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="notes-list">
            {!loaded && <div className="empty">Загрузка…</div>}
            {loaded && notes.length === 0 && <div className="empty">Заметок пока нет</div>}
            {plain.map(row)}
            {categories.map((c) => (
              <div className="note-cat" key={c.name}>
                <div className="note-cat-head">
                  <span className="group-title">{c.name}</span>
                  <button className="icon-btn" onClick={() => create(c.name)} title="Новая заметка в категории">
                    +
                  </button>
                </div>
                {c.items.map(row)}
              </div>
            ))}
          </div>
        </div>

        {selected ? (
          <div className="editor" key={selected.id}>
            <input
              className="editor-title"
              placeholder="Название"
              autoFocus={selected.title === ""}
              value={selected.title}
              onChange={(e) => update(selected.id, { title: e.target.value })}
            />

            <div className="editor-meta">
              <span className="label">Категория</span>
              <input
                className="meta-input"
                list="note-categories"
                placeholder="Своё название: Бизнес-идея, Кандидатская…"
                value={selected.category}
                onChange={(e) => update(selected.id, { category: e.target.value })}
                onBlur={() => applyTemplate(selected)}
              />
              <datalist id="note-categories">
                {allCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="fields">
              <div className="fields-head">
                <span className="label">Поля</span>
                <button
                  className="icon-btn"
                  onClick={() => update(selected.id, { fields: [...selected.fields, { name: "", value: "" }] })}
                >
                  + Поле
                </button>
              </div>
              {selected.fields.length === 0 && (
                <div className="muted small">
                  Поля нужны для данных вроде «цена: 500». Пустые поля подсветятся в сводке.
                </div>
              )}
              {selected.fields.map((f, i) => (
                <div className="field-row" key={i}>
                  <input
                    className="field-name"
                    placeholder="Название"
                    value={f.name}
                    onChange={(e) => setField(selected, i, { name: e.target.value })}
                  />
                  <input
                    className="field-value"
                    placeholder="—"
                    value={f.value}
                    onChange={(e) => setField(selected, i, { value: e.target.value })}
                  />
                  <button
                    className="icon-btn"
                    title="Убрать поле"
                    onClick={() => update(selected.id, { fields: selected.fields.filter((_, idx) => idx !== i) })}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <textarea
              className="editor-body"
              placeholder="Текст заметки…"
              value={selected.body}
              onChange={(e) => update(selected.id, { body: e.target.value })}
            />

            <div className="editor-foot">
              <span className="muted small">
                Изменено:{" "}
                {new Date(selected.updatedAt).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {" · сохраняется автоматически"}
              </span>
              <button
                className={`icon-btn ${confirmDelete ? "danger" : ""}`}
                onClick={() => (confirmDelete ? remove(selected.id) : setConfirmDelete(true))}
              >
                {confirmDelete ? "Точно удалить?" : "Удалить заметку"}
              </button>
            </div>
          </div>
        ) : (
          <div className="editor placeholder">
            <div className="empty">Выбери заметку слева или создай новую</div>
          </div>
        )}
      </div>
    </div>
  );
}