import Database from "@tauri-apps/plugin-sql";

export type Priority = 1 | 2 | 3 | 4;
export type Group = { id: number; name: string; position: number };
export type Task = {
  id: number;
  title: string;
  groupId: number | null;
  priority: Priority | null;
  deadline: string | null; // формат "YYYY-MM-DD"
  createdAt: string;
  doneAt: string | null;
};

export type NoteField = { name: string; value: string };
export type Note = {
  id: number;
  title: string;
  category: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  fields: NoteField[];
};

type TaskRow = {
  id: number;
  title: string;
  group_id: number | null;
  priority: number | null;
  deadline: string | null;
  created_at: string;
  done_at: string | null;
};

// Каждый элемент это одна версия схемы. Новые изменения добавляем в конец.
const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE groups (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL,
       position INTEGER NOT NULL DEFAULT 0
     )`,
    `CREATE TABLE tasks (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       title TEXT NOT NULL,
       group_id INTEGER,
       priority INTEGER,
       deadline TEXT,
       created_at TEXT NOT NULL,
       done_at TEXT
     )`,
  ],
  [
    `CREATE TABLE notes (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       title TEXT NOT NULL DEFAULT '',
       category TEXT NOT NULL DEFAULT '',
       body TEXT NOT NULL DEFAULT '',
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL
     )`,
    `CREATE TABLE note_fields (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       note_id INTEGER NOT NULL,
       name TEXT NOT NULL,
       value TEXT NOT NULL DEFAULT '',
       position INTEGER NOT NULL DEFAULT 0
     )`,
  ],
];

async function migrate(db: Database) {
  const rows = await db.select<{ user_version: number }[]>("PRAGMA user_version");
  let version = rows[0]?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    for (const sql of MIGRATIONS[version]) await db.execute(sql);
    version++;
    await db.execute(`PRAGMA user_version = ${version}`);
  }
}

let dbPromise: Promise<Database> | null = null;

function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await Database.load("sqlite:deskdata.db");
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

export async function loadAll(): Promise<{ groups: Group[]; tasks: Task[] }> {
  const db = await getDb();
  const groups = await db.select<Group[]>(
    "SELECT id, name, position FROM groups ORDER BY position, id"
  );
  const rows = await db.select<TaskRow[]>(
    "SELECT id, title, group_id, priority, deadline, created_at, done_at FROM tasks ORDER BY id"
  );
  const tasks: Task[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    groupId: r.group_id,
    priority: r.priority as Priority | null,
    deadline: r.deadline,
    createdAt: r.created_at,
    doneAt: r.done_at,
  }));
  return { groups, tasks };
}

export async function addGroup(name: string) {
  const db = await getDb();
  await db.execute(
    "INSERT INTO groups (name, position) VALUES ($1, (SELECT COALESCE(MAX(position), 0) + 1 FROM groups))",
    [name]
  );
}

export async function renameGroup(id: number, name: string) {
  const db = await getDb();
  await db.execute("UPDATE groups SET name = $1 WHERE id = $2", [name, id]);
}

// Выполненные дела при удалении группы сохраняются в истории (выходят из группы).
export async function deleteGroup(id: number, mode: "delete-tasks" | "keep-tasks") {
  const db = await getDb();
  if (mode === "delete-tasks") {
    await db.execute("DELETE FROM tasks WHERE group_id = $1 AND done_at IS NULL", [id]);
  }
  await db.execute("UPDATE tasks SET group_id = NULL WHERE group_id = $1", [id]);
  await db.execute("DELETE FROM groups WHERE id = $1", [id]);
}

export async function addTask(title: string, groupId: number | null) {
  const db = await getDb();
  await db.execute(
    "INSERT INTO tasks (title, group_id, created_at) VALUES ($1, $2, $3)",
    [title, groupId, new Date().toISOString()]
  );
}

export async function renameTask(id: number, title: string) {
  const db = await getDb();
  await db.execute("UPDATE tasks SET title = $1 WHERE id = $2", [title, id]);
}

export async function moveTask(id: number, groupId: number | null) {
  const db = await getDb();
  await db.execute("UPDATE tasks SET group_id = $1 WHERE id = $2", [groupId, id]);
}

export async function setPriority(id: number, priority: Priority | null) {
  const db = await getDb();
  await db.execute("UPDATE tasks SET priority = $1 WHERE id = $2", [priority, id]);
}

export async function setDeadline(id: number, deadline: string | null) {
  const db = await getDb();
  await db.execute("UPDATE tasks SET deadline = $1 WHERE id = $2", [deadline, id]);
}

export async function setDone(id: number, done: boolean) {
  const db = await getDb();
  await db.execute("UPDATE tasks SET done_at = $1 WHERE id = $2", [
    done ? new Date().toISOString() : null,
    id,
  ]);
}

export async function deleteTask(id: number) {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
}

// ф-ии заметок
type NoteRow = {
  id: number;
  title: string;
  category: string;
  body: string;
  created_at: string;
  updated_at: string;
};
type FieldRow = { note_id: number; name: string; value: string };

// Очередь: чтение, сохранение и удаление заметок идут строго по порядку
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job);
  queue = run.catch(() => undefined);
  return run;
}

export function loadNotes(): Promise<Note[]> {
  return enqueue(async () => {
    const db = await getDb();
    const rows = await db.select<NoteRow[]>(
      "SELECT id, title, category, body, created_at, updated_at FROM notes ORDER BY id DESC"
    );
    const fields = await db.select<FieldRow[]>(
      "SELECT note_id, name, value FROM note_fields ORDER BY note_id, position, id"
    );
    const byNote = new Map<number, NoteField[]>();
    fields.forEach((f) => {
      const list = byNote.get(f.note_id) ?? [];
      list.push({ name: f.name, value: f.value });
      byNote.set(f.note_id, list);
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      body: r.body,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      fields: byNote.get(r.id) ?? [],
    }));
  });
}

export function createNote(category: string, fields: NoteField[]): Promise<Note> {
  return enqueue(async () => {
    const db = await getDb();
    const now = new Date().toISOString();
    const res = await db.execute(
      "INSERT INTO notes (title, category, body, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
      ["", category, "", now, now]
    );
    const id = res.lastInsertId as number;
    for (let i = 0; i < fields.length; i++) {
      await db.execute(
        "INSERT INTO note_fields (note_id, name, value, position) VALUES ($1, $2, $3, $4)",
        [id, fields[i].name, fields[i].value, i]
      );
    }
    return { id, title: "", category, body: "", createdAt: now, updatedAt: now, fields };
  });
}

export function saveNote(note: Note): Promise<void> {
  return enqueue(async () => {
    const db = await getDb();
    await db.execute(
      "UPDATE notes SET title = $1, category = $2, body = $3, updated_at = $4 WHERE id = $5",
      [note.title, note.category.trim(), note.body, note.updatedAt, note.id]
    );
    await db.execute("DELETE FROM note_fields WHERE note_id = $1", [note.id]);
    let pos = 0;
    for (const f of note.fields) {
      if (!f.name.trim() && !f.value.trim()) continue; // пустые строки не сохраняем
      await db.execute(
        "INSERT INTO note_fields (note_id, name, value, position) VALUES ($1, $2, $3, $4)",
        [note.id, f.name, f.value, pos++]
      );
    }
  });
}

export function deleteNote(id: number): Promise<void> {
  return enqueue(async () => {
    const db = await getDb();
    await db.execute("DELETE FROM note_fields WHERE note_id = $1", [id]);
    await db.execute("DELETE FROM notes WHERE id = $1", [id]);
  });
}