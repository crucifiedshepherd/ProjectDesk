import type { ReactElement } from "react";
export type Section = "daily" | "notes" | "summary";

type Props = {
  active: Section;
  onSelect: (s: Section) => void;
};

const items: { id: Section; label: string; icon: ReactElement}[] = [
  {
    id: "daily",
    label: "Ежедневник",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M3 9h18M8 2v4M16 2v4M8 14l2.5 2.5L16 12" />
      </svg>
    ),
  },
  {
    id: "notes",
    label: "Заметки",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z" />
        <path d="M14 7l3 3" />
      </svg>
    ),
  },
  {
    id: "summary",
    label: "Сводка",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
];

export default function Sidebar({ active, onSelect }: Props) {
  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-dot" />
        Деловик :0
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          className={`nav-item ${active === item.id ? "active" : ""}`}
          onClick={() => onSelect(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
      <div className="sidebar-hint">Esc: вернуться на главный экран</div>
    </nav>
  );
}