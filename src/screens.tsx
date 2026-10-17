import { useState, type ReactNode } from "react";
import type { State, User, Lesson, Entity } from "../shared/model";
import {
  today,
  addDays,
  temporal,
  metrics,
  participantIds,
  money,
  remaining,
  balance,
  balanceAt,
  overdue,
  retention,
  notifications,
  attendanceNames,
  outstanding,
} from "../shared/model";
import { allowed } from "../shared/permissions";
import type { createActions, Run } from "./actions";
import { Button, Icon, Empty, Table } from "./components";
export type Actions = ReturnType<typeof createActions>;
export interface Workspace {
  s: State;
  user: User;
  a: Actions;
  lesson: (id: string) => void;
  profile: (entity: "students" | "groups" | "teachers", id: string) => void;
  run: Run;
}
export function LessonCard({ l, ctx }: { l: Lesson; ctx: Workspace }) {
  const { s, user, a } = ctx;
  const state = temporal(l, s);
  const ids = participantIds(s, l),
    marked = ids.filter((id) =>
      s.attendance.some(
        (x) =>
          x.lessonId === l.id && x.studentId === id && x.state !== "unmarked",
      ),
    ).length;
  const waiting =
    state === "past" && l.status !== "cancelled" && marked < ids.length;
  const live = l.status === "scheduled" && state === "live";
  const status =
    l.status === "cancelled"
      ? "Отменено"
      : l.status === "completed"
        ? "Завершено"
        : live
          ? "Идёт сейчас"
          : state === "past"
            ? "Ожидает закрытия"
            : "Запланировано";
  return (
    <article
      className={"lesson " + (waiting ? "attention " : live ? "live " : "")}
    >
      <div className="lesson-main">
        <div className="lesson-time">
          <b>{l.start}</b>
          <small>{l.end}</small>
        </div>
        <div className="lesson-content">
          <div className="lesson-title">
            <h3>{l.title}</h3>
            <span
              className={
                "badge " +
                (waiting
                  ? "red"
                  : l.status === "completed"
                    ? "green"
                    : live
                      ? "blue"
                      : "")
              }
            >
              {status}
              {l.status !== "cancelled" &&
                " · " +
                  (marked === ids.length && ids.length
                    ? "Явка отмечена"
                    : marked + "/" + ids.length + " отмечено")}
            </span>
          </div>
          <div className="lesson-meta">
            <span>
              <Icon name="user" />
              {s.teachers.find((x) => x.id === l.teacherId)?.name}
            </span>
            <i />
            <span>
              <Icon name="room" />
              {s.rooms.find((x) => x.id === l.roomId)?.name}
            </span>
            <i />
            <span>
              {ids.length} уч.
              {l.type === "individual"
                ? " · индивидуальное"
                : l.type === "makeup"
                  ? " · отработка"
                  : ""}
            </span>
          </div>
        </div>
      </div>
      <Button
        primary={waiting && allowed(user, "attendance")}
        onClick={() =>
          waiting && allowed(user, "attendance")
            ? a.attendance(l)
            : ctx.lesson(l.id)
        }
      >
        {waiting && allowed(user, "attendance")
          ? "Отметить явку"
          : l.status === "completed"
            ? "Журнал"
            : "Детали"}
        <Icon name="chevron" />
      </Button>
    </article>
  );
}
export function Dashboard(
  ctx: Workspace & { date: string; setDate: (d: string) => void },
) {
  const { s, user, a, date } = ctx;
  const m = metrics(s, date),
    alerts = notifications(s);
  const stats = [
    {
      label: "Занятий за день",
      value: m.total,
      note:
        new Set(
          s.lessons
            .filter((l) => l.date === date)
            .map((l) => l.groupId)
            .filter(Boolean),
        ).size + " групп",
      icon: "calendar",
      color: "blue",
    },
    {
      label: "Проведено",
      value: m.completed,
      note: m.present + " учеников присутствовало",
      icon: "check",
      color: "green",
    },
    {
      label: "Ожидают проведения",
      value: m.scheduled,
      note: "Запланированные занятия",
      icon: "clock",
      color: "blue",
    },
    {
      label: "Отменено",
      value: m.cancelled,
      note: "Без списания занятий",
      icon: "warning",
      color: "red",
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="title-line">
            <h1 tabIndex={-1}>Главная</h1>
            <span className="badge blue">
              {s.demo ? "Демо · серверные данные" : "Рабочий учёт"}
            </span>
          </div>
          <p>
            {new Date(date + "T12:00Z").toLocaleDateString("ru-RU", {
              dateStyle: "full",
            })}{" "}
            · {s.branches[0]?.name}{" "}
            <span className="healthy">● Сервер подключён</span>
          </p>
        </div>
        <div className="actions">
          {allowed(user, "payment") && (
            <Button onClick={() => a.payment()}>
              <Icon name="money" />
              Принять оплату
            </Button>
          )}
          {allowed(user, "lesson") && (
            <Button primary onClick={() => a.lesson()}>
              <Icon name="plus" />
              Добавить занятие
            </Button>
          )}
        </div>
      </div>
      <div className="metrics">
        {stats.map((x) => (
          <section className="metric panel" key={x.label}>
            <div className="metric-head">
              <span>{x.label}</span>
              <span className={"metric-icon " + x.color}>
                <Icon name={x.icon} />
              </span>
            </div>
            <strong className={x.color === "red" ? "danger-text" : ""}>
              {x.value}
            </strong>
            <p>{x.note}</p>
            <progress
              max={Math.max(m.total, 1)}
              value={x.value}
              className={x.color}
            />
          </section>
        ))}
      </div>
      <div className="dashboard-grid">
        <Schedule {...ctx} compact />
        <aside className="right-column">
          <section className="panel attention-panel">
            <div className="panel-heading">
              <h2>
                <span className="dot red" />
                Требуют внимания
              </h2>
              <span className="badge red">{alerts.length}</span>
            </div>
            {!alerts.length && <Empty>Нет нерешённых событий</Empty>}
            {alerts.slice(0, 6).map((n) => (
              <div className="alert-card" key={n.id}>
                <div>
                  <Icon name={n.kind === "debt" ? "money" : "warning"} />
                  <span>{n.title}</span>
                </div>
                <Button
                  onClick={() =>
                    n.kind === "debt"
                      ? a.invoice(n.studentId)
                      : n.lessonId && ctx.lesson(n.lessonId)
                  }
                >
                  {n.kind === "debt"
                    ? "Счёт / напоминание"
                    : n.kind === "teacher"
                      ? "Назначить замену"
                      : "Внести явку"}
                  <Icon name="chevron" />
                </Button>
              </div>
            ))}
          </section>
          <section className="panel">
            <h2>Быстрые действия</h2>
            <div className="quick-actions">
              {allowed(user, "lesson") && (
                <Button onClick={() => a.lesson()}>
                  <Icon name="calendar" />
                  Новое занятие
                </Button>
              )}
              {allowed(user, "enroll") && (
                <Button onClick={() => a.enroll()}>
                  <Icon name="user" />
                  Записать уч-ка
                </Button>
              )}
              {allowed(user, "save", "groups") && (
                <Button onClick={() => a.edit("groups")}>
                  <Icon name="people" />
                  Создать группу
                </Button>
              )}
              {allowed(user, "payment") && (
                <Button onClick={() => a.payment()}>
                  <Icon name="money" />
                  Принять оплату
                </Button>
              )}
            </div>
          </section>
          <section className="panel">
            <Weekly s={s} date={date} setDate={ctx.setDate} />
            <h3 className="eyebrow">Журнал действий</h3>
            {s.audit.length ? (
              s.audit
                .slice(-5)
                .reverse()
                .map((e) => (
                  <div className="feed-item" key={e.id}>
                    <span className="dot green" />
                    <div>
                      <span>{auditName(e.action)}</span>
                      <small>
                        {new Date(e.at).toLocaleString("ru-RU", {
                          timeZone: s.school.timezone,
                        })}{" "}
                        · {e.actorId}
                      </small>
                    </div>
                  </div>
                ))
            ) : (
              <Empty>Новых действий пока нет</Empty>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
export function Weekly({
  s,
  date,
  setDate,
}: {
  s: State;
  date: string;
  setDate: (d: string) => void;
}) {
  const dow = new Date(date + "T12:00Z").getUTCDay();
  const first = addDays(date, -((dow + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const counts = days.map(
    (d) =>
      s.lessons.filter((l) => l.date === d && l.status !== "cancelled").length,
  );
  return (
    <>
      <div className="panel-heading">
        <h2>Недельная загрузка</h2>
        <small>{counts.reduce((a, b) => a + b, 0)} зан. / нед</small>
      </div>
      <div className="weekly">
        {days.map((d, i) => (
          <button
            key={d}
            className={date === d ? "selected" : ""}
            onClick={() => setDate(d)}
            aria-label={d + ": " + counts[i] + " занятий"}
          >
            <span>{counts[i]}</span>
            <meter min={0} max={Math.max(...counts, 1)} value={counts[i]} />
            <small>{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][i]}</small>
          </button>
        ))}
      </div>
    </>
  );
}
export function Schedule(
  ctx: Workspace & {
    date: string;
    setDate: (d: string) => void;
    compact?: boolean;
  },
) {
  const { s, user, a, date, setDate, compact } = ctx;
  const [filter, setFilter] = useState("all"),
    [teacher, setTeacher] = useState(""),
    [room, setRoom] = useState(""),
    [group, setGroup] = useState(""),
    [view, setView] = useState("day");
  const ls = s.lessons
    .filter(
      (l) =>
        (view === "month" && !compact
          ? l.date.slice(0, 7) === date.slice(0, 7)
          : view === "week" && !compact
            ? l.date >=
                addDays(
                  date,
                  -((new Date(date + "T12:00Z").getUTCDay() + 6) % 7),
                ) &&
              l.date <=
                addDays(
                  date,
                  6 - ((new Date(date + "T12:00Z").getUTCDay() + 6) % 7),
                )
            : l.date === date) &&
        (!teacher || l.teacherId === teacher) &&
        (!room || l.roomId === room) &&
        (!group || l.groupId === group),
    )
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const tabs = [
    ["all", "Все"],
    ["live", "Идут сейчас"],
    ["scheduled", "Предстоящие"],
    ["completed", "Завершённые"],
    ["unmarked", "Требуют отметки"],
    ["cancelled", "Отменённые"],
  ];
  const match = (l: Lesson, id: string) => {
    switch (id) {
      case "all":
        return true;
      case "live":
        return l.status === "scheduled" && temporal(l, s) === "live";
      case "unmarked":
        return (
          l.status !== "cancelled" &&
          temporal(l, s) === "past" &&
          participantIds(s, l).some(
            (id) =>
              !s.attendance.some(
                (x) =>
                  x.lessonId === l.id &&
                  x.studentId === id &&
                  x.state !== "unmarked",
              ),
          )
        );
      case "scheduled":
        return l.status === "scheduled" && temporal(l, s) === "future";
      default:
        return l.status === id;
    }
  };
  const visible = ls.filter((l) => match(l, filter));
  return (
    <div className="schedule-column">
      {!compact && (
        <div className="page-heading">
          <h1 tabIndex={-1}>Расписание</h1>
          {allowed(user, "lesson") && (
            <Button primary onClick={() => a.lesson()}>
              Добавить занятие
            </Button>
          )}
        </div>
      )}
      <section className="panel toolbar">
        <div className="toolbar-top">
          <h2>
            Расписание {compact ? "на день" : ""}{" "}
            <span className="badge">{ls.length} занятий</span>
          </h2>
          <div className="day-picker">
            <button
              onClick={() => setDate(addDays(today(s.school.timezone), -1))}
            >
              Вчера
            </button>
            <button onClick={() => setDate(today(s.school.timezone))}>
              Сегодня
            </button>
            <button
              onClick={() => setDate(addDays(today(s.school.timezone), 1))}
            >
              Завтра
            </button>
          </div>
        </div>
        <label className="inline-label">
          Дата
          <input
            type="date"
            aria-label="Выбранная дата"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        {!compact && (
          <div className="filters">
            <label>
              Период
              <select value={view} onChange={(e) => setView(e.target.value)}>
                <option value="day">День</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
              </select>
            </label>
            <label>
              Преподаватель
              <select
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
              >
                <option value="">Все</option>
                {s.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Кабинет
              <select value={room} onChange={(e) => setRoom(e.target.value)}>
                <option value="">Все</option>
                {s.rooms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Группа
              <select value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">Все</option>
                {s.groups.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="chips" role="group" aria-label="Статус занятия">
          {tabs.map(([id, title]) => (
            <button
              key={id}
              className={filter === id ? "active" : ""}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {title} ({ls.filter((l) => match(l, id)).length})
            </button>
          ))}
        </div>
      </section>
      {!compact && (view === "week" || view === "month") && (
        <section
          className="panel calendar-grid"
          aria-label="Сетка расписания по дням"
        >
          {Array.from(
            {
              length:
                view === "month"
                  ? new Date(
                      Number(date.slice(0, 4)),
                      Number(date.slice(5, 7)),
                      0,
                    ).getDate()
                  : 7,
            },
            (_, i) =>
              view === "month"
                ? addDays(date.slice(0, 7) + "-01", i)
                : addDays(
                    date,
                    i - ((new Date(date + "T12:00Z").getUTCDay() + 6) % 7),
                  ),
          ).map((d) => (
            <div key={d}>
              <h3>
                {new Date(d + "T12:00Z").toLocaleDateString("ru-RU", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </h3>
              {visible
                .filter((l) => l.date === d)
                .map((l) => (
                  <button key={l.id} onClick={() => ctx.lesson(l.id)}>
                    <b>
                      {l.start}–{l.end}
                    </b>
                    {l.title}
                    <small>
                      {s.rooms.find((x) => x.id === l.roomId)?.name}
                    </small>
                  </button>
                ))}
            </div>
          ))}
        </section>
      )}
      {visible.length ? (
        visible.map((l) => (
          <div key={l.id}>
            {view !== "day" && !compact && <small>{l.date}</small>}
            <LessonCard l={l} ctx={ctx} />
          </div>
        ))
      ) : (
        <Empty>Занятий по выбранным условиям нет</Empty>
      )}
    </div>
  );
}
export function Registry({
  entity,
  ctx,
}: {
  entity: "students" | "teachers" | "groups";
  ctx: Workspace;
}) {
  const { s, user, a } = ctx;
  const [q, setQ] = useState(""),
    [archived, setArchived] = useState(false);
  const names = {
    students: "Ученики",
    teachers: "Преподаватели",
    groups: "Группы",
  };
  const rows = s[entity].filter(
    (x) =>
      x.name.toLowerCase().includes(q.toLowerCase()) &&
      (archived ||
        (!("archived" in x && x.archived) && !("active" in x && !x.active))),
  );
  return (
    <>
      <div className="page-heading">
        <h1 tabIndex={-1}>{names[entity]}</h1>
        {allowed(user, "save", entity) && (
          <Button primary onClick={() => a.edit(entity)}>
            Добавить{" "}
            {entity === "students"
              ? "ученика"
              : entity === "teachers"
                ? "преподавателя"
                : "группу"}
          </Button>
        )}
      </div>
      <section className="panel">
        <div className="filters">
          <label>
            Поиск
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Имя или название"
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Включая архив / неактивных
          </label>
          {entity === "students" && user.role !== "teacher" && (
            <>
              <a className="btn" href="/api/export/students.csv">
                Выгрузить CSV
              </a>
              {allowed(user, "import-students") && (
                <Button onClick={a.importStudents}>Импорт CSV</Button>
              )}
            </>
          )}
          {entity === "students" && allowed(user, "enroll") && (
            <Button onClick={() => a.enroll()}>Записать в группу</Button>
          )}
        </div>
        <Table
          head={["Имя / название", "Сведения", "Действия"]}
          rows={rows.map((x) => [
            <button
              className="text-link"
              onClick={() => ctx.profile(entity, x.id)}
            >
              {x.name}
            </button>,
            entity === "students" ? (
              <span>
                Групп:{" "}
                {
                  s.enrollments.filter(
                    (e) =>
                      e.studentId === x.id &&
                      (!e.through || e.through >= today(s.school.timezone)),
                  ).length
                }
                {user.role !== "teacher" && (
                  <> · Долг: {money(balance(s, x.id))}</>
                )}
              </span>
            ) : entity === "teachers" ? (
              <span>
                {"subject" in x ? x.subject : ""} ·{" "}
                {s.lessons.filter((l) => l.teacherId === x.id).length} занятий
              </span>
            ) : (
              <span>
                {"capacity" in x ? x.capacity : 0} мест ·{" "}
                {
                  s.teachers.find(
                    (t) => t.id === ("teacherId" in x ? x.teacherId : ""),
                  )?.name
                }
              </span>
            ),
            <div className="row-actions">
              <Button onClick={() => ctx.profile(entity, x.id)}>
                Карточка
              </Button>
              {allowed(user, "save", entity) && (
                <Button onClick={() => a.edit(entity, x)}>Изменить</Button>
              )}
            </div>,
          ])}
        />
      </section>
    </>
  );
}
export function LessonRegistry(ctx: Workspace) {
  const { s } = ctx;
  const [q, setQ] = useState(""),
    [from, setFrom] = useState(""),
    [through, setThrough] = useState("");
  const lessons = s.lessons
    .filter(
      (l) =>
        l.title.toLowerCase().includes(q.toLowerCase()) &&
        (!from || l.date >= from) &&
        (!through || l.date <= through),
    )
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  return (
    <>
      <div className="page-heading">
        <h1 tabIndex={-1}>Занятия и журнал</h1>
        {allowed(ctx.user, "lesson") && (
          <Button primary onClick={() => ctx.a.lesson()}>
            Добавить занятие
          </Button>
        )}
      </div>
      <section className="panel">
        <div className="filters">
          <label>
            Поиск
            <input value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label>
            С даты
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            По дату
            <input
              type="date"
              value={through}
              onChange={(e) => setThrough(e.target.value)}
            />
          </label>
        </div>
        <Table
          head={["Дата / время", "Занятие", "Состояние", "Журнал"]}
          rows={lessons.map((l) => [
            `${l.date} ${l.start}–${l.end}`,
            l.title,
            l.status === "completed"
              ? "Завершено"
              : l.status === "cancelled"
                ? "Отменено"
                : "Запланировано",
            <Button onClick={() => ctx.lesson(l.id)}>Открыть журнал</Button>,
          ])}
        />
        <h2>Посещаемость за выбранный период</h2>
        <Table
          head={[
            "Ученик",
            ...lessons.slice(0, 10).map((l) => l.date + " " + l.start),
          ]}
          rows={s.students
            .filter((x) =>
              lessons.some((l) => participantIds(s, l).includes(x.id)),
            )
            .map((student) => [
              student.name,
              ...lessons
                .slice(0, 10)
                .map((l) =>
                  participantIds(s, l).includes(student.id)
                    ? attendanceNames[
                        s.attendance.find(
                          (x) =>
                            x.studentId === student.id && x.lessonId === l.id,
                        )?.state || "unmarked"
                      ]
                    : "—",
                ),
            ])}
        />
        <small>
          В матрице отображаются первые 10 занятий периода. Полная история
          доступна в карточке занятия и аудите.
        </small>
      </section>
    </>
  );
}
export function Finance(ctx: Workspace) {
  const { s, user, a } = ctx;
  const [q, setQ] = useState(""),
    [from, setFrom] = useState(""),
    [through, setThrough] = useState(""),
    [method, setMethod] = useState("");
  const payments = s.payments.filter(
    (p) =>
      (!from || p.date >= from) &&
      (!through || p.date <= through) &&
      (!method || p.method === method) &&
      (s.students.find((x) => x.id === p.studentId)?.name || "")
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <h1 tabIndex={-1}>Финансы</h1>
        <div className="actions">
          {allowed(user, "issue") && (
            <Button onClick={() => a.issue()}>Выдать абонемент</Button>
          )}
          {allowed(user, "payment") && (
            <Button primary onClick={() => a.payment()}>
              Принять оплату
            </Button>
          )}
        </div>
      </div>
      <section className="panel">
        <h2>Тарифы</h2>
        {allowed(user, "save", "tariffs") && (
          <Button onClick={() => a.edit("tariffs")}>Добавить тариф</Button>
        )}
        <Table
          head={["Тариф / предмет", "Стоимость", "Лимит / срок", "Действия"]}
          rows={s.tariffs.map((t) => [
            t.name + " · " + t.subject,
            money(t.priceKopecks),
            t.lessons + " зан. / " + t.validDays + " дн.",
            allowed(user, "save", "tariffs") ? (
              <Button onClick={() => a.edit("tariffs", t)}>Изменить</Button>
            ) : (
              "—"
            ),
          ])}
        />
      </section>
      <section className="panel">
        <h2>Абонементы, остатки и долг</h2>
        <Table
          head={["Ученик / тариф", "Действует", "Остаток", "Долг", "Действия"]}
          rows={s.subscriptions.map((x) => [
            <button
              className="text-link"
              onClick={() => ctx.profile("students", x.studentId)}
            >
              {s.students.find((t) => t.id === x.studentId)?.name}
              <small>{s.tariffs.find((t) => t.id === x.tariffId)?.name}</small>
            </button>,
            `${x.from} — ${x.through}${x.closed ? " · закрыт" : x.frozen ? " · заморожен" : ""}`,
            remaining(s, x.id) + " / " + x.granted,
            money(outstanding(s, x.id)),
            <div className="row-actions">
              {allowed(user, "payment") && !x.closed && (
                <Button onClick={() => a.payment(x.studentId, x.id)}>
                  Оплатить
                </Button>
              )}
              {allowed(user, "subscription") && !x.closed && (
                <>
                  <Button
                    onClick={() =>
                      a.subscription(x.id, x.frozen ? "unfreeze" : "freeze")
                    }
                  >
                    {x.frozen ? "Разморозить" : "Заморозить"}
                  </Button>
                  <Button onClick={() => a.subscription(x.id, "extend")}>
                    Продлить
                  </Button>
                  <Button onClick={() => a.subscription(x.id, "return")}>
                    Возврат остатка
                  </Button>
                </>
              )}
            </div>,
          ])}
        />
      </section>
      <section className="panel">
        <h2>Финансовый реестр</h2>
        <a className="btn" href="/api/export/finance.csv">
          Выгрузить реестр CSV
        </a>
        <div className="filters">
          <label>
            Ученик
            <input value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label>
            С даты
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            По дату
            <input
              type="date"
              value={through}
              onChange={(e) => setThrough(e.target.value)}
            />
          </label>
          <label>
            Способ
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">Все</option>
              <option value="card">Карта</option>
              <option value="cash">Наличные</option>
              <option value="transfer">Перевод</option>
            </select>
          </label>
        </div>
        <p>
          Получено за период (за вычетом возвратов):{" "}
          <b>
            {money(
              payments.reduce(
                (a, x) =>
                  a +
                  (x.kind === "payment" ? x.amountKopecks : -x.amountKopecks),
                0,
              ),
            )}
          </b>
        </p>
        <Table
          head={[
            "Операция / дата",
            "Ученик",
            "Сумма / метод",
            "Основание / связь",
            "Действия",
          ]}
          rows={payments.map((p) => [
            <span>
              {p.kind === "refund" ? "Возврат" : "Оплата"}
              <small>
                {p.date} · {p.id}
              </small>
            </span>,
            s.students.find((x) => x.id === p.studentId)?.name,
            money(p.amountKopecks) +
              " · " +
              { card: "карта", cash: "наличные", transfer: "перевод" }[
                p.method
              ],
            <span>
              {p.comment}
              <small>
                Абонемент: {p.subscriptionId}
                {p.reverses && " · Исходная: " + p.reverses}
              </small>
            </span>,
            p.kind === "payment" && allowed(user, "refund") ? (
              <Button onClick={() => a.refund(p.id)}>Оформить возврат</Button>
            ) : (
              "—"
            ),
          ])}
        />
        <h3>Начисления и корректировки</h3>
        <Table
          head={[
            "Дата / операция",
            "Ученик",
            "Сумма",
            "Основание / исходная операция",
          ]}
          rows={s.charges
            .filter(
              (x) =>
                (!from || x.date >= from) &&
                (!through || x.date <= through) &&
                (s.students.find((st) => st.id === x.studentId)?.name || "")
                  .toLowerCase()
                  .includes(q.toLowerCase()),
            )
            .map((x) => [
              x.date + " · " + (x.kind === "charge" ? "Начисление" : "Кредит"),
              s.students.find((t) => t.id === x.studentId)?.name,
              money(x.amountKopecks),
              x.reason + (x.reverses ? " · " + x.reverses : ""),
            ])}
        />
        <h3>Счета / черновики интеграций</h3>
        {allowed(user, "invoice") && (
          <Button onClick={() => a.invoice()}>
            Создать счёт / напоминание
          </Button>
        )}
        <Table
          head={["Номер / срок", "Сумма", "Канал / состояние", "Действие"]}
          rows={s.invoices.map((x) => [
            x.number + " · " + x.dueDate,
            money(x.amountKopecks),
            x.channel +
              " · " +
              (x.state === "draft"
                ? "Черновик"
                : x.state === "test-accepted"
                  ? "Принято ТЕСТОВЫМ адаптером"
                  : "Ошибка"),
            x.state === "draft" && allowed(user, "deliver") ? (
              <Button
                onClick={() =>
                  void ctx.run({ type: "deliver", invoiceId: x.id })
                }
              >
                {s.demo
                  ? "Проверить тестовый адаптер"
                  : "Отправить (нужен провайдер)"}
              </Button>
            ) : (
              "Без реальной отправки"
            ),
          ])}
        />
      </section>
    </>
  );
}
export function Analytics(ctx: Workspace) {
  const { s } = ctx;
  const d = today(s.school.timezone);
  const [from, setFrom] = useState(addDays(d, -30)),
    [through, setThrough] = useState(d);
  const ls = s.lessons.filter((l) => l.date >= from && l.date <= through),
    att = s.attendance.filter((a) => ls.some((l) => l.id === a.lessonId));
  const cohort = retention(s, from, through);
  const paid = s.payments
    .filter((p) => p.date >= from && p.date <= through)
    .reduce(
      (a, p) => a + (p.kind === "payment" ? p.amountKopecks : -p.amountKopecks),
      0,
    );
  return (
    <>
      <div className="page-heading">
        <h1 tabIndex={-1}>Статистика</h1>
      </div>
      <section className="panel">
        <div className="filters">
          <label>
            С даты
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            По дату
            <input
              type="date"
              value={through}
              onChange={(e) => setThrough(e.target.value)}
            />
          </label>
        </div>
        {from > through && (
          <p className="error" role="alert">
            Начало периода позже окончания
          </p>
        )}
        <p>
          Удержание: {cohort.retained} из {cohort.initial} учеников с активной
          записью на начало периода остались с активной записью на конец. Новых
          за период: {cohort.newStudents}.
        </p>
        <p>
          Оплаты минус возвраты: <b>{money(paid)}</b>. Текущая задолженность:{" "}
          <b>
            {money(
              s.students.reduce((a, x) => a + Math.max(balance(s, x.id), 0), 0),
            )}
          </b>
          .
        </p>
        <p>
          Проведено: {ls.filter((l) => l.status === "completed").length} из{" "}
          {ls.length}. Посещаемость:{" "}
          {att.filter((a) => a.state === "present").length} присутствий из{" "}
          {att.filter((a) => a.state !== "unmarked").length} отмеченных; «не
          отмечено» исключается.
        </p>
        <h2>Нагрузка и расчёт вознаграждения</h2>
        <Table
          head={["Преподаватель", "Проведено", "Ставка", "Расчёт (не выплата)"]}
          rows={s.teachers.map((t) => {
            const count = ls.filter(
              (l) => l.teacherId === t.id && l.status === "completed",
            ).length;
            return [
              t.name,
              count,
              money(t.rateKopecks),
              money(t.rateKopecks * count),
            ];
          })}
        />
        <small>
          Расчёт использует текущую ставку преподавателя; исторические ставки и
          фактические выплаты не реализованы.
        </small>
        <h2>Задолженность на {through} — раскрытие до профиля</h2>
        <Table
          head={["Ученик", "Долг", "Профиль"]}
          rows={s.students
            .filter((x) => balanceAt(s, x.id, through) > 0)
            .map((x) => [
              x.name,
              money(balanceAt(s, x.id, through)),
              <Button onClick={() => ctx.profile("students", x.id)}>
                Открыть профиль
              </Button>,
            ])}
        />
      </section>
    </>
  );
}
export function Settings(ctx: Workspace) {
  const { s, user, a } = ctx;
  const [q, setQ] = useState("");
  return (
    <>
      <div className="page-heading">
        <h1 tabIndex={-1}>Настройки</h1>
        {allowed(user, "settings") && (
          <Button primary onClick={a.settings}>
            Настройки школы
          </Button>
        )}
      </div>
      <section className="panel">
        <h2>{s.school.name}</h2>
        <p>
          {s.school.academicYear} · {s.school.timezone} · Закрыто по:{" "}
          {s.school.closedThrough || "нет закрытого периода"}
        </p>
        <h3>Филиалы</h3>
        {allowed(user, "save", "branches") && user.role === "director" && (
          <Button onClick={() => a.edit("branches")}>Добавить филиал</Button>
        )}
        <Table
          head={["Название", "ID", "Действия"]}
          rows={s.branches.map((x) => [
            x.name,
            x.id,
            user.role === "director" ? (
              <Button onClick={() => a.edit("branches", x)}>Изменить</Button>
            ) : (
              "—"
            ),
          ])}
        />
        <h3>Кабинеты</h3>
        {allowed(user, "save", "rooms") && (
          <Button onClick={() => a.edit("rooms")}>Добавить кабинет</Button>
        )}
        <Table
          head={["Кабинет", "Вместимость", "Действия"]}
          rows={s.rooms.map((x) => [
            x.name,
            x.capacity,
            allowed(user, "save", "rooms") ? (
              <Button onClick={() => a.edit("rooms", x)}>Изменить</Button>
            ) : (
              "—"
            ),
          ])}
        />
        <h3>Нерабочие даты</h3>
        {allowed(user, "save", "calendar") && (
          <Button onClick={() => a.edit("calendar")}>
            Добавить нерабочую дату
          </Button>
        )}
        <Table
          head={["Дата", "Кабинет", "Причина"]}
          rows={s.calendar.map((x) => [
            x.date,
            s.rooms.find((r) => r.id === x.roomId)?.name || "Весь филиал",
            x.reason,
          ])}
        />
      </section>
      <section className="panel">
        <h2>Аудит действий</h2>
        <label>
          Поиск по действию / объекту
          <input value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Table
          head={[
            "Время / автор",
            "Действие",
            "Объект / основание",
            "Изменение",
          ]}
          rows={s.audit
            .filter((x) =>
              (x.action + " " + x.entityId + " " + x.reason)
                .toLowerCase()
                .includes(q.toLowerCase()),
            )
            .slice()
            .reverse()
            .map((x) => [
              new Date(x.at).toLocaleString("ru-RU", {
                timeZone: s.school.timezone,
              }) +
                " · " +
                x.actorId,
              auditName(x.action),
              x.entityId + " · " + x.reason,
              <details>
                <summary>До / после</summary>
                <pre>
                  {JSON.stringify(
                    { before: x.before, after: x.after },
                    null,
                    2,
                  )}
                </pre>
              </details>,
            ])}
        />
      </section>
    </>
  );
}
export function Profile({
  entity,
  id,
  ctx,
}: {
  entity: "students" | "groups" | "teachers";
  id: string;
  ctx: Workspace;
}) {
  const { s, user, a } = ctx;
  const record = s[entity].find((x) => x.id === id);
  if (!record) return <Empty>Объект не найден или недоступен</Empty>;
  const lessons = s.lessons
    .filter((l) =>
      entity === "students"
        ? participantIds(s, l).includes(id)
        : entity === "groups"
          ? l.groupId === id
          : l.teacherId === id,
    )
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return (
    <>
      <h3>{record.name}</h3>
      <p>ID: {record.id}</p>
      {"contact" in record && <p>Контакт: {record.contact || "не указан"}</p>}
      {allowed(user, "save", entity) && (
        <Button onClick={() => a.edit(entity, record)}>Изменить данные</Button>
      )}
      {entity === "students" && (
        <>
          <h3>Группы и история записи</h3>
          {allowed(user, "enroll") && (
            <Button onClick={() => a.enroll(id)}>Записать в группу</Button>
          )}
          {s.enrollments
            .filter((e) => e.studentId === id)
            .map((e) => (
              <div className="detail-block" key={e.id}>
                <b>{s.groups.find((g) => g.id === e.groupId)?.name}</b>
                <p>
                  {e.from} — {e.through || "без окончания"}
                </p>
                {allowed(user, "withdraw") && (
                  <div className="actions">
                    <Button onClick={() => a.withdraw(e.id)}>
                      Завершить запись
                    </Button>
                    <Button onClick={() => a.enroll(id, e.id)}>
                      Перевести
                    </Button>
                  </div>
                )}
              </div>
            ))}
          <h3>Представители</h3>
          {allowed(user, "save", "representatives") && (
            <Button
              onClick={() => a.edit("representatives", { studentId: id })}
            >
              Добавить представителя
            </Button>
          )}
          {s.representatives
            .filter((r) => r.studentId === id)
            .map((r) => (
              <div className="detail-block" key={r.id}>
                {r.name} · {r.contact} · {r.channel}
                {allowed(user, "save", "representatives") && (
                  <Button onClick={() => a.edit("representatives", r)}>
                    Изменить
                  </Button>
                )}
              </div>
            ))}
          {user.role !== "teacher" && (
            <>
              <h3>Абонементы и баланс</h3>
              <p>
                Долг: {money(balance(s, id))}. Просрочено:{" "}
                {money(overdue(s, id))}. Срок оплаты — дата выдачи абонемента.
              </p>
              {allowed(user, "issue") && (
                <Button onClick={() => a.issue(id)}>Выдать абонемент</Button>
              )}
              {s.subscriptions
                .filter((x) => x.studentId === id)
                .map((x) => (
                  <div className="detail-block" key={x.id}>
                    {s.tariffs.find((t) => t.id === x.tariffId)?.name}
                    <p>
                      Остаток: {remaining(s, x.id)} · {x.from}–{x.through} ·
                      Долг {money(outstanding(s, x.id))}
                    </p>
                    {allowed(user, "payment") && (
                      <Button onClick={() => a.payment(id, x.id)}>
                        Оплатить
                      </Button>
                    )}
                  </div>
                ))}
            </>
          )}
        </>
      )}
      {entity === "groups" && (
        <>
          <h3>Состав группы на сегодня</h3>
          {s.enrollments
            .filter(
              (e) =>
                e.groupId === id &&
                e.from <= today(s.school.timezone) &&
                (!e.through || e.through >= today(s.school.timezone)),
            )
            .map((e) => (
              <p key={e.id}>
                <button
                  className="text-link"
                  onClick={() => ctx.profile("students", e.studentId)}
                >
                  {s.students.find((x) => x.id === e.studentId)?.name}
                </button>{" "}
                · с {e.from}
              </p>
            ))}
        </>
      )}
      <h3>Расписание / явка</h3>
      {lessons.map((l) => (
        <div className="detail-block" key={l.id}>
          <button className="text-link" onClick={() => ctx.lesson(l.id)}>
            {l.date} {l.start} · {l.title}
          </button>
          {entity === "students" && (
            <p>
              {
                attendanceNames[
                  s.attendance.find(
                    (x) => x.lessonId === l.id && x.studentId === id,
                  )?.state || "unmarked"
                ]
              }
            </p>
          )}
        </div>
      ))}
      {!lessons.length && <Empty />}
    </>
  );
}
export function LessonDetails({ l, ctx }: { l: Lesson; ctx: Workspace }) {
  const { s, user, a } = ctx;
  return (
    <>
      <h3>{l.title}</h3>
      <p>
        {l.date} · {l.start}–{l.end} ·{" "}
        {l.status === "cancelled"
          ? "Отменено"
          : l.status === "completed"
            ? "Завершено"
            : "Запланировано"}{" "}
        · Время:{" "}
        {
          { past: "прошло", live: "идёт сейчас", future: "предстоит" }[
            temporal(l, s)
          ]
        }
      </p>
      <p>
        {s.teachers.find((t) => t.id === l.teacherId)?.name} ·{" "}
        {s.rooms.find((t) => t.id === l.roomId)?.name}
      </p>
      {l.reason && <p>Основание: {l.reason}</p>}
      <div className="actions">
        {allowed(user, "attendance") &&
          l.status !== "cancelled" &&
          temporal(l, s) === "past" && (
            <Button primary onClick={() => a.attendance(l)}>
              Отметить посещаемость
            </Button>
          )}
        {allowed(user, "lesson") && l.status === "scheduled" && (
          <>
            <Button onClick={() => a.lesson(l)}>
              Изменить / перенести / заменить
            </Button>
            <Button onClick={() => a.transition(l, "cancelled")}>
              Отменить занятие
            </Button>
          </>
        )}
        {allowed(user, "transition") && l.status === "cancelled" && (
          <Button onClick={() => a.transition(l, "scheduled")}>
            Восстановить занятие
          </Button>
        )}
        {user.role === "director" && l.status === "completed" && (
          <Button onClick={() => a.transition(l, "cancelled")}>
            Отменить закрытое занятие
          </Button>
        )}
      </div>
      <h3>Журнал посещаемости</h3>
      <Table
        head={["Ученик", "Посещаемость", "Причина", "Списание"]}
        rows={participantIds(s, l).map((id) => {
          const a = s.attendance.find(
            (x) => x.lessonId === l.id && x.studentId === id,
          );
          return [
            s.students.find((x) => x.id === id)?.name,
            attendanceNames[a?.state || "unmarked"],
            a?.reason || "—",
            s.debits
              .filter((x) => x.lessonId === l.id && x.studentId === id)
              .reduce((sum, x) => sum + x.units, 0),
          ];
        })}
      />
      <h3>История и корректировки</h3>
      {s.audit
        .filter((e) => e.entityId === l.id)
        .map((e) => (
          <div className="detail-block" key={e.id}>
            <b>{auditName(e.action)}</b>
            <p>
              {e.at} · {e.actorId} · {e.reason}
            </p>
            <details>
              <summary>До / после</summary>
              <pre>
                {JSON.stringify({ before: e.before, after: e.after }, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      {!s.audit.some((e) => e.entityId === l.id) && (
        <Empty>История изменений пока пуста</Empty>
      )}
    </>
  );
}
export function auditName(action: string) {
  const names: Record<string, string> = {
    lesson: "Изменение занятия",
    attendance: "Посещаемость и списание",
    enroll: "Запись / перевод в группу",
    withdraw: "Завершение записи",
    issue: "Выдача абонемента",
    payment: "Приём оплаты",
    refund: "Возврат оплаты",
    subscription: "Изменение абонемента",
    transition: "Изменение статуса занятия",
    invoice: "Создание счёта / черновика",
    deliver: "Тест адаптера",
    settings: "Настройки школы",
    "read-notification": "Прочтение уведомления",
    "import-students": "Импорт учеников",
    "save:representatives": "Сохранение представителя",
    "save:branches": "Сохранение филиала",
    "save:rooms": "Сохранение кабинета",
    "save:calendar": "Сохранение календаря",
    "save:students": "Сохранение ученика",
    "save:teachers": "Сохранение преподавателя",
    "save:groups": "Сохранение группы",
    "save:tariffs": "Сохранение тарифа",
  };
  return names[action] || action;
}
