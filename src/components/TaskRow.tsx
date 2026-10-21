import { useEffect, useRef, useState } from "react";
import EditableText from "./EditableText";
import type { Task } from "../db";

const priorityLabel = { 1: "!", 2: "!!", 3: "!!!", 4: "ПРЯМЩА" } as const;

type Props = {
  task: Task;
  onToggle: () => void;
  onRename: (title: string) => void;
  onPriority: () => void;
  onDeadline: (value: string) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

export default function TaskRow({
  task,
  onToggle,
  onRename,
  onPriority,
  onDeadline,
  onDelete,
  onDragStart,
  onDragEnd,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const askDelete = () => {
    if (confirming) {
      onDelete();
      return;
    }
    setConfirming(true);
    timer.current = window.setTimeout(() => setConfirming(false), 3000);
  };

  return (
    <div
      className="task"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(task.id));
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <input type="checkbox" checked={false} onChange={onToggle} title="Выполнено" />
      <button
        className={`prio ${task.priority ? `prio-${task.priority}` : "prio-add"}`}
        onClick={onPriority}
        title="Важность: клик меняет уровень"
      >
        {task.priority ? priorityLabel[task.priority] : "!"}
      </button>
      <EditableText className="task-title" value={task.title} onSave={onRename} />
      <input
        key={task.deadline ?? "none"}
        type="date"
        className={`date-input ${task.deadline ? "has" : ""}`}
        defaultValue={task.deadline ?? ""}
        onBlur={(e) => {
          if (e.target.value !== (task.deadline ?? "")) onDeadline(e.target.value);
        }}
        title="Дедлайн"
      />
      <button className={`icon-btn ${confirming ? "danger" : ""}`} onClick={askDelete} title="Удалить">
        {confirming ? "Удалить?" : "✕"}
      </button>
    </div>
  );
}