import { importStudents } from "./csv.ts";
import { TestAdapter, UnconfiguredAdapter } from "./integrations.ts";
import { allowed } from "../shared/permissions.ts";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  StateSchema,
  entitySchemas,
  Day,
  Money,
  Text,
  ID,
  LessonSchema,
  AttendanceStateSchema,
  SchoolSchema,
  notifications,
  subjectOfLesson,
  addDays,
  today,
  temporal,
  participantIds,
  remaining,
  outstanding,
  type State,
  type Command,
  type User,
  type Lesson,
  type Entity,
} from "../shared/model.ts";
export class DomainError extends Error {
  status: number;
  field: string;
  constructor(status: number, message: string, field = "") {
    super(message);
    this.status = status;
    this.field = field;
  }
}
export function demand(
  condition: unknown,
  message: string,
  status = 422,
  field = "",
): asserts condition {
  if (!condition) throw new DomainError(status, message, field);
}
const schemas = {
  "read-notification": z.object({
    type: z.literal("read-notification"),
    notificationId: ID,
  }),
  "import-students": z.object({
    type: z.literal("import-students"),
    csv: z.string().min(1).max(100000),
    branchId: ID,
  }),
  enroll: z.object({
    type: z.literal("enroll"),
    studentId: ID,
    groupId: ID,
    from: Day,
    through: z.union([Day, z.literal("")]),
    previousEnrollmentId: ID.optional(),
  }),
  withdraw: z.object({
    type: z.literal("withdraw"),
    enrollmentId: ID,
    through: Day,
  }),
  lesson: z.object({
    type: z.literal("lesson"),
    value: LessonSchema,
    before: LessonSchema.optional(),
    repeat: z.number().int().min(1).max(52).optional(),
    excludeDates: z.array(Day).max(52).optional(),
    scope: z.enum(["one", "future", "all"]).optional(),
  }),
  transition: z.object({
    type: z.literal("transition"),
    lessonId: ID,
    status: z.enum(["scheduled", "completed", "cancelled"]),
    reason: Text,
  }),
  attendance: z.object({
    type: z.literal("attendance"),
    lessonId: ID,
    entries: z
      .array(
        z.object({
          studentId: ID,
          state: AttendanceStateSchema,
          reason: z.string().max(500),
        }),
      )
      .max(100),
    before: z
      .array(
        z.object({
          studentId: ID,
          state: AttendanceStateSchema,
          reason: z.string().max(500),
        }),
      )
      .max(100)
      .optional(),
    reason: z.string().max(1000),
  }),
  issue: z.object({
    type: z.literal("issue"),
    studentId: ID,
    tariffId: ID,
    from: Day,
  }),
  payment: z.object({
    type: z.literal("payment"),
    studentId: ID,
    subscriptionId: ID,
    amountKopecks: Money.refine((n) => n > 0),
    date: Day,
    method: z.enum(["card", "cash", "transfer"]),
    comment: z.string().max(500),
  }),
  refund: z.object({
    type: z.literal("refund"),
    paymentId: ID,
    amountKopecks: Money.refine((n) => n > 0),
    reason: Text,
    date: Day,
  }),
  subscription: z.object({
    type: z.literal("subscription"),
    subscriptionId: ID,
    action: z.enum(["freeze", "unfreeze", "extend", "return"]),
    through: Day.optional(),
    reason: Text,
  }),
  invoice: z.object({
    type: z.literal("invoice"),
    studentId: ID,
    amountKopecks: Money.refine((n) => n > 0),
    dueDate: Day,
    text: Text,
    channel: z.enum(["email", "sms", "accounting", "payment"]),
  }),
  deliver: z.object({ type: z.literal("deliver"), invoiceId: ID }),
  settings: SchoolSchema.omit({ id: true }).extend({
    type: z.literal("settings"),
  }),
};
export function parseCommand(input: unknown): Command {
  const t = z.object({ type: z.string() }).parse(input).type;
  if (t === "save") {
    const v = z
      .object({
        type: z.literal("save"),
        entity: z.enum([
          "students",
          "representatives",
          "teachers",
          "groups",
          "branches",
          "rooms",
          "tariffs",
          "calendar",
        ]),
        value: z.unknown(),
        before: z.unknown().optional(),
      })
      .parse(input);
    return {
      ...v,
      value: entitySchemas[v.entity].parse(v.value),
      before: v.before ? entitySchemas[v.entity].parse(v.before) : undefined,
    };
  }
  demand(t in schemas, "Неизвестная команда");
  return schemas[t as keyof typeof schemas].parse(input) as Command;
}

