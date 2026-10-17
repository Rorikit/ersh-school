import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store.ts";
import { seedSchool } from "../server/seed.ts";
import { DomainError, conflicts, validateLesson } from "../server/domain.ts";
import {
  today,
  addDays,
  parseMoney,
  temporal,
  remaining,
  balance,
  outstanding,
  participantIds,
  StateSchema,
  type Command,
  type User,
  type Lesson,
} from "../shared/model.ts";
export const NOW = new Date("2026-10-18T12:00:00Z");
export const director: User = {
  id: "user-director",
  name: "Директор",
  role: "director",
  schoolId: "school-demo",
  branchIds: ["branch-school-demo"],
  teacherId: "",
};
function fixture() {
  const db = new Store(":memory:", true, NOW);
  let counter = 0;
  return {
    db,
    s: () => db.read(director.schoolId),
    cmd: (c: Command, id = "request-" + ++counter, revision?: number) =>
      db.command(
        director,
        c,
        id,
        revision ?? db.read(director.schoolId).revision,
        NOW,
      ),
  };
}
export function core(db: Store, user = director) {
  let counter = 0;
  const s = () => db.read(user.schoolId);
  const cmd = (c: Command, id = "core-" + ++counter) =>
    db.command(user, c, id, s().revision, NOW);
  const base = { schoolId: user.schoolId, branchId: user.branchIds[0] };
  cmd({
    type: "save",
    entity: "students",
    value: {
      ...base,
      id: "core-student",
      name: "Тестовый ученик",
      birthDate: "2012-02-01",
      contact: "",
      archived: false,
    },
  });
  cmd({
    type: "save",
    entity: "groups",
    value: {
      ...base,
      id: "core-group",
      name: "Тестовая группа",
      subject: "Тест",
      teacherId: "teacher-0",
      capacity: 10,
      archived: false,
    },
  });
  cmd({
    type: "enroll",
    studentId: "core-student",
    groupId: "core-group",
    from: "2026-10-18",
    through: "",
  });
  const lesson: Lesson = {
    ...base,
    id: "core-lesson",
    title: "Тестовое занятие",
    type: "group",
    groupId: "core-group",
    studentIds: [],
    teacherId: "teacher-0",
    roomId: "room-0",
    date: "2026-10-18",
    start: "00:01",
    end: "00:30",
    status: "scheduled",
    reason: "",
    seriesId: "",
  };
  cmd({ type: "lesson", value: lesson });
  cmd({
    type: "save",
    entity: "tariffs",
    value: {
      ...base,
      id: "core-tariff",
      name: "Тестовый тариф",
      subject: "Тест",
      kind: "package",
      priceKopecks: 100000,
      lessons: 4,
      validDays: 30,
      chargeAbsence: true,
    },
  });
  const subId = cmd({
    type: "issue",
    studentId: "core-student",
    tariffId: "core-tariff",
    from: "2026-10-18",
  }).entityId;
  const payment: Command = {
    type: "payment",
    studentId: "core-student",
    subscriptionId: subId,
    amountKopecks: 100000,
    date: "2026-10-18",
    method: "cash",
    comment: "Фактически получено",
  };
  const paymentId = cmd(payment, "core-payment").entityId;
  const attendance: Command = {
    type: "attendance",
    lessonId: lesson.id,
    entries: [{ studentId: "core-student", state: "present", reason: "" }],
    reason: "",
  };
  cmd(attendance, "core-attendance");
  return { s, cmd, subId, payment, paymentId, attendance, lesson };
}
test("Даты в часовом поясе, переход суток, интервалы и точные деньги", () => {
  assert.equal(
    today("Europe/Moscow", new Date("2026-10-18T22:01Z")),
    "2026-10-19",
  );
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(parseMoney("123,45"), 12345);
  assert.throws(() => parseMoney("1.001"));
  const s = seedSchool("school-demo", true, NOW);
  assert.equal(
    temporal({ ...s.lessons[2], start: "14:00", end: "16:00" }, s, NOW),
    "live",
  );
  assert.equal(
    temporal({ ...s.lessons[2], start: "16:00", end: "17:00" }, s, NOW),
    "future",
  );
});
test("Общий валидатор: кабинет, преподаватель, ученики; касание границ разрешено", () => {
  const s = seedSchool("school-demo", true, NOW),
    l = s.lessons[2];
  const copy = { ...l, id: "collision", start: "13:30", end: "14:30" };
  assert.equal(conflicts(s, copy).length, 1);
  assert.throws(() => validateLesson(s, copy), DomainError);
  assert.equal(
    conflicts(s, { ...copy, start: "14:00", end: "15:00" }).length,
    0,
  );
  assert.throws(
    () =>
      validateLesson(s, { ...copy, roomId: "room-4", teacherId: "teacher-4" }),
    DomainError,
  );
  assert.throws(
    () => validateLesson(s, { ...copy, groupId: "group-1", roomId: "room-4" }),
    DomainError,
  );
});
test("Сквозной цикл, идемпотентность, исправление явки, кредит и возврат", () => {
  const db = new Store(":memory:", true, NOW);
  try {
    const x = core(db);
    assert.equal(remaining(x.s(), x.subId), 3);
    assert.equal(balance(x.s(), "core-student"), 0);
    const version = x.s().revision;
    db.command(director, x.payment, "core-payment", 0, NOW);
    db.command(director, x.attendance, "core-attendance", 0, NOW);
    assert.equal(x.s().revision, version);
    assert.equal(
      x.s().debits.filter((d) => d.lessonId === "core-lesson" && d.units === 1)
        .length,
      1,
    );
    x.cmd({
      type: "attendance",
      lessonId: "core-lesson",
      entries: [
        { studentId: "core-student", state: "sick", reason: "Больничный" },
      ],
      reason: "Исправление по справке",
    });
    assert.equal(remaining(x.s(), x.subId), 4);
    x.cmd({
      type: "subscription",
      subscriptionId: x.subId,
      action: "return",
      reason: "Неиспользованный остаток",
    });
    assert.equal(outstanding(x.s(), x.subId), -100000);
    x.cmd({
      type: "refund",
      paymentId: x.paymentId,
      amountKopecks: 100000,
      date: "2026-10-18",
      reason: "Возврат остатка",
    });
    assert.equal(balance(x.s(), "core-student"), 0);
    assert.equal(
      x.s().payments.find((p) => p.id === x.paymentId)?.amountKopecks,
      100000,
    );
    assert.equal(x.s().audit.at(-1)?.actorId, director.id);
    assert.ok(JSON.stringify(x.s()).length < 200000);
  } finally {
    db.close();
  }
});
test("Запись с даты, отсутствие дублей и запрет изменения закрытой истории", () => {
  const f = fixture();
  try {
    const before = f.s();
    const c: Command = {
      type: "enroll",
      studentId: "student-2",
      groupId: "group-0",
      from: "2026-10-18",
      through: "",
    };
    f.cmd(c);
    f.cmd(c);
    assert.equal(
      f
        .s()
        .enrollments.filter(
          (e) => e.groupId === "group-0" && e.studentId === "student-2",
        ).length,
      1,
    );
    assert.deepEqual(f.s().attendance, before.attendance);
    assert.deepEqual(
      participantIds(f.s(), before.lessons[0]),
      participantIds(before, before.lessons[0]),
    );
    assert.throws(
      () =>
        f.cmd({
          ...c,
          studentId: "student-1",
          groupId: "group-1",
          from: "2026-10-16",
        }),
      /закрытую историю/,
    );
  } finally {
    f.db.close();
  }
});
test("Конкурентная версия, ключ другого тела и rollback частичной явки", () => {
  const f = fixture();
  try {
    const revision = f.s().revision;
    f.cmd(
      {
        type: "settings",
        name: "Новая школа",
        timezone: "Europe/Moscow",
        academicYear: "2026–2027",
        closedThrough: "",
      },
      "one",
      revision,
    );
    assert.throws(
      () =>
        f.cmd(
          {
            type: "settings",
            name: "Другой администратор",
            timezone: "Europe/Moscow",
            academicYear: "2026–2027",
            closedThrough: "",
          },
          "two",
          revision,
        ),
      /другим сотрудником/,
    );
    assert.throws(
      () =>
        f.cmd(
          {
            type: "settings",
            name: "Другая команда",
            timezone: "Europe/Moscow",
            academicYear: "2026–2027",
            closedThrough: "",
          },
          "one",
        ),
      /другого запроса/,
    );
    const before = f.s();
    assert.throws(
      () =>
        f.cmd({
          type: "attendance",
          lessonId: "lesson-2",
          entries: [
            { studentId: "student-0", state: "present", reason: "" },
            { studentId: "student-1", state: "sick", reason: "" },
          ],
          reason: "",
        }),
      /причину/,
    );
    assert.deepEqual(f.s(), before);
  } finally {
    f.db.close();
  }
});
test("Переходы статусов, недоступность, отмена и закрытый период", () => {
  const f = fixture();
  try {
    assert.throws(
      () =>
        f.cmd({
          type: "attendance",
          lessonId: "lesson-4",
          entries: [],
          reason: "",
        }),
      /окончания/,
    );
    f.cmd({
      type: "transition",
      lessonId: "lesson-2",
      status: "cancelled",
      reason: "Болезнь преподавателя",
    });
    assert.throws(
      () =>
        f.cmd({
          type: "attendance",
          lessonId: "lesson-2",
          entries: [],
          reason: "",
        }),
      /отменённое/,
    );
    f.cmd({
      type: "transition",
      lessonId: "lesson-2",
      status: "scheduled",
      reason: "Преподаватель выздоровел",
    });
    const l = f.s().lessons[2];
    f.cmd({
      type: "lesson",
      value: {
        ...l,
        teacherId: "teacher-1",
        roomId: "room-1",
        start: "13:00",
        end: "14:00",
      },
    });
    assert.equal(f.s().lessons[2].teacherId, "teacher-1");
    f.cmd({
      type: "settings",
      name: f.s().school.name,
      timezone: "Europe/Moscow",
      academicYear: "2026–2027",
      closedThrough: "2026-10-18",
    });
    const admin = { ...director, role: "admin" as const, id: "user-admin" };
    assert.throws(
      () =>
        f.db.command(
          admin,
          { type: "lesson", value: l },
          "closed",
          f.s().revision,
          NOW,
        ),
      /Период закрыт/,
    );
  } finally {
    f.db.close();
  }
});
test("Схема повреждённого хранилища не сбрасывает данные", () => {
  const f = fixture();
  try {
    f.db.db
      .prepare("UPDATE schools SET payload=? WHERE id=?")
      .run("{}", director.schoolId);
    assert.throws(() => f.s(), /повреждено/);
    assert.equal(
      f.db.db
        .prepare("SELECT payload FROM schools WHERE id=?")
        .get(director.schoolId)?.payload,
      "{}",
    );
    assert.equal(StateSchema.safeParse({}).success, false);
  } finally {
    f.db.close();
  }
});
test("Каникулы, вместимость и серия атомарно отклоняются", () => {
  const f = fixture();
  try {
    const s = f.s();
    f.cmd({
      type: "save",
      entity: "calendar",
      value: {
        id: "closed-day",
        schoolId: s.school.id,
        branchId: s.branches[0].id,
        date: "2026-10-25",
        roomId: "",
        reason: "Каникулы",
      },
    });
    const l = {
      ...s.lessons[2],
      id: "series-lesson",
      start: "20:00",
      end: "21:00",
    };
    const before = f.s();
    assert.throws(
      () => f.cmd({ type: "lesson", value: l, repeat: 2 }),
      /календарём/,
    );
    assert.deepEqual(f.s(), before);
  } finally {
    f.db.close();
  }
});

