import { useRef, useState } from "react";

type Props = {
  value: string;
  onSave: (value: string) => void;
  className?: string;
};

export default function EditableText({ value, onSave, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const finished = useRef(false);

  const start = () => {
    finished.current = false;
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    if (finished.current) return;
    finished.current = true;
    setEditing(false);
    const v = draft.trim();
    if (v && v !== value) onSave(v);
  };

  const cancel = () => {
    finished.current = true;
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        className={`inline-input ${className ?? ""}`}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            e.stopPropagation();
            cancel();
          }
        }}
      />
    );
  }

  return (
    <span className={className} onDoubleClick={start} title="Двойной клик: переименовать">
      {value}
    </span>
  );
}