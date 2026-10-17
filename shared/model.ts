import { z } from "zod";
import { ru } from "zod/locales";
z.config(ru());
export const ID = z.string().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Недопустимый ID");
export const Text = z.string().trim().min(1).max(200);
export const Day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
    "Некорректная дата",
  );
export const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const Money = z.number().int().min(0).max(100_000_000_00);
const base = { id: ID, schoolId: ID, branchId: ID };
export const SchoolSchema = z.object({
  id: ID,
  name: Text,
  timezone: z.string().refine((s) => {
    try {
      new Intl.DateTimeFormat("ru", { timeZone: s });
      return true;
    } catch {
      return false;
    }
  }),
  academicYear: Text,
  closedThrough: z.union([Day, z.literal("")]),
});
export const BranchSchema = z.object({ id: ID, schoolId: ID, name: Text });
export const RoomSchema = z.object({
  ...base,
  name: Text,
  capacity: z.number().int().min(1).max(500),
});
export const StudentSchema = z.object({
  ...base,
  name: Text,
  birthDate: z.union([Day, z.literal("")]),
  contact: z.string().max(200),
  archived: z.boolean(),
});
export const RepresentativeSchema = z.object({
  ...base,
  studentId: ID,
  name: Text,
  contact: Text,
  channel: z.enum(["phone", "email", "none"]),
});
export const TeacherSchema = z.object({
  ...base,
  name: Text,
  contact: z.string().max(200),
  subject: Text,
  active: z.boolean(),
  workStart: Time,
  workEnd: Time,
  unavailable: z.array(Day),
  rateKopecks: Money,
});
export const GroupSchema = z.object({
  ...base,
  name: Text,
  subject: Text,
  teacherId: ID,
  capacity: z.number().int().min(1).max(100),
  archived: z.boolean(),
});
export const EnrollmentSchema = z.object({
  ...base,
  studentId: ID,
  groupId: ID,
  from: Day,
  through: z.union([Day, z.literal("")]),
});
export const LessonSchema = z.object({
  ...base,
  title: Text,
  type: z.enum(["group", "individual", "makeup"]),
  groupId: z.union([ID, z.literal("")]),
  studentIds: z.array(ID).max(100),
  teacherId: ID,
  roomId: ID,
  date: Day,
  start: Time,
  end: Time,
  status: z.enum(["scheduled", "completed", "cancelled"]),
  reason: z.string().max(1000),
  seriesId: z.string().max(80),
  subject: z.string().max(200).optional(),
  makeupForLessonId: z.string().max(80).optional(),
});
export const AttendanceStateSchema = z.enum([
  "present",
  "absent",
  "sick",
  "excused",
  "unmarked",
]);
export const AttendanceSchema = z.object({
  ...base,
  lessonId: ID,
  studentId: ID,
  state: AttendanceStateSchema,
  reason: z.string().max(500),
});
export const TariffSchema = z.object({
  ...base,
  name: Text,
  kind: z.enum(["package", "period"]),
  priceKopecks: Money,
  lessons: z.number().int().min(1).max(1000),
  validDays: z.number().int().min(1).max(3660),
  subject: Text,
  chargeAbsence: z.boolean(),
});
export const SubscriptionSchema = z.object({
  ...base,
  studentId: ID,
  tariffId: ID,
  from: Day,
  through: Day,
  frozen: z.boolean(),
  closed: z.boolean(),
  granted: z.number().int().min(1).max(1000),
  priceKopecks: Money,
  subject: Text,
  chargeAbsence: z.boolean(),
});
export const ChargeSchema = z.object({
  ...base,
  studentId: ID,
  subscriptionId: ID,
  amountKopecks: Money,
  date: Day,
  dueDate: Day,
  kind: z.enum(["charge", "credit"]),
  reverses: z.string(),
  reason: z.string().max(500),
});
export const PaymentSchema = z.object({
  ...base,
  studentId: ID,
  subscriptionId: ID,
  amountKopecks: Money,
  date: Day,
  method: z.enum(["card", "cash", "transfer"]),
  kind: z.enum(["payment", "refund"]),
  reverses: z.string(),
  comment: z.string().max(500),
});
export const DebitSchema = z.object({
  ...base,
  lessonId: ID,
  studentId: ID,
  subscriptionId: ID,
  units: z.union([z.literal(1), z.literal(-1)]),
  reverses: z.string(),
  reason: z.string().max(500),
});
export const AuditSchema = z.object({
  ...base,
  actorId: ID,
  at: z.string(),
  action: Text,
  entityId: ID,
  before: z.unknown(),
  after: z.unknown(),
  reason: z.string().max(1000),
  requestId: ID,
});
export const InvoiceSchema = z.object({
  ...base,
  studentId: ID,
  number: Text,
  amountKopecks: Money,
  dueDate: Day,
  text: z.string().max(2000),
  state: z.enum(["draft", "test-accepted", "failed"]),
  channel: z.enum(["email", "sms", "accounting", "payment"]),
  externalId: z.string(),
});
export const CalendarSchema = z.object({
  ...base,
  date: Day,
  roomId: z.string(),
  reason: Text,
});
export const StateSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().min(0),
    demo: z.boolean(),
    school: SchoolSchema,
    branches: z.array(BranchSchema),
    rooms: z.array(RoomSchema),
    students: z.array(StudentSchema),
    representatives: z.array(RepresentativeSchema),
    teachers: z.array(TeacherSchema),
    groups: z.array(GroupSchema),
    enrollments: z.array(EnrollmentSchema),
    lessons: z.array(LessonSchema),
    attendance: z.array(AttendanceSchema),
    tariffs: z.array(TariffSchema),
    subscriptions: z.array(SubscriptionSchema),
    charges: z.array(ChargeSchema),
    payments: z.array(PaymentSchema),
    debits: z.array(DebitSchema),
    audit: z.array(AuditSchema),
    invoices: z.array(InvoiceSchema),
    calendar: z.array(CalendarSchema),
    notificationReads: z
      .array(
        z.object({ ...base, userId: ID, notificationId: ID, at: z.string() }),
      )
      .default([]),
  })
  .superRefine((s, ctx) => {
    const collections = [
      "branches",
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
    ] as const;
    const problem = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    for (const key of collections) {
      const rows = s[key];
      if (new Set(rows.map((x) => x.id)).size !== rows.length)
        problem("Повтор ID: " + key);
      for (const row of rows) {
        if (row.schoolId !== s.school.id) problem("Связь другой школы: " + key);
        if ("branchId" in row && !s.branches.some((b) => b.id === row.branchId))
          problem("Неизвестный филиал: " + key);
      }
    }
    const link = (
      rows: { id: string; branchId?: string }[],
      id: string,
      branchId: string,
    ) => {
      if (
        !rows.some(
          (x) => x.id === id && (!x.branchId || x.branchId === branchId),
        )
      )
        problem("Неверная ссылка на объект: " + id);
    };
    for (const g of s.groups) link(s.teachers, g.teacherId, g.branchId);
    for (const r of s.representatives)
      link(s.students, r.studentId, r.branchId);
    for (const e of s.enrollments) {
      link(s.students, e.studentId, e.branchId);
      link(s.groups, e.groupId, e.branchId);
    }
    for (const l of s.lessons) {
      link(s.teachers, l.teacherId, l.branchId);
      link(s.rooms, l.roomId, l.branchId);
      if (l.groupId) link(s.groups, l.groupId, l.branchId);
      l.studentIds.forEach((id) => link(s.students, id, l.branchId));
      if (l.start >= l.end) problem("Некорректный интервал занятия");
    }
    for (const a of s.attendance) {
      link(s.lessons, a.lessonId, a.branchId);
      link(s.students, a.studentId, a.branchId);
    }
    for (const sub of s.subscriptions) {
      link(s.students, sub.studentId, sub.branchId);
      link(s.tariffs, sub.tariffId, sub.branchId);
    }
    for (const x of [...s.charges, ...s.payments, ...s.debits]) {
      link(s.students, x.studentId, x.branchId);
      link(s.subscriptions, x.subscriptionId, x.branchId);
    }
    for (const d of s.debits) link(s.lessons, d.lessonId, d.branchId);
    for (const i of s.invoices) link(s.students, i.studentId, i.branchId);
    if (!Number.isSafeInteger([...s.charges, ...s.payments].reduce((sum, row) => sum + row.amountKopecks, 0))) problem("Денежный итог превышает точный диапазон");
    const reversed = new Set<string>();
    const active = new Set<string>();
    for (const debit of s.debits.filter(d => d.units === -1)) {
      const source = s.debits.find(d => d.id === debit.reverses && d.units === 1);
      if (!source || reversed.has(debit.reverses) || source.studentId !== debit.studentId || source.lessonId !== debit.lessonId || source.subscriptionId !== debit.subscriptionId) problem("Некорректная обратная операция списания");
      reversed.add(debit.reverses);
    }
    for (const debit of s.debits.filter(d => d.units === 1 && !reversed.has(d.id))) {
      const key = debit.lessonId + ":" + debit.studentId;
      if (active.has(key)) problem("Повтор активного списания");
      active.add(key);
    }
    for (const sub of s.subscriptions) {
      const units = s.debits.filter(d => d.subscriptionId === sub.id).reduce((sum,d) => sum+d.units,0);
      if (units < 0 || units > sub.granted) problem("Некорректный остаток абонемента");
    }
  });