test("Возврат части остатка и последующее исправление явки сохраняют финансовую сверку", () => {
  const db = new Store(":memory:", true, NOW);
  try {
    const x = core(db);
    x.cmd({
      type: "subscription",
      subscriptionId: x.subId,
      action: "return",
      reason: "Возврат 3 из 4",
    });
    assert.equal(outstanding(x.s(), x.subId), -75000);
    x.cmd({
      type: "refund",
      paymentId: x.paymentId,
      amountKopecks: 75000,
      date: "2026-10-18",
      reason: "Возврат остатка",
    });
    x.cmd({
      type: "attendance",
      lessonId: "core-lesson",
      entries: [
        { studentId: "core-student", state: "sick", reason: "Справка" },
      ],
      reason: "Исправление после возврата",
    });
    assert.equal(outstanding(x.s(), x.subId), -25000);
    x.cmd({
      type: "refund",
      paymentId: x.paymentId,
      amountKopecks: 25000,
      date: "2026-10-18",
      reason: "Дополнительная корректировка",
    });
    assert.equal(balance(x.s(), "core-student"), 0);
    assert.equal(remaining(x.s(), x.subId), 4);
  } finally {
    db.close();
  }
});
test("Смена времени серии сдвигает даты будущих занятий и сохраняет ID", () => {
  const f = fixture();
  try {
    const l = {
      ...f.s().lessons[2],
      id: "recurrence",
      date: "2026-10-19",
      start: "20:00",
      end: "21:00",
    };
    f.cmd({ type: "lesson", value: l, repeat: 3 });
    const series = f.s().lessons.find((x) => x.id === l.id)!;
    const ids = f
      .s()
      .lessons.filter((x) => x.seriesId === series.seriesId)
      .map((x) => x.id);
    f.cmd({
      type: "lesson",
      value: { ...series, date: "2026-10-20", roomId: "room-1" },
      scope: "future",
    });
    assert.deepEqual(
      f
        .s()
        .lessons.filter((x) => ids.includes(x.id))
        .map((x) => x.date),
      ["2026-10-20", "2026-10-27", "2026-11-03"],
    );
    assert.ok(
      f
        .s()
        .lessons.filter((x) => ids.includes(x.id))
        .every((x) => x.roomId === "room-1"),
    );
  } finally {
    f.db.close();
  }
});