function base(s: State, branchId: string) {
  return { id: randomUUID(), schoolId: s.school.id, branchId };
}
export function conflicts(s: State, l: Lesson) {
  const members = participantIds(s, l);
  return s.lessons.filter(
    (x) =>
      x.id !== l.id &&
      x.status !== "cancelled" &&
      l.status !== "cancelled" &&
      x.date === l.date &&
      x.start < l.end &&
      l.start < x.end &&
      (x.roomId === l.roomId ||
        x.teacherId === l.teacherId ||
        participantIds(s, x).some((id) => members.includes(id))),
  );
}
export function validateLesson(s: State, l: Lesson) {
  demand(l.start < l.end, "Окончание должно быть позже начала", 422, "end");
  const t = s.teachers.find((x) => x.id === l.teacherId),
    r = s.rooms.find((x) => x.id === l.roomId);
  demand(
    t && t.active && t.branchId === l.branchId,
    "Преподаватель не найден в филиале",
    422,
    "teacherId",
  );
  demand(
    r && r.branchId === l.branchId,
    "Кабинет не найден в филиале",
    422,
    "roomId",
  );
  demand(
    l.start >= t.workStart &&
      l.end <= t.workEnd &&
      !t.unavailable.includes(l.date),
    "Преподаватель недоступен в указанное время",
    409,
    "teacherId",
  );
  demand(
    !s.calendar.some(
      (x) =>
        x.date === l.date &&
        x.branchId === l.branchId &&
        (!x.roomId || x.roomId === l.roomId),
    ),
    "Дата или кабинет закрыты календарём школы",
    409,
    "date",
  );
  if (l.type === "group")
    demand(
      s.groups.some(
        (g) => g.id === l.groupId && g.branchId === l.branchId && !g.archived,
      ),
      "Группа не найдена",
      422,
      "groupId",
    );
  else
    demand(
      l.studentIds.length === 1 && !l.groupId,
      "Для индивидуального занятия укажите одного ученика",
      422,
      "studentIds",
    );
  if (l.type === "makeup") {
    const source = s.lessons.find(
      (x) => x.id === l.makeupForLessonId && x.branchId === l.branchId,
    );
    demand(
      source &&
        source.type !== "makeup" &&
        source.date <= l.date &&
        participantIds(s, source).includes(l.studentIds[0]),
      "Укажите исходное занятие ученика для отработки",
      422,
      "makeupForLessonId",
    );
    demand(
      source.status === "cancelled" ||
        s.attendance.some(
          (a) =>
            a.lessonId === source.id &&
            a.studentId === l.studentIds[0] &&
            ["sick", "excused"].includes(a.state),
        ),
      "Отработка допускается после отмены, болезни или уважительного пропуска",
      409,
    );
    demand(
      !s.lessons.some(
        (x) =>
          x.id !== l.id &&
          x.type === "makeup" &&
          x.makeupForLessonId === source.id &&
          x.studentIds[0] === l.studentIds[0] &&
          x.status !== "cancelled",
      ),
      "Отработка этого пропуска уже назначена",
      409,
    );
  }
  const ids = participantIds(s, l);
  demand(
    ids.every((id) =>
      s.students.some(
        (x) => x.id === id && x.branchId === l.branchId && !x.archived,
      ),
    ),
    "Участник недоступен",
    422,
    "studentIds",
  );
  demand(
    ids.length <= r.capacity,
    "Вместимость кабинета превышена",
    409,
    "roomId",
  );
  const collision = conflicts(s, l);
  demand(
    !collision.length,
    "Пересечение кабинета, преподавателя или ученика: " +
      collision.map((x) => x.title + " " + x.start + "–" + x.end).join(", "),
    409,
    "start",
  );
}
export function applyCommand(
  s: State,
  input: unknown,
  user: User,
  requestId: string,
  now = new Date(),
): { entityId: string } {
  const c = parseCommand(input);
  demand(user.schoolId === s.school.id, "Доступ к школе запрещён", 403);
  demand(
    allowed(user, c.type, c.type === "save" ? c.entity : undefined),
    "Недостаточно полномочий",
    403,
  );
  const before = structuredClone(s);
  let entityId = s.school.id;
  const ref = <T extends { id: string; schoolId: string; branchId: string }>(
    items: T[],
    id: string,
  ) => {
    const found = items.find((x) => x.id === id);
    demand(
      found &&
        found.schoolId === user.schoolId &&
        user.branchIds.includes(found.branchId),
      "Объект не найден или недоступен",
      404,
    );
    return found;
  };
  const openDate = (date: string, reason = "") => {
    if (date <= s.school.closedThrough)
      demand(
        user.role === "director" && reason.trim().length > 0,
        "Период закрыт. Нужны права директора и основание",
        403,
      );
  };
  const reverseDebits = (lessonId: string, studentId?: string) => {
    const affected = new Set<string>();
    for (const debit of [...s.debits].filter(
      (d) =>
        d.lessonId === lessonId &&
        (!studentId || d.studentId === studentId) &&
        d.units === 1 &&
        !s.debits.some((r) => r.reverses === d.id),
    )) {
      s.debits.push({
        ...debit,
        ...base(s, debit.branchId),
        units: -1,
        reverses: debit.id,
        reason: "Корректировка посещаемости / отмена",
      });
      affected.add(debit.subscriptionId);
    }
    for (const id of affected) {
      const sub = s.subscriptions.find((x) => x.id === id)!;
      if (sub.closed) {
        const target = Math.floor(
          (sub.priceKopecks * remaining(s, id)) / sub.granted,
        );
        const credited = s.charges
          .filter((x) => x.subscriptionId === id && x.kind === "credit")
          .reduce((a, x) => a + x.amountKopecks, 0);
        if (target > credited)
          s.charges.push({
            ...base(s, sub.branchId),
            studentId: sub.studentId,
            subscriptionId: id,
            amountKopecks: target - credited,
            date: today(s.school.timezone, now),
            dueDate: today(s.school.timezone, now),
            kind: "credit",
            reverses: s.charges.find(
              (x) => x.subscriptionId === id && x.kind === "charge",
            )!.id,
            reason: "Корректировка закрытой посещаемости после возврата",
          });
      }
    }
  };
  switch (c.type) {
    case "read-notification": {
      const n = notifications(s, now).find((x) => x.id === c.notificationId);
      demand(n, "Событие уже разрешено", 409);
      if (n.lessonId) {
        const l = ref(s.lessons, n.lessonId);
        demand(
          user.role !== "teacher" || l.teacherId === user.teacherId,
          "Событие недоступно",
          403,
        );
      }
      if (n.studentId) {
        ref(s.students, n.studentId);
        demand(user.role !== "teacher", "Финансовое событие недоступно", 403);
      }
      if (
        !s.notificationReads.some(
          (x) => x.userId === user.id && x.notificationId === n.id,
        )
      )
        s.notificationReads.push({
          ...base(s, user.branchIds[0]),
          userId: user.id,
          notificationId: n.id,
          at: now.toISOString(),
        });
      entityId = n.id;
      break;
    }
    case "import-students": {
      demand(user.branchIds.includes(c.branchId), "Филиал недоступен", 403);
      const rows = importStudents(c.csv, s.school.id, c.branchId, requestId);
      for (const value of rows)
        applyCommand(
          s,
          { type: "save", entity: "students", value },
          user,
          requestId + "-" + value.id,
          now,
        );
      entityId = rows[0].id;
      break;
    }
    case "save": {
      const value = entitySchemas[c.entity].parse(c.value);
      demand(value.schoolId === s.school.id, "Подмена школы запрещена", 403);
      if ("branchId" in value)
        demand(
          user.branchIds.includes(value.branchId) &&
            s.branches.some((b) => b.id === value.branchId),
          "Филиал недоступен",
          403,
        );
      else
        demand(user.role === "director", "Только директор меняет филиалы", 403);
      const list = s[c.entity] as { id: string }[];
      const existing = list.find((x) => x.id === value.id);
      if (existing && c.before)
        Object.assign(value, mergeChanges(existing, value, c.before));
      if (existing && "branchId" in existing)
        demand(
          user.branchIds.includes(String(existing.branchId)),
          "Объект недоступен",
          403,
        );
      if (c.entity === "students") {
        const v = value as State["students"][number];
        demand(
          !s.students.some(
            (x) =>
              x.id !== v.id &&
              x.name.toLocaleLowerCase() === v.name.toLocaleLowerCase() &&
              x.birthDate === v.birthDate &&
              x.branchId === v.branchId,
          ),
          "Ученик с таким именем и датой рождения уже существует",
          409,
          "name",
        );
        if (v.archived)
          demand(
            !s.lessons.some(
              (l) =>
                l.status === "scheduled" && participantIds(s, l).includes(v.id),
            ),
            "Сначала отмените или перенесите незакрытые занятия ученика",
            409,
          );
        if (v.archived)
          demand(
            !s.enrollments.some(
              (e) =>
                e.studentId === v.id &&
                (!e.through || e.through >= today(s.school.timezone, now)),
            ),
            "Сначала завершите действующие записи в группы",
            409,
          );
      }
      if (c.entity === "rooms") {
        const v = value as State["rooms"][number];
        demand(
          !s.lessons.some(
            (l) =>
              l.roomId === v.id &&
              l.status === "scheduled" &&
              participantIds(s, l).length > v.capacity,
          ),
          "Вместимость меньше состава незакрытого занятия",
          409,
          "capacity",
        );
      }
      if (c.entity === "representatives") {
        const v = value as State["representatives"][number];
        const student = ref(s.students, v.studentId);
        demand(
          student.branchId === v.branchId,
          "Представитель из другого филиала",
        );
      }
      if (c.entity === "teachers") {
        const v = value as State["teachers"][number];
        demand(
          v.workStart < v.workEnd,
          "Конец рабочего дня должен быть позже начала",
          422,
          "workEnd",
        );
      }
      if (c.entity === "groups") {
        const v = value as State["groups"][number];
        demand(
          ref(s.teachers, v.teacherId).branchId === v.branchId,
          "Преподаватель из другого филиала",
        );
        demand(
          v.capacity >=
            s.enrollments.filter((e) => e.groupId === v.id && !e.through)
              .length,
          "Вместимость меньше текущего состава",
        );
      }
      if (existing) Object.assign(existing, value);
      else list.push(value);
      entityId = value.id;
      break;
    }
    case "enroll": {
      openDate(c.from);
      const student = ref(s.students, c.studentId),
        group = ref(s.groups, c.groupId);
      demand(
        student.branchId === group.branchId &&
          !student.archived &&
          !group.archived,
        "Архивные объекты или другой филиал",
      );
      demand(!c.through || c.through >= c.from, "Дата окончания раньше начала");
      const duplicate = s.enrollments.find(
        (e) =>
          e.studentId === c.studentId &&
          e.groupId === c.groupId &&
          (!e.through || e.through >= c.from) &&
          (!c.through || e.from <= c.through),
      );
      if (duplicate) {
        entityId = duplicate.id;
        break;
      }
      demand(
        !s.lessons.some(
          (l) =>
            l.groupId === c.groupId &&
            l.date >= c.from &&
            (!c.through || l.date <= c.through) &&
            (l.status === "completed" || l.date <= s.school.closedThrough),
        ),
        "Дата записи затрагивает закрытую историю. Выберите дату после проведённых занятий",
        409,
        "from",
      );
      const existingEnrollments = s.enrollments.filter(
        (e) => e.groupId === group.id,
      );
      const points = [
        c.from,
        ...existingEnrollments
          .filter(
            (e) => e.from >= c.from && (!c.through || e.from <= c.through),
          )
          .map((e) => e.from),
      ];
      demand(
        points.every(
          (point) =>
            new Set(
              existingEnrollments
                .filter(
                  (e) => e.from <= point && (!e.through || e.through >= point),
                )
                .map((e) => e.studentId),
            ).size < group.capacity,
        ),
        "В группе нет свободных мест на выбранном интервале",
        409,
      );
      if (c.previousEnrollmentId) {
        const previous = ref(s.enrollments, c.previousEnrollmentId);
        demand(
          previous.studentId === student.id,
          "Запись принадлежит другому ученику",
        );
        demand(
          c.from > previous.from,
          "Дата перевода должна быть позже начала предыдущей записи",
        );
        demand(
          !s.lessons.some(
            (l) =>
              l.groupId === previous.groupId &&
              l.date >= c.from &&
              l.status === "completed",
          ),
          "Перевод изменяет закрытые занятия",
          409,
        );
        previous.through = addDays(c.from, -1);
      }
      const e = {
        ...base(s, group.branchId),
        studentId: student.id,
        groupId: group.id,
        from: c.from,
        through: c.through,
      };
      s.enrollments.push(e);
      entityId = e.id;
      for (const l of s.lessons.filter(
        (l) =>
          l.date >= c.from &&
          l.status === "scheduled" &&
          participantIds(s, l).includes(student.id),
      ))
        validateLesson(s, l);
      break;
    }
    case "withdraw": {
      const e = ref(s.enrollments, c.enrollmentId);
      demand(c.through >= e.from, "Окончание записи раньше начала");
      demand(
        !s.lessons.some(
          (l) =>
            l.groupId === e.groupId &&
            l.date > c.through &&
            l.status === "completed",
        ),
        "Отчисление изменяет закрытые занятия",
        409,
      );
      e.through = c.through;
      entityId = e.id;
      break;
    }
    case "lesson": {
      let l = LessonSchema.parse(c.value);
      demand(
        l.schoolId === s.school.id && user.branchIds.includes(l.branchId),
        "Филиал недоступен",
        403,
      );
      ref(s.teachers, l.teacherId);
      ref(s.rooms, l.roomId);
      if (l.groupId) ref(s.groups, l.groupId);
      l.studentIds.forEach((id) => ref(s.students, id));
      openDate(l.date);
      const old = s.lessons.find((x) => x.id === l.id);
      if (old) {
        if (c.before) l = mergeChanges(old, l, c.before) as Lesson;
        ref(s.lessons, old.id);
        demand(
          old.status === "scheduled" && l.status === "scheduled",
          "Реквизиты закрытого или отменённого занятия нельзя изменять",
          409,
        );
        openDate(old.date);
      } else
        demand(
          l.status === "scheduled",
          "Новое занятие должно быть запланировано",
        );
      if (
        !old ||
        l.groupId !== old.groupId ||
        (l.type !== "group" && l.title !== old.title)
      )
        l.subject =
          s.groups.find((g) => g.id === l.groupId)?.subject || l.title;
      const targets =
        old?.seriesId && c.scope && c.scope !== "one"
          ? s.lessons.filter(
              (x) =>
                x.seriesId === old.seriesId &&
                (c.scope === "all" || x.date >= old.date),
            )
          : old
            ? [old]
            : [];
      demand(
        !targets.some((x) => x.status !== "scheduled"),
        "Серия содержит закрытые занятия. Выберите только будущее",
        409,
      );
      if (targets.length > 1) {
        const delta = Math.round(
          (Date.parse(l.date) - Date.parse(old!.date)) / 86400000,
        );
        const candidate = {
          ...s,
          lessons: s.lessons.filter((x) => !targets.some((t) => t.id === x.id)),
        };
        for (const target of targets) {
          const moved = {
            ...l,
            id: target.id,
            date: addDays(target.date, delta),
            seriesId: target.seriesId,
          };
          openDate(moved.date);
          validateLesson(candidate, moved);
          candidate.lessons.push(moved);
        }
        s.lessons = candidate.lessons;
        entityId = l.id;
        break;
      }
      const repeat = c.repeat || 1;
      demand(
        !c.excludeDates?.includes(l.date),
        "Нельзя исключить первое занятие серии",
      );
      demand(
        !old || repeat === 1,
        "Для существующего занятия повтор не создаётся",
      );
      l = { ...l, seriesId: repeat > 1 ? randomUUID() : l.seriesId };
      for (let i = 0; i < repeat; i++) {
        const next = {
          ...l,
          id: i === 0 ? l.id : randomUUID(),
          date: addDays(l.date, i * 7),
        };
        if (c.excludeDates?.includes(next.date)) continue;
        openDate(next.date);
        validateLesson(s, next);
        if (old && i === 0) Object.assign(old, next);
        else s.lessons.push(next);
      }
      entityId = l.id;
      break;
    }
    case "transition": {
      const l = ref(s.lessons, c.lessonId);
      openDate(l.date, c.reason);
      demand(l.status !== c.status, "Этот переход уже выполнен", 409);
      if (c.status === "completed") {
        demand(
          l.status === "scheduled" && temporal(l, s, now) === "past",
          "Завершить можно только закончившееся занятие",
          409,
        );
        demand(
          participantIds(s, l).every((id) =>
            s.attendance.some(
              (a) =>
                a.lessonId === l.id &&
                a.studentId === id &&
                a.state !== "unmarked",
            ),
          ),
          "Сначала отметьте всех учеников",
          409,
        );
      }
      if (c.status === "scheduled") {
        demand(
          l.status === "cancelled",
          "Восстановить можно только отменённое занятие",
          409,
        );
        validateLesson(s, { ...l, status: "scheduled" });
      }
      if (l.status === "completed")
        demand(
          user.role === "director" && c.status === "cancelled",
          "Закрытое занятие отменяет только директор",
          403,
        );
      if (c.status === "cancelled") reverseDebits(l.id);
      l.status = c.status;
      l.reason = c.reason;
      entityId = l.id;
      break;
    }
    case "attendance": {
      const l = ref(s.lessons, c.lessonId);
      demand(
        user.role !== "teacher" || user.teacherId === l.teacherId,
        "Это занятие другого преподавателя",
        403,
      );
      demand(
        l.status !== "cancelled",
        "Нельзя отмечать отменённое занятие",
        409,
      );
      demand(
        temporal(l, s, now) === "past",
        "Посещаемость доступна после окончания занятия",
        409,
      );
      openDate(l.date, c.reason);
      if (l.status === "completed")
        demand(
          c.reason.trim().length > 0,
          "Для исправления закрытой явки укажите основание",
          422,
          "reason",
        );
      const ids = participantIds(s, l);
      demand(
        c.entries.length === ids.length &&
          new Set(c.entries.map((e) => e.studentId)).size === ids.length &&
          c.entries.every((e) => ids.includes(e.studentId)),
        "Состав посещаемости не совпадает с записью на дату",
        409,
      );
      if (c.before)
        c.entries = c.entries.map((e) => {
          const actual = s.attendance.find(
            (a) => a.lessonId === l.id && a.studentId === e.studentId,
          );
          return mergeChanges(
            {
              studentId: e.studentId,
              state: actual?.state || "unmarked",
              reason: actual?.reason || "",
            },
            e,
            c.before!.find((a) => a.studentId === e.studentId) || {
              studentId: e.studentId,
              state: "unmarked",
              reason: "",
            },
          ) as typeof e;
        });
      for (const e of c.entries) {
        demand(
          !["sick", "excused"].includes(e.state) || e.reason.trim().length > 0,
          "Для болезни/уважительного пропуска укажите причину",
        );
        const previous = s.attendance.find(
          (a) => a.lessonId === l.id && a.studentId === e.studentId,
        );
        const active = s.debits.find(
          (d) =>
            d.lessonId === l.id &&
            d.studentId === e.studentId &&
            d.units === 1 &&
            !s.debits.some((r) => r.reverses === d.id),
        );
        const sub = active
          ? s.subscriptions.find((x) => x.id === active.subscriptionId)
          : s.subscriptions.find(
              (x) =>
                x.studentId === e.studentId &&
                !x.closed &&
                !x.frozen &&
                x.from <= l.date &&
                x.through >= l.date &&
                x.subject === subjectOfLesson(s, l) &&
                remaining(s, x.id) > 0 &&
                outstanding(s, x.id) <= 0,
            );
        if (e.state === "absent")
          demand(
            sub,
            "Для пропуска нужен действующий абонемент с определённым правилом",
            409,
          );
        const charge =
          e.state === "present" || (e.state === "absent" && sub?.chargeAbsence);
        if (charge && !active) {
          demand(
            sub,
            "Нет оплаченного действующего абонемента с остатком",
            409,
          );
          s.debits.push({
            ...base(s, l.branchId),
            lessonId: l.id,
            studentId: e.studentId,
            subscriptionId: sub.id,
            units: 1,
            reverses: "",
            reason: e.reason,
          });
        } else if (!charge && active) reverseDebits(l.id, e.studentId);
        if (previous)
          Object.assign(previous, { state: e.state, reason: e.reason });
        else
          s.attendance.push({
            ...base(s, l.branchId),
            lessonId: l.id,
            studentId: e.studentId,
            state: e.state,
            reason: e.reason,
          });
      }
      if (c.entries.length && c.entries.every((e) => e.state !== "unmarked"))
        l.status = "completed";
      entityId = l.id;
      break;
    }
    case "issue": {
      openDate(c.from);
      const student = ref(s.students, c.studentId),
        tariff = ref(s.tariffs, c.tariffId);
      demand(
        student.branchId === tariff.branchId && !student.archived,
        "Тариф недоступен для ученика",
      );
      const sub = {
        ...base(s, student.branchId),
        studentId: student.id,
        tariffId: tariff.id,
        from: c.from,
        through: addDays(c.from, tariff.validDays - 1),
        frozen: false,
        closed: false,
        granted: tariff.lessons,
        priceKopecks: tariff.priceKopecks,
        subject: tariff.subject,
        chargeAbsence: tariff.chargeAbsence,
      };
      s.subscriptions.push(sub);
      s.charges.push({
        ...base(s, student.branchId),
        studentId: student.id,
        subscriptionId: sub.id,
        amountKopecks: tariff.priceKopecks,
        date: c.from,
        dueDate: c.from,
        kind: "charge",
        reverses: "",
        reason: "Выдача абонемента",
      });
      entityId = sub.id;
      break;
    }
    case "payment": {
      const sub = ref(s.subscriptions, c.subscriptionId);
      demand(
        sub.studentId === ref(s.students, c.studentId).id,
        "Абонемент другого ученика",
      );
      openDate(c.date, c.comment);
      demand(
        c.amountKopecks <= outstanding(s, sub.id),
        "Сумма превышает долг по абонементу",
        409,
        "amountKopecks",
      );
      const p = {
        ...base(s, sub.branchId),
        ...c,
        kind: "payment" as const,
        reverses: "",
      };
      s.payments.push(p);
      entityId = p.id;
      break;
    }
    case "refund": {
      const payment = ref(s.payments, c.paymentId);
      demand(payment.kind === "payment", "Возврат только исходной оплаты");
      const returned = s.payments
        .filter((x) => x.reverses === payment.id)
        .reduce((a, x) => a + x.amountKopecks, 0);
      demand(
        c.amountKopecks <= payment.amountKopecks - returned,
        "Возврат превышает исходную оплату",
        409,
      );
      demand(
        c.amountKopecks <= -outstanding(s, payment.subscriptionId),
        "Сначала оформите возврат неиспользованного остатка абонемента",
        409,
      );
      openDate(c.date, c.reason);
      const refund = {
        ...payment,
        ...base(s, payment.branchId),
        kind: "refund" as const,
        reverses: payment.id,
        amountKopecks: c.amountKopecks,
        date: c.date,
        comment: c.reason,
      };
      s.payments.push(refund);
      entityId = refund.id;
      break;
    }
    case "subscription": {
      const sub = ref(s.subscriptions, c.subscriptionId);
      demand(!sub.closed, "Абонемент уже закрыт", 409);
      if (c.action === "freeze") sub.frozen = true;
      if (c.action === "unfreeze") sub.frozen = false;
      if (c.action === "extend") {
        demand(
          c.through && c.through > sub.through,
          "Новая дата должна продлевать срок",
        );
        sub.through = c.through;
      }
      if (c.action === "return") {
        openDate(today(s.school.timezone, now), c.reason);
        const amount = Math.floor(
          (sub.priceKopecks * remaining(s, sub.id)) / sub.granted,
        );
        demand(amount > 0, "Нет неиспользованного остатка", 409);
        s.charges.push({
          ...base(s, sub.branchId),
          studentId: sub.studentId,
          subscriptionId: sub.id,
          amountKopecks: amount,
          date: today(s.school.timezone, now),
          dueDate: today(s.school.timezone, now),
          kind: "credit",
          reverses: s.charges.find(
            (c) => c.subscriptionId === sub.id && c.kind === "charge",
          )!.id,
          reason: c.reason,
        });
        sub.closed = true;
      }
      entityId = sub.id;
      break;
    }
    case "invoice": {
      const student = ref(s.students, c.studentId);
      const invoice = {
        ...base(s, student.branchId),
        ...c,
        number: "СЧ-" + String(s.invoices.length + 1).padStart(6, "0"),
        state: "draft" as const,
        externalId: "",
      };
      s.invoices.push(invoice);
      entityId = invoice.id;
      break;
    }
    case "deliver": {
      const invoice = ref(s.invoices, c.invoiceId);
      demand(
        invoice.state === "draft",
        "Тестовая обработка уже выполнена",
        409,
      );
      const result = (
        s.demo ? new TestAdapter() : new UnconfiguredAdapter()
      ).accept({
        idempotencyKey: requestId,
        channel: invoice.channel,
        documentId: invoice.id,
      });
      invoice.state = result.status;
      invoice.externalId = result.externalId;
      entityId = invoice.id;
      break;
    }
    case "settings": {
      demand(c.closedThrough <= today(s.school.timezone, now), "Нельзя закрыть будущий период");
      demand(
        c.closedThrough >= s.school.closedThrough,
        "Открытие закрытого периода не поддерживается",
      );
      s.school = { ...s.school, ...c };
      break;
    }
  }
  s.revision++;
  StateSchema.parse(s);
  s.audit.push({
    ...base(s, user.branchIds[0]),
    actorId: user.id,
    at: now.toISOString(),
    action: c.type + (c.type === "save" ? ":" + c.entity : ""),
    entityId,
    before: auditSnapshot(before, entityId, user.branchIds),
    after: { entity: auditSnapshot(s, entityId, user.branchIds), command: c },
    reason: "reason" in c ? c.reason : "",
    requestId,
  });
  return { entityId };
}

