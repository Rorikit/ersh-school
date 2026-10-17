import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  StateSchema,
  UserSchema,
  type State,
  type User,
  type Session,
} from "../shared/model.ts";
import { seedSchool } from "./seed.ts";
import { applyCommand, DomainError, demand } from "./domain.ts";
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export function passwordHash(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
const missingUserHash = passwordHash(randomBytes(32).toString("hex"));
export class Store {
  db: DatabaseSync;
  demo: boolean;
  constructor(path: string, demo = false, now = new Date()) {
    this.demo = demo;
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path, { timeout: 5000 });
    const version = Number(
      this.db.prepare("PRAGMA user_version").get()?.user_version,
    );
    demand(
      version <= 1,
      "Версия базы новее сервера. Миграция не выполнялась",
      503,
    );
    this.db.exec(
      `PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS schools(id TEXT PRIMARY KEY,payload TEXT NOT NULL);CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,payload TEXT NOT NULL);CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id));CREATE TABLE IF NOT EXISTS requests(school_id TEXT NOT NULL,request_id TEXT NOT NULL,fingerprint TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(school_id,request_id)); PRAGMA user_version=1;`,
    );
    const count = this.db
      .prepare("SELECT COUNT(*) AS n FROM schools")
      .get() as { n: number };
    if (!count.n) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
      if (demo) {
        this.insertSchool(seedSchool("school-demo", true, now));
        this.insertSchool(seedSchool("school-other", true, now));
        for (const role of ["director", "admin", "teacher", "finance"] as const)
          this.addUser(
            {
              id: "user-" + role,
              name: {
                director: "Директор",
                admin: "Ольга Смирнова",
                teacher: "Дмитрий Соколов",
                finance: "Финансист",
              }[role],
              schoolId: "school-demo",
              branchIds: ["branch-school-demo"],
              role,
              teacherId: role === "teacher" ? "teacher-0" : "",
            },
            role + "@demo.local",
            "Demo-School-2026!",
          );
        this.addUser(
          {
            id: "user-other",
            name: "Другая школа",
            schoolId: "school-other",
            branchIds: ["branch-school-other"],
            role: "director",
            teacherId: "",
          },
          "other@demo.local",
          "Demo-School-2026!",
        );
      } else {
        demand(
          process.env.ADMIN_EMAIL &&
            process.env.ADMIN_PASSWORD &&
            process.env.ADMIN_PASSWORD.length >= 14,
          "Новая рабочая база: задайте ADMIN_EMAIL и ADMIN_PASSWORD (от 14 символов)",
          500,
        );
        const s = seedSchool(randomUUID(), false, now);
        this.insertSchool(s);
        this.addUser(
          {
            id: randomUUID(),
            name: "Директор",
            schoolId: s.school.id,
            branchIds: s.branches.map((b) => b.id),
            role: "director",
            teacherId: "",
          },
          process.env.ADMIN_EMAIL!,
          process.env.ADMIN_PASSWORD!,
        );
      }
      this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        this.db.close();
        throw error;
      }
    }
    for (const row of this.db.prepare("SELECT payload FROM schools").all()) {
      const state = StateSchema.parse(JSON.parse(String(row.payload)));
      demand(
        state.demo === demo,
        "Режим базы отличается от режима сервера. Используйте отдельный DB_PATH",
        500,
      );
    }
  }
  insertSchool(s: State) {
    this.db
      .prepare("INSERT INTO schools VALUES(?,?)")
      .run(s.school.id, JSON.stringify(StateSchema.parse(s)));
  }
  addUser(user: User, email: string, password: string) {
    demand(password.length >= 14, "Пароль слишком короткий");
    demand(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Некорректный email");
    UserSchema.parse(user);
    this.db
      .prepare("INSERT INTO users VALUES(?,?,?,?)")
      .run(
        user.id,
        email.toLowerCase(),
        passwordHash(password),
        JSON.stringify(user),
      );
  }
  read(schoolId: string): State {
    const row = this.db
      .prepare("SELECT payload FROM schools WHERE id=?")
      .get(schoolId);
    demand(row, "Школа не найдена", 404);
    try {
      return StateSchema.parse(JSON.parse(String(row.payload)));
    } catch {
      throw new DomainError(
        503,
        "Хранилище повреждено или версия не поддерживается. Восстановите резервную копию; данные не сброшены",
      );
    }
  }
  login(email: string, password: string): { token: string; session: Session } {
    const row = this.db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(email.toLowerCase());
    const stored = String(row?.password || missingUserHash);
    const [salt, key] = stored.split(":");
    const actual = scryptSync(password, salt, 64);
    demand(
      row && timingSafeEqual(actual, Buffer.from(key, "hex")),
      "Неверный логин или пароль",
      401,
    );
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(24).toString("hex"),
      expiresAt = Date.now() + 8 * 3600000;
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
      .run(hash(token), String(row.id), csrf, expiresAt);
    return {
      token,
      session: {
        user: UserSchema.parse(JSON.parse(String(row.payload))),
        csrf,
        demo: this.demo,
        expiresAt,
      },
    };
  }
  session(token: string): Session {
    const row = this.db
      .prepare(
        "SELECT s.csrf,s.expires,u.payload FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?",
      )
      .get(hash(token));
    demand(
      row && Number(row.expires) > Date.now(),
      "Войдите в приложение",
      401,
    );
    return {
      user: UserSchema.parse(JSON.parse(String(row.payload))),
      csrf: String(row.csrf),
      expiresAt: Number(row.expires),
      demo: this.demo,
    };
  }
  logout(token: string) {
    this.db.prepare("DELETE FROM sessions WHERE token=?").run(hash(token));
  }
  command(
    user: User,
    input: unknown,
    requestId: string,
    revision: number,
    now = new Date(),
  ) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const fp = hash(JSON.stringify({ userId: user.id, input }));
      const old = this.db
        .prepare(
          "SELECT fingerprint,response FROM requests WHERE school_id=? AND request_id=?",
        )
        .get(user.schoolId, requestId);
      if (old) {
        demand(
          old.fingerprint === fp,
          "Ключ операции уже использован для другого запроса",
          409,
        );
        this.db.exec("COMMIT");
        return JSON.parse(String(old.response)) as {
          revision: number;
          entityId: string;
          replayed: boolean;
        };
      }
      const state = this.read(user.schoolId);
      demand(
        state.revision === revision,
        "Данные изменены другим сотрудником. Обновите данные и повторите действие",
        409,
      );
      const result = applyCommand(state, input, user, requestId, now);
      const response = { ...result, revision: state.revision, replayed: false };
      this.db
        .prepare("UPDATE schools SET payload=? WHERE id=?")
        .run(JSON.stringify(StateSchema.parse(state)), user.schoolId);
      this.db
        .prepare("INSERT INTO requests VALUES(?,?,?,?)")
        .run(
          user.schoolId,
          requestId,
          fp,
          JSON.stringify({ ...response, replayed: true }),
        );
      this.db.exec("COMMIT");
      return response;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
export function scoped(state: State, user: User): State {
  const s = structuredClone(state);
  const branch = user.branchIds;
  for (const key of [
    "rooms",
    "students",
    "representatives",
    "teachers",
    "groups",
    "enrollments",
    "lessons",
    "attendance",
    "tariffs",
    "subscriptions",
    "charges",
    "payments",
    "debits",
    "audit",
    "invoices",
    "calendar",
  ] as const) {
    (s[key] as { branchId: string }[]) = (
      s[key] as { branchId: string }[]
    ).filter((x) => branch.includes(x.branchId));
  }
  s.notificationReads = s.notificationReads.filter((x) => x.userId === user.id);
  s.branches = s.branches.filter((b) => branch.includes(b.id));
  if (user.role === "teacher") {
    s.lessons = s.lessons.filter((l) => l.teacherId === user.teacherId);
    s.groups = s.groups.filter(
      (g) =>
        g.teacherId === user.teacherId ||
        s.lessons.some((l) => l.groupId === g.id),
    );
    const groupIds = new Set(s.groups.map((g) => g.id));
    s.enrollments = s.enrollments.filter((e) => groupIds.has(e.groupId));
    const ids = new Set([
      ...s.enrollments.map((e) => e.studentId),
      ...s.lessons.flatMap((l) => l.studentIds),
    ]);
    s.students = s.students
      .filter((x) => ids.has(x.id))
      .map((x) => ({ ...x, contact: "" }));
    s.teachers = s.teachers
      .filter(
        (t) =>
          t.id === user.teacherId || s.groups.some((g) => g.teacherId === t.id),
      )
      .map((t) => ({
        ...t,
        contact: "",
        rateKopecks: t.id === user.teacherId ? t.rateKopecks : 0,
      }));
    s.attendance = s.attendance.filter((a) =>
      s.lessons.some((l) => l.id === a.lessonId),
    );
    s.representatives = [];
    s.payments = [];
    s.charges = [];
    s.subscriptions = [];
    s.tariffs = [];
    s.debits = [];
    s.audit = [];
    s.invoices = [];
  }
  return s;
}
