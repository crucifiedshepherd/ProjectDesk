import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import EditableText from "../components/EditableText";
import * as api from "../db";
import type { Account, Note, SavingsPoint } from "../db";

type Props = { onClose: () => void; onOpenNote: (id: number) => void };

const MASK = "•••••";
const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const fmt = (n: number) => `${money.format(n)} ₽`;

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

function parseAmount(s: string): number | null {
  const cleaned = s.replace(/[\s\u00a0]/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const gaps = (n: Note) => n.fields.filter((f) => f.name.trim() && !f.value.trim()).length;

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

function AmountField({
  value,
  hidden,
  onSave,
}: {
  value: number;
  hidden: boolean;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const finished = useRef(false);

  const start = () => {
    if (hidden) return;
    finished.current = false;
    setDraft(String(value));
    setEditing(true);
  };
  const commit = () => {
    if (finished.current) return;
    finished.current = true;
    setEditing(false);
    const n = parseAmount(draft);
    if (n !== null && n !== value) onSave(n);
  };

  if (editing) {
    return (
      <input
        className="inline-input amount-input"
        autoFocus
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            e.stopPropagation();
            finished.current = true;
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <span
      className="amount"
      onDoubleClick={start}
      title={hidden ? "Сначала покажи суммы" : "Двойной клик: изменить сумму"}
    >
      {hidden ? MASK : fmt(value)}
    </span>
  );
}

function AccountRow({
  account,
  hidden,
  onRename,
  onAmount,
  onDelete,
}: {
  account: Account;
  hidden: boolean;
  onRename: (name: string) => void;
  onAmount: (v: number) => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  return (
    <div className="account-row">
      <EditableText className="account-name" value={account.name} onSave={onRename} />
      <AmountField value={account.amount} hidden={hidden} onSave={onAmount} />
      <button
        className={`icon-btn ${confirming ? "danger" : ""}`}
        onClick={() => (confirming ? onDelete() : setConfirming(true))}
        title="Удалить счёт"
      >
        {confirming ? "Удалить?" : "✕"}
      </button>
    </div>
  );
}

function AccountInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string, amount: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const submit = () => {
    const n = name.trim();
    if (!n) return onCancel();
    onSubmit(n, parseAmount(amount) ?? 0);
  };
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className="add-row">
      <input
        className="add-input"
        autoFocus
        placeholder="Название счёта"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onKey}
      />
      <input
        className="add-input amount-input"
        inputMode="decimal"
        placeholder="Сумма"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={onKey}
      />
      <button className="icon-btn" onClick={onCancel} title="Закрыть">
        ✕
      </button>
    </div>
  );
}

function SavingsChart({ log, hidden }: { log: SavingsPoint[]; hidden: boolean }) {
  // последняя запись за каждый день
  const byDay = new Map<string, SavingsPoint>();
  [...log]
    .sort((a, b) => a.at.localeCompare(b.at))
    .forEach((p) => byDay.set(dayKey(new Date(p.at)), p));
  const points = [...byDay.values()];

  if (points.length < 2) {
    return <div className="muted small">График появится, когда сумма изменится в разные дни.</div>;
  }

  const W = 600;
  const H = 150;
  const P = 10;
  const t0 = new Date(points[0].at).getTime();
  const t1 = new Date(points[points.length - 1].at).getTime();
  const vals = points.map((p) => p.total);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const min = lo === hi ? lo - 1 : lo;
  const max = lo === hi ? hi + 1 : hi;

  const x = (p: SavingsPoint) =>
    P + ((new Date(p.at).getTime() - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / (max - min)) * (H - 2 * P);

  const line = points.map((p) => `${x(p).toFixed(1)},${y(p.total).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const area = `${P},${H - P} ${line} ${x(last).toFixed(1)},${H - P}`;

  return (
    <div className={`chart ${hidden ? "blurred" : ""}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
        <polygon points={area} fill="rgba(92,200,255,.12)" />
        <polyline
          points={line}
          fill="none"
          stroke="#5cc8ff"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={x(last)} cy={y(last.total)} r="4.5" fill="#ff8a3d" />
      </svg>
      <div className="chart-foot muted small">
        <span>{shortDate(points[0].at)}</span>
        <span>{hidden ? MASK : `${fmt(lo)} … ${fmt(hi)}`}</span>
        <span>{shortDate(last.at)}</span>
      </div>
    </div>
  );
}

export default function Summary({ onClose, onOpenNote }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [log, setLog] = useState<SavingsPoint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [adding, setAdding] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem("hideSums") === "1";
    } catch {
      return false;
    }
  });

  const toggleHidden = () => {
    const v = !hidden;
    setHidden(v);
    try {
      localStorage.setItem("hideSums", v ? "1" : "0");
    } catch {
      /* не страшно: просто не запомним выбор */
    }
  };

  const reloadSavings = async () => {
    const s = await api.loadSavings();
    setAccounts(s.accounts);
    setLog(s.log);
  };

  useEffect(() => {
    Promise.all([api.loadNotes(), api.loadSavings()])
      .then(([n, s]) => {
        setNotes(n);
        setAccounts(s.accounts);
        setLog(s.log);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoaded(true));
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reloadSavings();
    } catch (e) {
      setError(String(e));
    }
  };

  // --- сбережения ---
  const total = accounts.reduce((s, a) => s + a.amount, 0);
  const sortedLog = [...log].sort((a, b) => a.at.localeCompare(b.at));
  const monthAgo = Date.now() - 30 * 86400000;
  const older = sortedLog.filter((p) => new Date(p.at).getTime() <= monthAgo);
  let base: SavingsPoint | undefined;
  let deltaLabel = "за 30 дней";
  if (older.length > 0) base = older[older.length - 1];
  else if (sortedLog.length > 1) {
    base = sortedLog[0];
    deltaLabel = "с первой записи";
  }
  const delta = base ? total - base.total : null;

  // --- заметки ---
  const gapsTotal = notes.reduce((s, n) => s + gaps(n), 0);
  const shown = notes.filter((n) => !onlyGaps || gaps(n) > 0);

  return (
    <div className="panel fill">
      <div className="panel-head">
        <h1>Сводка</h1>
        <div className="row">
          <button className="btn eye" onClick={toggleHidden} title="Скрыть или показать суммы">
            <EyeIcon off={hidden} />
            {hidden ? "Показать суммы" : "Скрыть суммы"}
          </button>
          <button className="btn ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>

      {error && <div className="error-banner">Ошибка данных: {error}</div>}

      <div className="summary-layout">
        {/* сбережения */}
        <div className="card savings">
          <h2>Сбережения</h2>
          <div className="stat-value accent-blue">{hidden ? MASK : fmt(total)}</div>
          <div style={{ marginTop: 8, minHeight: 24 }}>
            {delta !== null ? (
              <span className={`pill ${delta >= 0 ? "pill-blue" : "pill-red"}`}>
                {hidden ? MASK : `${delta >= 0 ? "+" : "−"}${fmt(Math.abs(delta))}`} {deltaLabel}
              </span>
            ) : (
              <span className="muted small">Изменения появятся, когда суммы начнут меняться</span>
            )}
          </div>

          <div className="savings-head">
            <span className="label">Счета</span>
            <button className="icon-btn" onClick={() => setAdding(true)}>
              + Счёт
            </button>
          </div>
          {adding && (
            <AccountInput
              onSubmit={(name, amount) => {
                run(() => api.addAccount(name, amount));
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          )}
          {loaded && accounts.length === 0 && !adding && (
            <div className="muted small">Счетов пока нет. Добавь первый: название и сумма.</div>
          )}
          {accounts.map((a) => (
            <AccountRow
              key={a.id}
              account={a}
              hidden={hidden}
              onRename={(name) => run(() => api.renameAccount(a.id, name))}
              onAmount={(v) => run(() => api.setAccountAmount(a.id, v))}
              onDelete={() => run(() => api.deleteAccount(a.id))}
            />
          ))}

          <div className="savings-head">
            <span className="label">Динамика</span>
          </div>
          <SavingsChart log={log} hidden={hidden} />
        </div>

        {/* заметки */}
        <div className="summary-notes">
          <div className="summary-notes-head">
            <h2 style={{ margin: 0 }}>Заметки</h2>
            <div className="row">
              {gapsTotal > 0 && <span className="pill pill-red">Пропусков: {gapsTotal}</span>}
              <button className={`toggle ${onlyGaps ? "on" : ""}`} onClick={() => setOnlyGaps((v) => !v)}>
                Только с пропусками
              </button>
            </div>
          </div>

          <div className="sum-grid">
            {!loaded && <div className="empty">Загрузка…</div>}
            {loaded && shown.length === 0 && (
              <div className="empty">{onlyGaps ? "Пропусков нет" : "Заметок пока нет"}</div>
            )}
            {shown.map((n) => (
              <div
                key={n.id}
                className="sum-card"
                role="button"
                tabIndex={0}
                onClick={() => onOpenNote(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpenNote(n.id);
                }}
              >
                <div className="sum-card-head">
                  <span className="sum-card-title">{n.title.trim() || "Без названия"}</span>
                  {n.category.trim() && <span className="pill pill-orange">{n.category.trim()}</span>}
                </div>
                {n.fields.some((f) => f.name.trim()) ? (
                  n.fields
                    .filter((f) => f.name.trim())
                    .map((f, i) => (
                      <div className="kv" key={i}>
                        <span>{f.name}</span>
                        {f.value.trim() ? <b>{f.value}</b> : <b className="missing">—</b>}
                      </div>
                    ))
                ) : (
                  <div className="muted small">{n.body.trim().split("\n")[0] || "Пустая заметка"}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}