function auditSnapshot(s: State, id: string, branchIds: string[]) {
  return {
    revision: s.revision,
    records: Object.fromEntries(
      Object.entries(s)
        .filter(([k, v]) => Array.isArray(v) && k !== "audit")
        .map(([k, v]) => [
          k,
          (
            v as {
              id: string;
              lessonId?: string;
              subscriptionId?: string;
              branchId?: string;
            }[]
          ).filter(
            (x) =>
              (!x.branchId || branchIds.includes(x.branchId)) &&
              (x.id === id || x.lessonId === id || x.subscriptionId === id),
          ),
        ]),
    ),
  };
}

function mergeChanges(
  current: object,
  incoming: object,
  original: unknown,
): object {
  const before = original as Record<string, unknown>,
    next = incoming as Record<string, unknown>,
    actual = current as Record<string, unknown>,
    result = { ...actual };
  for (const key of Object.keys(next)) {
    if (JSON.stringify(next[key]) !== JSON.stringify(before[key])) {
      demand(
        JSON.stringify(actual[key]) === JSON.stringify(before[key]) ||
          JSON.stringify(actual[key]) === JSON.stringify(next[key]),
        "Поле " +
          key +
          " изменено другим сотрудником. Актуальное значение: " +
          JSON.stringify(actual[key]) +
          ". Сравните изменения и откройте запись заново.",
        409,
        key,
      );
      result[key] = next[key];
    }
  }
  return result;
}