test("Отработка связана с уважительным пропуском и не дублируется", () => {
  const db = new Store(":memory:", true, NOW);
  try {
    const x = core(db);
    x.cmd({
      type: "attendance",
      lessonId: "core-lesson",
      entries: [
        { studentId: "core-student", state: "excused", reason: "Заявление" },
      ],
      reason: "Уважительная причина",
    });
    const makeup = {
      ...x.lesson,
      id: "makeup-lesson",
      title: "Отработка",
      type: "makeup" as const,
      groupId: "",
      studentIds: ["core-student"],
      makeupForLessonId: "core-lesson",
      start: "01:00",
      end: "01:30",
    };
    x.cmd({ type: "lesson", value: makeup });
    assert.throws(
      () =>
        x.cmd({
          type: "lesson",
          value: {
            ...makeup,
            id: "duplicate-makeup",
            start: "02:00",
            end: "02:30",
          },
        }),
      /уже назначена/,
    );
    x.cmd({
      type: "attendance",
      lessonId: makeup.id,
      entries: [{ studentId: "core-student", state: "present", reason: "" }],
      reason: "",
    });
    assert.equal(remaining(x.s(), x.subId), 3);
    assert.equal(
      x
        .s()
        .debits.filter((d) => d.lessonId === "core-lesson")
        .reduce((a, d) => a + d.units, 0),
      0,
    );
  } finally {
    db.close();
  }
});
test("Серия пропускает явные исключения календаря", () => {
  const f = fixture();
  try {
    const s = f.s();
    f.cmd({
      type: "save",
      entity: "calendar",
      value: {
        id: "holiday",
        schoolId: s.school.id,
        branchId: s.branches[0].id,
        date: "2026-10-25",
        roomId: "",
        reason: "Каникулы",
      },
    });
    f.cmd({
      type: "lesson",
      value: {
        ...s.lessons[2],
        id: "excluded-series",
        start: "20:00",
        end: "21:00",
      },
      repeat: 3,
      excludeDates: ["2026-10-25"],
    });
    const seriesId = f
      .s()
      .lessons.find((x) => x.id === "excluded-series")!.seriesId;
    assert.deepEqual(
      f
        .s()
        .lessons.filter((x) => x.seriesId === seriesId)
        .map((x) => x.date),
      ["2026-10-18", "2026-11-01"],
    );
  } finally {
    f.db.close();
  }
});
test("Перезапуск базы сохраняет финансы и ключи обработанных запросов", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const path = mkdtempSync(join(tmpdir(), "ersh-persistence-"));
  try {
    const file = join(path, "test.sqlite");
    let db = new Store(file, true, NOW);
    const x = core(db);
    const expected = x.s();
    db.close();
    db = new Store(file, true, NOW);
    assert.deepEqual(db.read(director.schoolId), expected);
    const response = db.command(director, x.payment, "core-payment", 0, NOW);
    assert.equal(response.replayed, true);
    assert.equal(db.read(director.schoolId).revision, expected.revision);
    db.close();
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
});

