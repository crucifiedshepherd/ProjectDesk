import { useCallback, useEffect, useRef, useState } from "react";
import EditableText from "../components/EditableText";
import TaskInput from "../components/TaskInput";
import TaskRow from "../components/TaskRow";
import * as api from "../db";
import type { Group, Priority, Task } from "../db";

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const startOfToday = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};
const shortDate = (s: string) =>
  parseDay(s).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

function plural(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "дня";
  return "дней";
}

function deadlineInfo(deadline: string) {
  const diff = Math.round((parseDay(deadline).getTime() - startOfToday().getTime()) / 86400000);
  let text: string;
  if (diff < 0) text = `просрочено на ${-diff} ${plural(-diff)}`;
  else if (diff === 0) text = "сегодня";
  else if (diff === 1) text = "завтра";
  else text = `через ${diff} ${plural(diff)}`;
  return { text, hot: diff <= 2 };
}

const nextPriority = (p: Priority | null): Priority | null =>
  p === null ? 1 : p === 4 ? null : ((p + 1) as Priority);

function GroupInput({ onSubmit, onCancel }: { onSubmit: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  return (
    <div className="add-row">
      <input
        className="add-input"
        autoFocus
        placeholder="Название группы (Enter: создать, Esc: отмена)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const n = name.trim();
            if (n) onSubmit(n);
            else onCancel();
          }
          if (e.key === "Escape") onCancel();
        }}
      />
      <button className="icon-btn" onClick={onCancel} title="Закрыть">
        ✕
      </button>
    </div>
  );
}

