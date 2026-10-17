import { request } from "./api";
import type { Command, Entity, Lesson, State } from "../shared/model";
import {
  today,
  parseMoney,
  participantIds,
  attendanceNames,
  money,
} from "../shared/model";
import type { Field, FormSpec } from "./components";
export type Run = (command: Command, key?: string) => Promise<void>;
export function createActions(
  s: State,
  run: Run,
  show: (spec: FormSpec) => void,
  csrf = "",
) {
  const branch = s.branches[0]?.id || "",
    d = today(s.school.timezone);
  const options = (
    rows: { id: string; name?: string; title?: string }[],
    empty = false,
  ) => [
    ...(empty ? [{ value: "", label: "Не выбрано" }] : []),
    ...rows.map((x) => ({ value: x.id, label: x.name || x.title || x.id })),
  ];
  const field = (
    name: string,
    label: string,
    value = "",
    type = "text",
    required = true,
  ): Field => ({ name, label, value, type, required });
  function edit(entity: Entity, record?: unknown) {
    const old = (record || {}) as Record<string, unknown>;
    const val = (k: string, fallback = "") => String(old[k] ?? fallback);
    const id = val("id", crypto.randomUUID());
    const fields: Field[] = [];
    const add = (k: string, l: string, def = "", t = "text", required = true) =>
      fields.push(field(k, l, val(k, def), t, required));
    const choice = (
      k: string,
      l: string,
      opts: { value: string; label: string }[],
      def = "",
    ) =>
      fields.push({
        name: k,
        label: l,
        value: val(k, def || opts[0]?.value),
        options: opts,
      });
    if (entity !== "branches")
      choice("branchId", "Филиал", options(s.branches), branch);
    if (entity === "students") {
      add("name", "Фамилия и имя");
      add("birthDate", "Дата рождения", "", "date", false);
      add("contact", "Контакт", "", "text", false);
      choice(
        "archived",
        "Состояние",
        [
          { value: "false", label: "Активен" },
          { value: "true", label: "В архиве" },
        ],
        "false",
      );
    }
    if (entity === "representatives") {
      choice("studentId", "Ученик", options(s.students));
      add("name", "Имя представителя");
      add("contact", "Телефон или email");
      choice("channel", "Разрешённый канал", [
        { value: "phone", label: "Телефон" },
        { value: "email", label: "Email" },
        { value: "none", label: "Без сообщений" },
      ]);
    }
    if (entity === "teachers") {
      add("name", "Фамилия и имя");
      add("contact", "Контакт", "", "text", false);
      add("subject", "Предмет");
      choice(
        "active",
        "Состояние",
        [
          { value: "true", label: "Активен" },
          { value: "false", label: "Неактивен" },
        ],
        "true",
      );
      add("workStart", "Начало рабочего дня", "08:00", "time");
      add("workEnd", "Конец рабочего дня", "22:00", "time");
      fields.push(
        field(
          "unavailable",
          "Недоступные даты через запятую",
          Array.isArray(old.unavailable) ? old.unavailable.join(", ") : "",
          "text",
          false,
        ),
      );
      fields.push(
        field(
          "rate",
          "Ставка за проведённое занятие, ₽",
          String(Number(old.rateKopecks || 0) / 100),
        ),
      );
    }
    if (entity === "groups") {
      add("name", "Название группы");
      add("subject", "Предмет");
      choice(
        "teacherId",
        "Преподаватель",
        options(s.teachers.filter((t) => t.active)),
      );
      add("capacity", "Вместимость", "12", "number");
      choice(
        "archived",
        "Состояние",
        [
          { value: "false", label: "Активна" },
          { value: "true", label: "В архиве" },
        ],
        "false",
      );
    }
    if (entity === "branches") add("name", "Название филиала");
    if (entity === "rooms") {
      add("name", "Название кабинета");
      add("capacity", "Вместимость", "12", "number");
    }
    if (entity === "calendar") {
      add("date", "Дата", d, "date");
      choice("roomId", "Кабинет (или весь филиал)", options(s.rooms, true));
      add("reason", "Причина закрытия");
    }
    if (entity === "tariffs") {
      add("name", "Название тарифа");
      add("subject", "Предмет");
      choice("kind", "Тип", [
        { value: "package", label: "Пакет занятий" },
        { value: "period", label: "Абонемент на срок с лимитом" },
      ]);
      fields.push(
        field("price", "Цена, ₽", String(Number(old.priceKopecks || 0) / 100)),
      );
      add("lessons", "Количество занятий", "8", "number");
      add("validDays", "Срок действия, дней", "30", "number");
      choice(
        "chargeAbsence",
        "Обычный пропуск",
        [
          { value: "true", label: "Списывать" },
          { value: "false", label: "Не списывать" },
        ],
        "true",
      );
    }
    const names: Record<Entity, string> = {
      students: "ученика",
      teachers: "преподавателя",
      groups: "группу",
      representatives: "представителя",
      rooms: "кабинет",
      branches: "филиал",
      tariffs: "тариф",
      calendar: "нерабочую дату",
    };
    show({
      title: (record ? "Изменить " : "Добавить ") + names[entity],
      fields,
      submit: async (v, key) => {
        const value: Record<string, unknown> = {
          ...v,
          id,
          schoolId: s.school.id,
        };
        for (const k of ["capacity", "lessons", "validDays"])
          if (k in value) value[k] = Number(value[k]);
        for (const k of ["archived", "active", "chargeAbsence"])
          if (k in value) value[k] = value[k] === "true";
        if (entity === "teachers") {
          value.unavailable = String(value.unavailable)
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          value.rateKopecks = parseMoney(v.rate);
          delete value.rate;
        }
        if (entity === "tariffs") {
          value.priceKopecks = parseMoney(v.price);
          delete value.price;
        }
        await run(
          {
            type: "save",
            entity,
            value,
            before: typeof old.id === "string" ? record : undefined,
          },
          key,
        );
      },
    });
  }
  function lesson(old?: Lesson) {
    const id = old?.id || crypto.randomUUID();
    show({
      title: old ? "Изменить / перенести занятие" : "Добавить занятие",
      fields: [
        field("title", "Название занятия", old?.title || ""),
        {
          name: "type",
          label: "Тип занятия",
          value: old?.type || "group",
          options: [
            { value: "group", label: "Групповое" },
            { value: "individual", label: "Индивидуальное" },
            {
              value: "makeup",
              label: "Отработка (без списания за уважительный пропуск)",
            },
          ],
        },
        {
          name: "groupId",
          label: "Группа",
          options: options(
            s.groups.filter((g) => !g.archived),
            true,
          ),
          value: old?.groupId || "",
          required: false,
        },
        {
          name: "studentId",
          label: "Ученик для индивидуального / отработки",
          options: options(
            s.students.filter((x) => !x.archived),
            true,
          ),
          value: old?.studentIds[0] || "",
          required: false,
        },
        {
          name: "makeupForLessonId",
          label: "Исходное занятие для отработки",
          options: options(s.lessons, true),
          value: old?.makeupForLessonId || "",
          required: false,
        },
        {
          name: "teacherId",
          label: "Преподаватель",
          options: options(s.teachers.filter((t) => t.active)),
          value: old?.teacherId || s.teachers[0]?.id,
        },
        {
          name: "roomId",
          label: "Кабинет",
          options: options(s.rooms),
          value: old?.roomId || s.rooms[0]?.id,
        },
        field("date", "Дата", old?.date || d, "date"),
        field("start", "Начало", old?.start || "16:00", "time"),
        field("end", "Окончание", old?.end || "17:00", "time"),
        ...(!old
          ? [
              field(
                "repeat",
                "Повторить еженедельно (число занятий)",
                "1",
                "number",
              ),
              field(
                "excludeDates",
                "Исключить даты через запятую",
                "",
                "text",
                false,
              ),
            ]
          : old.seriesId
            ? [
                {
                  name: "scope",
                  label: "Изменить в серии",
                  value: "one",
                  options: [
                    { value: "one", label: "Только это" },
                    { value: "future", label: "Это и будущие" },
                    {
                      value: "all",
                      label: "Все незакрытые (отказ при наличии закрытых)",
                    },
                  ],
                },
              ]
            : []),
      ],
      intro: (
        <p>
          Для группового занятия выберите группу. Для индивидуального и
          отработки — ученика. Сервер проверит кабинет, преподавателя и
          участников.
        </p>
      ),
      submit: async (v, key) => {
        const room = s.rooms.find((r) => r.id === v.roomId);
        const value: Lesson = {
          id,
          schoolId: s.school.id,
          branchId: room?.branchId || branch,
          title: v.title,
          type: v.type as Lesson["type"],
          groupId: v.type === "group" ? v.groupId : "",
          studentIds: v.type === "group" ? [] : [v.studentId],
          teacherId: v.teacherId,
          roomId: v.roomId,
          date: v.date,
          start: v.start,
          end: v.end,
          status: old?.status || "scheduled",
          reason: old?.reason || "",
          seriesId: old?.seriesId || "",
          makeupForLessonId: v.type === "makeup" ? v.makeupForLessonId : "",
        };
        await run(
          {
            type: "lesson",
            value,
            before: old,
            repeat: old ? 1 : Number(v.repeat),
            excludeDates: (v.excludeDates || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
            scope: (v.scope || "one") as "one",
          },
          key,
        );
      },
    });
  }
  function enroll(studentId = "", previousEnrollmentId = "") {
    show({
      title: previousEnrollmentId
        ? "Перевести в другую группу"
        : "Записать ученика в группу",
      intro: (
        <p>
          Запись действует с выбранной даты. Закрытые занятия не изменяются;
          дубли и пересечения запрещены.
        </p>
      ),
      fields: [
        {
          name: "studentId",
          label: "Ученик",
          value: studentId || s.students[0]?.id,
          options: options(s.students.filter((x) => !x.archived)),
        },
        {
          name: "groupId",
          label: "Группа",
          options: options(s.groups.filter((g) => !g.archived)),
        },
        field("from", "Дата начала", d, "date"),
        field("through", "Дата окончания (необязательно)", "", "date", false),
      ],
      submit: async (v, key) => {
        await run(
          {
            type: "enroll",
            studentId: v.studentId,
            groupId: v.groupId,
            from: v.from,
            through: v.through,
            ...(previousEnrollmentId ? { previousEnrollmentId } : {}),
          },
          key,
        );
      },
    });
  }
  function attendance(l: Lesson) {
    const ids = participantIds(s, l);
    const fields: Field[] = ids.flatMap((id) => {
      const a = s.attendance.find(
        (x) => x.lessonId === l.id && x.studentId === id,
      );
      const name = s.students.find((x) => x.id === id)?.name || id;
      return [
        {
          name: "state-" + id,
          label: name,
          value: a?.state || "unmarked",
          options: Object.entries(attendanceNames).map(([value, label]) => ({
            value,
            label,
          })),
        },
        field(
          "reason-" + id,
          "Причина — " + name,
          a?.reason || "",
          "text",
          false,
        ),
      ];
    });
    fields.push(
      field(
        "reason",
        "Основание исправления",
        "",
        "text",
        l.status === "completed",
      ),
    );
    show({
      title: "Посещаемость — " + l.title,
      fields,
      bulk: true,
      intro: (
        <p>
          Присутствие и платный пропуск создают списание. Болезнь и уважительный
          пропуск требуют причины. Сохранение и списания атомарны.
        </p>
      ),
      submit: async (v, key) => {
        await run(
          {
            type: "attendance",
            lessonId: l.id,
            before: ids.map((id) => ({
              studentId: id,
              state:
                s.attendance.find(
                  (a) => a.lessonId === l.id && a.studentId === id,
                )?.state || "unmarked",
              reason:
                s.attendance.find(
                  (a) => a.lessonId === l.id && a.studentId === id,
                )?.reason || "",
            })),
            entries: ids.map((id) => ({
              studentId: id,
              state: v["state-" + id] as State["attendance"][number]["state"],
              reason: v["reason-" + id],
            })),
            reason: v.reason,
          },
          key,
        );
      },
    });
  }
  function transition(l: Lesson, status: Lesson["status"]) {
    show({
      title:
        status === "cancelled"
          ? "Отменить занятие"
          : status === "scheduled"
            ? "Восстановить занятие"
            : "Завершить занятие",
      fields: [field("reason", "Основание")],
      intro: (
        <p>
          {l.title} · {l.date} · {l.start}–{l.end}. При отмене списания
          возвращаются обратными операциями.
        </p>
      ),
      submit: async (v, key) => {
        await run(
          { type: "transition", lessonId: l.id, status, reason: v.reason },
          key,
        );
      },
    });
  }
  function issue(studentId = "") {
    show({
      title: "Выдать абонемент",
      fields: [
        {
          name: "studentId",
          label: "Ученик",
          value: studentId || s.students[0]?.id,
          options: options(s.students.filter((x) => !x.archived)),
        },
        {
          name: "tariffId",
          label: "Тариф",
          options: s.tariffs.map((t) => ({
            value: t.id,
            label: t.name + " · " + money(t.priceKopecks),
          })),
        },
        field("from", "Дата начала", d, "date"),
      ],
      submit: async (v, key) => {
        await run(
          {
            type: "issue",
            studentId: v.studentId,
            tariffId: v.tariffId,
            from: v.from,
          },
          key,
        );
      },
    });
  }
  function payment(studentId = "", subscriptionId = "") {
    show({
      title: "Принять оплату",
      intro: (
        <p>
          Регистрация фактически полученной оплаты. Это не онлайн-списание с
          карты и не кассовый чек.
        </p>
      ),
      fields: [
        {
          name: "subscriptionId",
          label: "Абонемент / ученик",
          value:
            subscriptionId ||
            s.subscriptions.find((x) => !studentId || x.studentId === studentId)
              ?.id,
          options: s.subscriptions
            .filter(
              (x) => !x.closed && (!studentId || x.studentId === studentId),
            )
            .map((x) => ({
              value: x.id,
              label:
                (s.students.find((t) => t.id === x.studentId)?.name || "") +
                " · " +
                (s.tariffs.find((t) => t.id === x.tariffId)?.name || ""),
            })),
        },
        field("amount", "Сумма, ₽"),
        field("date", "Дата оплаты", d, "date"),
        {
          name: "method",
          label: "Способ оплаты",
          options: [
            { value: "card", label: "Банковская карта" },
            { value: "cash", label: "Наличные" },
            { value: "transfer", label: "Перевод" },
          ],
        },
        field("comment", "Комментарий", "", "text", false),
      ],
      submit: async (v, key) => {
        const sub = s.subscriptions.find((x) => x.id === v.subscriptionId);
        await run(
          {
            type: "payment",
            subscriptionId: v.subscriptionId,
            studentId: sub?.studentId || "",
            amountKopecks: parseMoney(v.amount),
            date: v.date,
            method: v.method as "card",
            comment: v.comment,
          },
          key,
        );
      },
    });
  }
  function subscription(
    id: string,
    action: "freeze" | "unfreeze" | "extend" | "return",
  ) {
    const sub = s.subscriptions.find((x) => x.id === id)!;
    show({
      title: {
        freeze: "Заморозить абонемент",
        unfreeze: "Разморозить абонемент",
        extend: "Продлить срок / отработка",
        return: "Вернуть неиспользованный остаток",
      }[action],
      fields: [
        ...(action === "extend"
          ? [field("through", "Новая дата окончания", sub.through, "date")]
          : []),
        field("reason", "Основание"),
      ],
      intro: (
        <p>
          Возврат остатка создаёт кредитовое начисление; возврат денег
          оформляется отдельно в реестре платежей. Оплаченные списания
          сохраняются.
        </p>
      ),
      submit: async (v, key) => {
        await run(
          {
            type: "subscription",
            subscriptionId: id,
            action,
            reason: v.reason,
            ...(v.through ? { through: v.through } : {}),
          },
          key,
        );
      },
    });
  }
  function refund(id: string) {
    show({
      title: "Возврат оплаты",
      fields: [
        field("amount", "Сумма, ₽"),
        field("date", "Дата", d, "date"),
        field("reason", "Основание"),
      ],
      submit: async (v, key) => {
        await run(
          {
            type: "refund",
            paymentId: id,
            amountKopecks: parseMoney(v.amount),
            date: v.date,
            reason: v.reason,
          },
          key,
        );
      },
    });
  }
  function invoice(studentId = "") {
    show({
      title: "Счёт / напоминание",
      intro: (
        <p>
          Серверный черновик. Реальная отправка, оплата и фискализация не
          подключены. В деморежиме доступен явно помеченный тестовый адаптер.
        </p>
      ),
      fields: [
        {
          name: "studentId",
          label: "Ученик",
          value: studentId || s.students[0]?.id,
          options: options(s.students),
        },
        field("amount", "Сумма, ₽"),
        field("dueDate", "Срок оплаты", addDay(d), "date"),
        {
          name: "channel",
          label: "Канал",
          options: [
            { value: "email", label: "Email" },
            { value: "sms", label: "SMS" },
            { value: "payment", label: "Платёжный провайдер (тест)" },
            { value: "accounting", label: "Учёт / касса (тест)" },
          ],
        },
        field("text", "Текст", "", "textarea"),
      ],
      submit: async (v, key) => {
        await run(
          {
            type: "invoice",
            studentId: v.studentId,
            amountKopecks: parseMoney(v.amount),
            dueDate: v.dueDate,
            text: v.text,
            channel: v.channel as "email",
          },
          key,
        );
      },
    });
  }
  function settings() {
    show({
      title: "Настройки школы",
      fields: [
        field("name", "Название", s.school.name),
        field("timezone", "Часовой пояс IANA", s.school.timezone),
        field("academicYear", "Учебный год", s.school.academicYear),
        field(
          "closedThrough",
          "Период закрыт включительно",
          s.school.closedThrough,
          "date",
          false,
        ),
      ],
      intro: (
        <p>
          Закрытый период нельзя открыть обратно через интерфейс. Директор может
          исправлять явку только с основанием и аудитом.
        </p>
      ),
      submit: async (v, key) => {
        await run(
          {
            type: "settings",
            name: v.name,
            timezone: v.timezone,
            academicYear: v.academicYear,
            closedThrough: v.closedThrough,
          },
          key,
        );
      },
    });
  }
  return {
    importStudents: () =>
      show({
        title: "Импорт учеников CSV",
        intro: (
          <p>
            До 100 строк. Заголовок name;birthDate;contact. Сначала выполните
            проверку; сохранение атомарно. Совпадения имени и даты рождения
            отклоняются.
          </p>
        ),
        fields: [
          {
            name: "branchId",
            label: "Филиал",
            options: options(s.branches),
            value: branch,
          },
          field(
            "csv",
            "Содержимое CSV",
            "name;birthDate;contact\n",
            "textarea",
          ),
        ],
        preview: async (v) => {
          const p = await request<{
            count: number;
            preview: { name: string; birthDate: string; contact: string }[];
          }>(
            "/import/preview",
            { method: "POST", body: JSON.stringify(v) },
            csrf,
          );
          return (
            <div className="detail-block">
              <b>Готово к импорту: {p.count}</b>
              {p.preview.map((x, i) => (
                <p key={i}>
                  {x.name} · {x.birthDate} · {x.contact}
                </p>
              ))}
            </div>
          );
        },
        submit: async (v, key) => {
          await run(
            { type: "import-students", csv: v.csv, branchId: v.branchId },
            key,
          );
        },
      }),
    edit,
    lesson,
    enroll,
    attendance,
    transition,
    issue,
    payment,
    subscription,
    refund,
    invoice,
    settings,
    withdraw: (id: string) =>
      show({
        title: "Завершить запись в группу",
        fields: [field("through", "Последний день записи", d, "date")],
        submit: async (v, key) => {
          await run(
            { type: "withdraw", enrollmentId: id, through: v.through },
            key,
          );
        },
      }),
  };
}
function addDay(d: string) {
  const date = new Date(d);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}