test("Уведомления вычисляются, прочтение сохраняется, решение удаляет событие", () => {
  const f = fixture();
  try {
    const s = f.s();
    f.cmd({ type: "read-notification", notificationId: "alesson-2" });
    assert.equal(f.s().notificationReads[0].notificationId, "alesson-2");
    f.cmd({
      type: "attendance",
      lessonId: "lesson-2",
      entries: [
        { studentId: "student-0", state: "present", reason: "" },
        { studentId: "student-1", state: "present", reason: "" },
      ],
      reason: "",
    });
    assert.equal(
      f.s().lessons.find((x) => x.id === "lesson-2")?.status,
      "completed",
    );
    assert.throws(
      () => f.cmd({ type: "read-notification", notificationId: "alesson-2" }),
      /разрешено/,
    );
  } finally {
    f.db.close();
  }
});

test("Справочники, представители и вместимость сохраняют явные связи", () => {
  const f = fixture();
  try {
    const s = f.s(),
      base = { schoolId: s.school.id, branchId: s.branches[0].id };
    f.cmd({
      type: "save",
      entity: "representatives",
      value: {
        ...base,
        id: "rep-1",
        studentId: "student-0",
        name: "Первый представитель",
        contact: "parent@example.invalid",
        channel: "email",
      },
    });
    f.cmd({
      type: "save",
      entity: "representatives",
      value: {
        ...base,
        id: "rep-2",
        studentId: "student-0",
        name: "Второй представитель",
        contact: "+70000000000",
        channel: "phone",
      },
    });
    assert.equal(
      f.s().representatives.filter((r) => r.studentId === "student-0").length,
      2,
    );
    f.cmd({
      type: "save",
      entity: "groups",
      value: {
        ...base,
        id: "limited-group",
        name: "Группа с лимитом",
        subject: "Тест",
        teacherId: "teacher-0",
        capacity: 1,
        archived: false,
      },
    });
    f.cmd({
      type: "enroll",
      studentId: "student-0",
      groupId: "limited-group",
      from: "2026-10-19",
      through: "",
    });
    assert.throws(
      () =>
        f.cmd({
          type: "enroll",
          studentId: "student-1",
          groupId: "limited-group",
          from: "2026-10-19",
          through: "",
        }),
      /свободных мест/,
    );
    assert.throws(
      () =>
        f.cmd({
          type: "save",
          entity: "teachers",
          value: { ...s.teachers[0], workStart: "22:00", workEnd: "09:00" },
        }),
      /Конец рабочего/,
    );
    assert.throws(
      () =>
        f.cmd({
          type: "save",
          entity: "representatives",
          value: {
            ...base,
            id: "rep-bad",
            studentId: "foreign-student",
            name: "Неверная ссылка",
            contact: "x",
            channel: "none",
          },
        }),
      /недоступен/,
    );
  } finally {
    f.db.close();
  }
});