export default function Daily() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addingTop, setAddingTop] = useState(false);
  const [addingIn, setAddingIn] = useState<number | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [confirmGroup, setConfirmGroup] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<number | "none" | null>(null);
  const [undo, setUndo] = useState<{ id: number; title: string } | null>(null);
  const undoTimer = useRef<number | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await api.loadAll();
      setGroups(data.groups);
      setTasks(data.tasks);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(String(e));
    }
  };

  const toggleDone = (t: Task) =>
    run(async () => {
      await api.setDone(t.id, true);
      setUndo({ id: t.id, title: t.title });
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setUndo(null), 6000);
    });

  const undoDone = () => {
    if (!undo) return;
    const id = undo.id;
    setUndo(null);
    run(() => api.setDone(id, false));
  };

  const drop = (groupId: number | null) => {
    if (dragId !== null) run(() => api.moveTask(dragId, groupId));
    setDragId(null);
    setOver(null);
  };

  // --- производные данные ---
  const groupIds = new Set(groups.map((g) => g.id));
  const active = tasks.filter((t) => !t.doneAt);
  const done = tasks
    .filter((t) => t.doneAt)
    .sort((a, b) => b.doneAt!.localeCompare(a.doneAt!));
  const ungrouped = active.filter((t) => t.groupId === null || !groupIds.has(t.groupId));

  const todayKey = dayKey(new Date());
  const doneToday = done.filter((t) => dayKey(new Date(t.doneAt!)) === todayKey).length;
  const percent = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;

  const counts = new Map<string, number>();
  done.forEach((t) => {
    const k = dayKey(new Date(t.doneAt!));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  const today0 = startOfToday();
  const dow = (today0.getDay() + 6) % 7; // понедельник = 0
  const cells = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(today0.getFullYear(), today0.getMonth(), today0.getDate() - dow - 77 + i);
    const n = counts.get(dayKey(d)) ?? 0;
    return {
      key: dayKey(d),
      future: d > today0,
      n,
      level: n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4,
    };
  });

  const upcoming = active
    .filter((t) => t.deadline)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
    .slice(0, 4);

  const groupName = (id: number | null) => groups.find((g) => g.id === id)?.name;

  const renderTask = (t: Task) => (
    <TaskRow
      key={t.id}
      task={t}
      onToggle={() => toggleDone(t)}
      onRename={(title) => run(() => api.renameTask(t.id, title))}
      onPriority={() => run(() => api.setPriority(t.id, nextPriority(t.priority)))}
      onDeadline={(v) => run(() => api.setDeadline(t.id, v || null))}
      onDelete={() => run(() => api.deleteTask(t.id))}
      onDragStart={() => setDragId(t.id)}
      onDragEnd={() => {
        setDragId(null);
        setOver(null);
      }}
    />
  );

  const askDeleteGroup = (g: Group, count: number) => {
    if (count === 0) run(() => api.deleteGroup(g.id, "keep-tasks"));
    else setConfirmGroup(g.id);
  };

  return (
    <div className="daily">
      {/* 1/4: статистика */}
      <div className="card">
        <h2>Статистика</h2>
        <div className="stat">
          <div className="stat-value accent-orange">{doneToday}</div>
          <div className="stat-label">выполнено сегодня</div>
        </div>
        <div className="stat">
          <div className="stat-value accent-blue">{active.length}</div>
          <div className="stat-label">в работе</div>
        </div>
        <div className="stat">
          <div className="stat-value">{done.length}</div>
          <div className="stat-label">выполнено всего ({percent}%)</div>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      {/* 2-3/4: задачи */}
      <div className="card tasks">
        <div className="card-head">
          <h2>Что нужно сделать</h2>
          <div className="row">
            <button className="btn ghost" onClick={() => setAddingGroup(true)}>
              Группа
            </button>
            <button className="btn" title="Новая задача" onClick={() => setAddingTop(true)}>
              +
            </button>
          </div>
        </div>

        <div className="scroll">
          {error && <div className="error-banner">Ошибка данных: {error}</div>}

          {addingGroup && (
            <GroupInput
              onSubmit={(name) => {
                run(() => api.addGroup(name));
                setAddingGroup(false);
              }}
              onCancel={() => setAddingGroup(false)}
            />
          )}

          {addingTop && (
            <TaskInput
              groups={groups}
              onSubmit={(title, gid) => run(() => api.addTask(title, gid))}
              onCancel={() => setAddingTop(false)}
            />
          )}

          {dragId !== null && (
            <div
              className={`dropzone ${over === "none" ? "over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver("none");
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(null);
              }}
            >
              Перетащи сюда, чтобы убрать из группы
            </div>
          )}

          {!loaded && <div className="empty">Загрузка…</div>}
          {loaded && active.length === 0 && groups.length === 0 && (
            <div className="empty">Пока пусто. Нажми «+», чтобы добавить первое дело.</div>
          )}

          {/* дела вне групп: просто общий список */}
          {ungrouped.length > 0 && <div className="group">{ungrouped.map(renderTask)}</div>}

          {groups.map((g) => {
            const gt = active.filter((t) => t.groupId === g.id);
            return (
              <div
                key={g.id}
                className={`group ${over === g.id ? "over" : ""}`}
                onDragOver={(e) => {
                  if (dragId !== null) {
                    e.preventDefault();
                    setOver(g.id);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(g.id);
                }}
              >
                <div className="group-head">
                  <EditableText
                    className="group-title"
                    value={g.name}
                    onSave={(name) => run(() => api.renameGroup(g.id, name))}
                  />
                  <span className="muted small">{gt.length}</span>
                  <div className="group-actions">
                    <button className="icon-btn" onClick={() => setAddingIn(g.id)} title="Добавить дело в группу">
                      +
                    </button>
                    <button className="icon-btn" onClick={() => askDeleteGroup(g, gt.length)} title="Удалить группу">
                      ✕
                    </button>
                  </div>
                </div>

                {confirmGroup === g.id && (
                  <div className="confirm">
                    <span>
                      Удалить «{g.name}»? Дел в группе: {gt.length}
                    </span>
                    <button
                      className="btn danger"
                      onClick={() => {
                        setConfirmGroup(null);
                        run(() => api.deleteGroup(g.id, "delete-tasks"));
                      }}
                    >
                      Удалить с делами
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => {
                        setConfirmGroup(null);
                        run(() => api.deleteGroup(g.id, "keep-tasks"));
                      }}
                    >
                      Оставить дела
                    </button>
                    <button className="btn ghost" onClick={() => setConfirmGroup(null)}>
                      Отмена
                    </button>
                  </div>
                )}

                {addingIn === g.id && (
                  <TaskInput
                    fixedGroupId={g.id}
                    onSubmit={(title) => run(() => api.addTask(title, g.id))}
                    onCancel={() => setAddingIn(null)}
                  />
                )}

                {gt.map(renderTask)}
              </div>
            );
          })}

          {/* завершённые */}
          <div className="done-section">
            <button className="done-toggle" onClick={() => setShowDone((s) => !s)}>
              {showDone ? "▾" : "▸"} Завершено ({done.length})
            </button>
            {showDone &&
              done.map((t) => (
                <div className="task finished" key={t.id}>
                  <span className="task-title">{t.title}</span>
                  {groupName(t.groupId) && <span className="tag">{groupName(t.groupId)}</span>}
                  <span className="muted small">
                    {new Date(t.doneAt!).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </span>
                  <button className="icon-btn" onClick={() => run(() => api.setDone(t.id, false))}>
                    Вернуть
                  </button>
                  <button className="icon-btn" onClick={() => run(() => api.deleteTask(t.id))} title="Удалить">
                    ✕
                  </button>
                </div>
              ))}
          </div>
        </div>

        {undo && (
          <div className="toast">
            <span>Выполнено: «{undo.title}»</span>
            <button onClick={undoDone}>Отменить</button>
          </div>
        )}
      </div>

      {/* 4/4: тепловая карта + дедлайны */}
      <div className="side-col">
        <div className="card">
          <h2>Активность</h2>
          <div className="heatmap">
            {cells.map((c) => (
              <div
                key={c.key}
                className={`cell l${c.level} ${c.future ? "future" : ""}`}
                title={c.future ? "" : `${shortDate(c.key)}: ${c.n}`}
              />
            ))}
          </div>
          <div className="muted small">последние 12 недель</div>
        </div>
        <div className="card">
          <h2>Ближайшие дедлайны</h2>
          {upcoming.length === 0 && (
            <div className="muted small">Дедлайнов пока нет. Дату можно поставить у любого дела.</div>
          )}
          {upcoming.map((t) => {
            const info = deadlineInfo(t.deadline!);
            return (
              <div className="deadline" key={t.id}>
                <div>
                  <div className="deadline-title">{t.title}</div>
                  <div className="muted small">{shortDate(t.deadline!)}</div>
                </div>
                <span className={`pill ${info.hot ? "pill-red" : "pill-blue"}`}>{info.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}