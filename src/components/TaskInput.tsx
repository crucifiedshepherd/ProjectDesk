import { useState } from "react";
import type { Group } from "../db";

type Props = {
  groups?: Group[]; // если передан, показываем выбор группы
  fixedGroupId?: number | null;
  onSubmit: (title: string, groupId: number | null) => void;
  onCancel: () => void;
};

export default function TaskInput({ groups, fixedGroupId = null, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [groupId, setGroupId] = useState<number | null>(fixedGroupId);

  const submit = () => {
    const t = title.trim();
    if (!t) return onCancel();
    onSubmit(t, groupId);
    setTitle("");
  };

  return (
    <div className="add-row">
      <input
        className="add-input"
        autoFocus
        placeholder="Что нужно сделать? (Enter: добавить, Esc: закрыть)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
      />
      {groups && (
        <select
          className="add-select"
          value={groupId ?? ""}
          onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Вне групп</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      )}
      <button className="icon-btn" onClick={onCancel} title="Закрыть">
        ✕
      </button>
    </div>
  );
}