test("Конкурентные правки объединяют разные поля и не затирают одно поле", () => {
  const f = fixture();
  try {
    const original = f.s().students[0];
    f.cmd({
      type: "save",
      entity: "students",
      value: { ...original, contact: "contact@example.invalid" },
      before: original,
    });
    f.cmd({
      type: "save",
      entity: "students",
      value: { ...original, name: "Новое имя" },
      before: original,
    });
    assert.equal(f.s().students[0].contact, "contact@example.invalid");
    assert.equal(f.s().students[0].name, "Новое имя");
    assert.throws(
      () =>
        f.cmd({
          type: "save",
          entity: "students",
          value: { ...original, name: "Другой вариант" },
          before: original,
        }),
      /изменено другим сотрудником/,
    );
  } finally {
    f.db.close();
  }
});

test("Долг на дату, просрочка и удержание рассчитываются по исходным операциям", async () => {
  const { balanceAt, overdue, retention } = await import("../shared/model.ts");
  const db = new Store(":memory:", true, NOW);
  try {
    const x = core(db);
    assert.equal(balanceAt(x.s(), "core-student", "2026-10-17"), 0);
    assert.equal(balanceAt(x.s(), "core-student", "2026-10-18"), 0);
    assert.equal(overdue(x.s(), "core-student", "2026-10-19"), 0);
    const cohort = retention(x.s(), "2026-10-17", "2026-10-18");
    assert.deepEqual(cohort, { initial: 3, retained: 3, newStudents: 1 });
  } finally {
    db.close();
  }
});
