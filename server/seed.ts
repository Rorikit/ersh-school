import { today, addDays, type State } from "../shared/model.ts";
export function seedSchool(
  schoolId = "school-demo",
  demo = true,
  now = new Date(),
): State {
  const b = "branch-" + schoolId;
  const state: State = {
    schemaVersion: 1,
    revision: 0,
    demo,
    school: {
      id: schoolId,
      name: demo ? "Школа «Вектор»" : "Новая школа",
      timezone: "Europe/Moscow",
      academicYear:
        today("Europe/Moscow", now).slice(0, 4) +
        "–" +
        (Number(today("Europe/Moscow", now).slice(0, 4)) + 1),
      closedThrough: "",
    },
    branches: [{ id: b, schoolId, name: "Основной кампус" }],
    rooms: [],
    students: [],
    representatives: [],
    teachers: [],
    groups: [],
    enrollments: [],
    lessons: [],
    attendance: [],
    tariffs: [],
    subscriptions: [],
    charges: [],
    payments: [],
    debits: [],
    audit: [],
    invoices: [],
    calendar: [],
    notificationReads: [],
  };
  if (!demo) return state;
  const d = today(state.school.timezone, now),
    base = (id: string) => ({ id, schoolId, branchId: b });
  const subjects = [
    "Робототехника",
    "Математика",
    "Английский",
    "Физика",
    "Python",
    "Химия",
  ];
  const names = [
    "Дмитрий Соколов",
    "Анна Лебедева",
    "Елена Морозова",
    "Михаил Кузнецов",
    "Артем Васильев",
    "Ольга Полякова",
  ];
  const titles = [
    "Робототехника Junior (Гр. Р-04)",
    "Олимпиадная математика 6 кл. (Гр. М-02)",
    "Английский B1 Speaking (Гр. А-07)",
    "Физика: Подготовка к ОГЭ (Гр. Ф-01)",
    "Программирование Python (Гр. П-09)",
    "Индивидуальный: Смирнов Арсений (ЕГЭ Хим)",
  ];
  ["Ковалев Максим", "Иванова Татьяна", "Смирнов Арсений"].forEach((name, i) =>
    state.students.push({
      ...base("student-" + i),
      name,
      birthDate: "2011-01-0" + (i + 1),
      contact: "",
      archived: false,
    }),
  );
  for (let i = 0; i < 6; i++) {
    state.rooms.push({
      ...base("room-" + i),
      name:
        i === 4 ? "Комп. класс 1" : "Ауд. " + [204, 102, 301, 108, 101, 205][i],
      capacity: 16,
    });
    state.teachers.push({
      ...base("teacher-" + i),
      name: names[i],
      subject: subjects[i],
      contact: "",
      active: true,
      workStart: "00:00",
      workEnd: "23:59",
      unavailable: [],
      rateKopecks: 150000,
    });
    state.tariffs.push({
      ...base("tariff-" + i),
      name: subjects[i] + " · 8 занятий",
      kind: "package",
      priceKopecks: 1400000,
      lessons: 8,
      validDays: 90,
      subject: i === 5 ? titles[i] : subjects[i],
      chargeAbsence: true,
    });
    if (i < 5)
      state.groups.push({
        ...base("group-" + i),
        name: titles[i],
        teacherId: "teacher-" + i,
        subject: subjects[i],
        capacity: 12,
        archived: false,
      });
    const members =
      i === 5
        ? ["student-2"]
        : i === 1
          ? ["student-2"]
          : ["student-0", "student-1"];
    if (i < 5)
      members.forEach((studentId, j) =>
        state.enrollments.push({
          ...base("enrollment-" + i + "-" + j),
          studentId,
          groupId: "group-" + i,
          from: addDays(d, -7),
          through: "",
        }),
      );
    const lesson = {
      ...base("lesson-" + i),
      title: titles[i],
      type: i === 5 ? ("individual" as const) : ("group" as const),
      groupId: i === 5 ? "" : "group-" + i,
      studentIds: i === 5 ? members : [],
      teacherId: "teacher-" + i,
      roomId: "room-" + i,
      date: i < 2 ? addDays(d, -1) : d,
      start: ["09:00", "11:00", "13:00", "15:30", "17:15", "18:00"][i],
      end: ["10:30", "12:30", "14:00", "17:00", "18:45", "19:00"][i],
      status: i < 2 ? ("completed" as const) : ("scheduled" as const),
      reason: "",
      seriesId: "",
      subject: i === 5 ? titles[i] : subjects[i],
    };
    state.lessons.push(lesson);
    members.forEach((studentId, j) => {
      const sub = {
        ...base("subscription-" + i + "-" + j),
        studentId,
        tariffId: "tariff-" + i,
        from: addDays(d, -7),
        through: addDays(d, 82),
        frozen: false,
        closed: false,
        granted: 8,
        priceKopecks: 1400000,
        subject: i === 5 ? titles[i] : subjects[i],
        chargeAbsence: true,
      };
      state.subscriptions.push(sub);
      state.charges.push({
        ...base("charge-" + i + "-" + j),
        studentId,
        subscriptionId: sub.id,
        amountKopecks: 1400000,
        date: addDays(d, -7),
        dueDate: addDays(d, -7),
        kind: "charge",
        reverses: "",
        reason: "Демонстрационное начисление",
      });
      state.payments.push({
        ...base("payment-" + i + "-" + j),
        studentId,
        subscriptionId: sub.id,
        amountKopecks: 1400000,
        date: addDays(d, -7),
        method: "card",
        kind: "payment",
        reverses: "",
        comment: "Демонстрационная оплата",
      });
      if (i < 2) {
        state.attendance.push({
          ...base("attendance-" + i + "-" + j),
          lessonId: lesson.id,
          studentId,
          state: "present",
          reason: "",
        });
        state.debits.push({
          ...base("debit-" + i + "-" + j),
          lessonId: lesson.id,
          studentId,
          subscriptionId: sub.id,
          units: 1,
          reverses: "",
          reason: "Демонстрационная явка",
        });
      }
    });
  }
  return state;
}