export type State = z.infer<typeof StateSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type Student = z.infer<typeof StudentSchema>;
export type Teacher = z.infer<typeof TeacherSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
export type Attendance = z.infer<typeof AttendanceSchema>;
export type Role = "director" | "admin" | "teacher" | "finance";
export const UserSchema = z.object({
  id: ID,
  schoolId: ID,
  branchIds: z.array(ID).min(1),
  name: Text,
  role: z.enum(["director", "admin", "teacher", "finance"]),
  teacherId: z.string().max(80),
});
export type User = z.infer<typeof UserSchema>;
export interface Session {
  user: User;
  csrf: string;
  demo: boolean;
  expiresAt: number;
}
export type Entity =
  | "students"
  | "representatives"
  | "teachers"
  | "groups"
  | "branches"
  | "rooms"
  | "tariffs"
  | "calendar";
export const entitySchemas = {
  students: StudentSchema,
  representatives: RepresentativeSchema,
  teachers: TeacherSchema,
  groups: GroupSchema,
  branches: BranchSchema,
  rooms: RoomSchema,
  tariffs: TariffSchema,
  calendar: CalendarSchema,
};
export type Command =
  | { type: "save"; entity: Entity; value: unknown; before?: unknown }
  | {
      type: "enroll";
      studentId: string;
      groupId: string;
      from: string;
      through: string;
      previousEnrollmentId?: string;
    }
  | { type: "withdraw"; enrollmentId: string; through: string }
  | {
      type: "lesson";
      value: Lesson;
      before?: Lesson;
      repeat?: number;
      excludeDates?: string[];
      scope?: "one" | "future" | "all";
    }
  | {
      type: "transition";
      lessonId: string;
      status: Lesson["status"];
      reason: string;
    }
  | {
      type: "attendance";
      lessonId: string;
      entries: {
        studentId: string;
        state: Attendance["state"];
        reason: string;
      }[];
      before?: {
        studentId: string;
        state: Attendance["state"];
        reason: string;
      }[];
      reason: string;
    }
  | { type: "issue"; studentId: string; tariffId: string; from: string }
  | {
      type: "payment";
      studentId: string;
      subscriptionId: string;
      amountKopecks: number;
      date: string;
      method: "card" | "cash" | "transfer";
      comment: string;
    }
  | {
      type: "refund";
      paymentId: string;
      amountKopecks: number;
      reason: string;
      date: string;
    }
  | {
      type: "subscription";
      subscriptionId: string;
      action: "freeze" | "unfreeze" | "extend" | "return";
      through?: string;
      reason: string;
    }
  | {
      type: "invoice";
      studentId: string;
      amountKopecks: number;
      dueDate: string;
      text: string;
      channel: "email" | "sms" | "accounting" | "payment";
    }
  | { type: "deliver"; invoiceId: string }
  | { type: "import-students"; csv: string; branchId: string }
  | { type: "read-notification"; notificationId: string }
  | {
      type: "settings";
      name: string;
      timezone: string;
      academicYear: string;
      closedThrough: string;
    };
