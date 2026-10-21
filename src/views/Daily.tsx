import { useState } from "react";

type Task = { id: number; title: string; done: boolean; deadline?: string; priority?: 1 | 2 | 3 | 4 };
type Group = { id: number; name: string; tasks: Task[] };
const priorityLabel = { 1: "!", 2: "!!", 3: "!!!", 4: "ПРЯМЩА" } as const;

// Демо-данные: в следующем шаге заменим на настоящие из базы
const initial: Group[] = [
  {
    id: 1,
    name: "Объектно-ориентированное программирование",
    tasks: [
      { id: 1, title: "Лаба 1", done: true },
      { id: 2, title: "Лаба 2", done: false, deadline: "24 окт", priority: 4},
      { id: 3, title: "Лаба 3", done: false, deadline: "7 ноя", priority: 3},
    ],
  },
  {
    id: 2,
    name: "ProjectDesk",
    tasks: [
      { id: 4, title: "Каркас интерфейса", done: true },
      { id: 5, title: "Подключить SQLite", done: false, priority: 2 },
    ],
  },
  {
    id: 3,
    name: "",
    tasks: [{ id: 6, title: "Купить кофе", done: false, priority: 1}],
  },
];

const deadlines = [
  { title: "Лаба 2 (ООП)", when: "24 окт", left: "через 4 дня", hot: true },
  { title: "Лаба 3 (ООП)", when: "7 ноя", left: "через 18 дней", hot: false },
];

export default function Daily() {
  const [groups, setGroups] = useState<Group[]>(initial);

  const toggle = (gid: number, tid: number) =>
    setGroups((gs) =>
      gs.map((g) =>
        g.id !== gid
          ? g
          : { ...g, tasks: g.tasks.map((t) => (t.id === tid ? { ...t, done: !t.done } : t)) }
      )
    );

  const all = groups.flatMap((g) => g.tasks);
  const done = all.filter((t) => t.done).length;
  const percent = all.length ? Math.round((done / all.length) * 100) : 0;

  return (
    <div className="daily">
      {/* 1/4: статистика */}
      <div className="card">
        <h2>Статистика</h2>
        <div className="stat">
          <div className="stat-value accent-orange">{done}</div>
          <div className="stat-label">выполнено задач</div>
        </div>
        <div className="stat">
          <div className="stat-value accent-blue">{all.length - done}</div>
          <div className="stat-label">осталось</div>
        </div>
        <div className="stat">
          <div className="stat-value">{percent}%</div>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      {/* 2-3/4: задачи */}
      <div className="card tasks">
        <div className="card-head">
          <h2>Что нужно сделать</h2>
          <button className="btn">+</button>
        </div>
        <div className="scroll">
          {groups.map((g) => (
            <div className="group" key={g.id}>
              <div className="group-title">{g.name}</div>
              {g.tasks.map((t) => (
                <label className={`task ${t.done ? "done" : ""}`} key={t.id}>
                  <input type="checkbox" checked={t.done} onChange={() => toggle(g.id, t.id)} />
                  {t.priority && <span className={`prio prio-${t.priority}`}>{priorityLabel[t.priority]}</span>}
                  <span className="task-title">{t.title}</span>
                  {t.deadline && <span className="tag">{t.deadline}</span>}
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 4/4: тепловая карта + дедлайны */}
      <div className="side-col">
        <div className="card">
          <h2>Активность</h2>
          <div className="heatmap">
            {Array.from({ length: 84 }, (_, i) => (
              <div key={i} className={`cell l${(i * 7 + Math.floor(i / 3)) % 5}`} />
            ))}
          </div>
          <div className="muted small">последние 12 недель (демо)</div>
        </div>
        <div className="card">
          <h2>Ближайшие дедлайны</h2>
          {deadlines.map((d) => (
            <div className="deadline" key={d.title}>
              <div>
                <div className="deadline-title">{d.title}</div>
                <div className="muted small">{d.when}</div>
              </div>
              <span className={`pill ${d.hot ? "pill-red" : "pill-blue"}`}>{d.left}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}