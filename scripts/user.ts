import { Store } from "../server/store.ts";
import type { Role } from "../shared/model.ts";
import { randomUUID } from "node:crypto";
const path = process.env.DB_PATH;
if (!path || !process.env.USER_EMAIL || !process.env.USER_PASSWORD)
  throw Error(
    "Укажите DB_PATH, USER_EMAIL, USER_PASSWORD; USER_ROLE, SCHOOL_ID, BRANCH_IDS, TEACHER_ID — дополнительные настройки",
  );
const store = new Store(path, process.argv.includes("--demo"));
try {
  const schoolId =
    process.env.SCHOOL_ID ||
    String(store.db.prepare("SELECT id FROM schools LIMIT 1").get()?.id);
  const s = store.read(schoolId);
  const role = (process.env.USER_ROLE || "admin") as Role;
  if (!["director", "admin", "teacher", "finance"].includes(role))
    throw Error("Неизвестная роль");
  const branchIds =
    process.env.BRANCH_IDS?.split(",") || s.branches.map((b) => b.id);
  if (branchIds.some((id) => !s.branches.some((b) => b.id === id)))
    throw Error("Неизвестный филиал");
  const teacherId = process.env.TEACHER_ID || "";
  if (
    role === "teacher" &&
    !s.teachers.some(
      (t) => t.id === teacherId && branchIds.includes(t.branchId),
    )
  )
    throw Error("Укажите доступный TEACHER_ID");
  store.addUser(
    {
      id: randomUUID(),
      schoolId,
      branchIds,
      teacherId,
      role,
      name: process.env.USER_NAME || "Сотрудник",
    },
    process.env.USER_EMAIL,
    process.env.USER_PASSWORD,
  );
  console.log("Аккаунт создан. Пароль не выводится.");
} finally {
  store.close();
}