export const roleNames: Record<Role, string> = {
  director: "Директор",
  admin: "Администратор",
  teacher: "Преподаватель",
  finance: "Финансист",
};
export const attendanceNames: Record<Attendance["state"], string> = {
  present: "Присутствует",
  absent: "Отсутствует",
  sick: "Болеет",
  excused: "Уважительная причина",
  unmarked: "Не отмечено",
};
export const money = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(
    n / 100,
  );
export function parseMoney(s: string) {
  if (!/^\d{1,9}([.,]\d{1,2})?$/.test(s.trim()))
    throw Error("Сумма: не более двух знаков после запятой");
  const [a, b = ""] = s.trim().replace(",", ".").split(".");
  return Number(a) * 100 + Number(b.padEnd(2, "0"));
}
export function today(timezone = "Europe/Moscow", now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(day: string, n: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function clock(timezone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}
export function temporal(
  l: Lesson,
  s: State,
  now = new Date(),
): "past" | "live" | "future" {
  const d = today(s.school.timezone, now),
    t = clock(s.school.timezone, now);
  return l.date < d || (l.date === d && l.end <= t)
    ? "past"
    : l.date > d || l.start > t
      ? "future"
      : "live";
}
export function participantIds(s: State, l: Lesson) {
  if (l.type !== "group") return l.studentIds;
  return [
    ...new Set(
      s.enrollments
        .filter(
          (e) =>
            e.groupId === l.groupId &&
            e.from <= l.date &&
            (!e.through || e.through >= l.date),
        )
        .map((e) => e.studentId),
    ),
  ];
}
export function remaining(s: State, subscriptionId: string) {
  const sub = s.subscriptions.find((x) => x.id === subscriptionId);
  return (
    (sub?.granted || 0) -
    s.debits
      .filter((x) => x.subscriptionId === subscriptionId)
      .reduce((a, x) => a + x.units, 0)
  );
}
export function balance(s: State, studentId: string) {
  return (
    s.charges
      .filter((x) => x.studentId === studentId)
      .reduce(
        (a, x) =>
          a + (x.kind === "charge" ? x.amountKopecks : -x.amountKopecks),
        0,
      ) -
    s.payments
      .filter((x) => x.studentId === studentId)
      .reduce(
        (a, x) =>
          a + (x.kind === "payment" ? x.amountKopecks : -x.amountKopecks),
        0,
      )
  );
}
export function outstanding(s: State, subscriptionId: string) {
  return (
    s.charges
      .filter((x) => x.subscriptionId === subscriptionId)
      .reduce(
        (a, x) =>
          a + (x.kind === "charge" ? x.amountKopecks : -x.amountKopecks),
        0,
      ) -
    s.payments
      .filter((x) => x.subscriptionId === subscriptionId)
      .reduce(
        (a, x) =>
          a + (x.kind === "payment" ? x.amountKopecks : -x.amountKopecks),
        0,
      )
  );
}
export function metrics(s: State, date: string) {
  const ls = s.lessons.filter((l) => l.date === date);
  return {
    total: ls.length,
    completed: ls.filter((l) => l.status === "completed").length,
    scheduled: ls.filter((l) => l.status === "scheduled").length,
    cancelled: ls.filter((l) => l.status === "cancelled").length,
    present: s.attendance.filter(
      (a) => a.state === "present" && ls.some((l) => l.id === a.lessonId),
    ).length,
  };
}
export function notifications(s: State, now = new Date()) {
  return s.lessons
    .filter((l) => l.status !== "cancelled")
    .flatMap((l) => {
      const result: {
        id: string;
        kind: "attendance" | "teacher" | "debt";
        title: string;
        lessonId?: string;
        studentId?: string;
      }[] = [];
      if (
        (l.status === "completed" || temporal(l, s, now) === "past") &&
        participantIds(s, l).some(
          (id) =>
            !s.attendance.some(
              (a) =>
                a.lessonId === l.id &&
                a.studentId === id &&
                a.state !== "unmarked",
            ),
        )
      )
        result.push({
          id: "a" + l.id,
          kind: "attendance",
          title: "Не выставлена посещаемость: " + l.title,
          lessonId: l.id,
        });
      if (
        l.status === "scheduled" &&
        s.teachers.some(
          (t) =>
            t.id === l.teacherId &&
            (!t.active ||
              t.unavailable.includes(l.date) ||
              l.start < t.workStart ||
              l.end > t.workEnd),
        )
      )
        result.push({
          id: "t" + l.id,
          kind: "teacher",
          title: "Требуется замена: " + l.title,
          lessonId: l.id,
        });
      return result;
    })
    .concat(
      s.students
        .filter((x) => balance(s, x.id) > 0)
        .map((x) => ({
          id: "d" + x.id,
          kind: "debt" as const,
          title: "Задолженность: " + x.name,
          studentId: x.id,
        })),
    );
}

export function subjectOfLesson(s: State, l: Lesson) {
  const source =
    l.type === "makeup"
      ? s.lessons.find((x) => x.id === l.makeupForLessonId)
      : l;
  return (
    source?.subject ||
    s.groups.find((g) => g.id === source?.groupId)?.subject ||
    source?.title ||
    l.title
  );
}
export function balanceAt(s: State, studentId: string, date: string) {
  return (
    s.charges
      .filter((x) => x.studentId === studentId && x.date <= date)
      .reduce(
        (a, x) =>
          a + (x.kind === "charge" ? x.amountKopecks : -x.amountKopecks),
        0,
      ) -
    s.payments
      .filter((x) => x.studentId === studentId && x.date <= date)
      .reduce(
        (a, x) =>
          a + (x.kind === "payment" ? x.amountKopecks : -x.amountKopecks),
        0,
      )
  );
}
export function overdue(
  s: State,
  studentId: string,
  date = today(s.school.timezone),
) {
  return s.subscriptions
    .filter(
      (x) =>
        x.studentId === studentId &&
        s.charges.some(
          (c) =>
            c.subscriptionId === x.id &&
            c.kind === "charge" &&
            c.dueDate < date,
        ),
    )
    .reduce((a, x) => a + Math.max(0, outstanding(s, x.id)), 0);
}
export function retention(s: State, from: string, through: string) {
  const active = (day: string) =>
    new Set(
      s.enrollments
        .filter((e) => e.from <= day && (!e.through || e.through >= day))
        .map((e) => e.studentId),
    );
  const initial = active(from),
    final = active(through);
  return {
    initial: initial.size,
    retained: [...initial].filter((id) => final.has(id)).length,
    newStudents: [
      ...new Set(
        s.enrollments
          .filter((e) => e.from > from && e.from <= through)
          .map((e) => e.studentId),
      ),
    ].filter(
      (id) => !s.enrollments.some((e) => e.studentId === id && e.from <= from),
    ).length,
  };
}
