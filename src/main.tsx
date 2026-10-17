import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import parse, {
  domToReact,
  Element,
  type HTMLReactParserOptions,
} from "html-react-parser";
import template from "./template.html?raw";
import {
  repository,
  initial,
  notifications,
  dailySummary,
  type Lesson,
  type Store,
} from "./data";
import "./style.css";
import { LessonCard, Toast } from "./components";
const icon = (s: string) => (
  <span className="material-symbols-outlined" aria-hidden="true">
    {s}
  </span>
);
const titles: Record<string, string> = {
  lesson: "Добавить занятие",
  payment: "Принять оплату",
  student: "Записать ученика",
  group: "Создать группу",
  move: "Перенести занятие",
  cancel: "Отменить занятие",
  attendance: "Посещаемость",
  conflict: "Разрешить конфликт",
  draft: "Напоминание / Счёт",
  substitute: "Назначить замену",
  details: "Данные занятия",
  help: "Помощь и связь",
  profile: "Профиль администратора",
};
function App() {
  const [data, setData] = useState(repository.load),
    [page, setPage] = useState(location.pathname),
    [filter, setFilter] = useState("Все"),
    [day, setDay] = useState("2024-10-18"),
    [query, setQuery] = useState(""),
    [record, setRecord] = useState(""),
    [pop, setPop] = useState(""),
    [mobile, setMobile] = useState(false),
    [modal, setModal] = useState(""),
    [selected, setSelected] = useState<Lesson | null>(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    form = useRef<HTMLFormElement>(null),
    previousFocus = useRef<HTMLElement | null>(null);
  const unsaved = useRef<Record<string, FormDataEntryValue>>({});
  function notify(s: string) {
    setToast(s);
    setTimeout(() => setToast(""), 4000);
  }
  function commit(update: (d: Store) => void, message: string) {
    const next = structuredClone(data);
    update(next);
    next.activities.unshift(message);
    try {
      repository.save(next);
      setData(next);
      notify(message);
      return true;
    } catch {
      setError(
        "Не удалось сохранить данные. Проверьте доступность локального хранилища.",
      );
      return false;
    }
  }
  function open(kind: string, l: Lesson | null = null) {
    previousFocus.current = document.activeElement as HTMLElement;
    unsaved.current = {};
    setSelected(l);
    setModal(kind);
    setError("");
    setDirty(false);
    setDiscard(false);
    setPop("");
  }
  function close() {
    if (dirty) {
      if (form.current)
        unsaved.current = Object.fromEntries(new FormData(form.current));
      setDiscard(true);
      return;
    }
    finish();
  }
  useEffect(() => {
    if (!discard && form.current) {
      for (const [name, value] of Object.entries(unsaved.current)) {
        const element = form.current.elements.namedItem(name);
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement
        )
          element.value = String(value);
      }
    }
  }, [discard]);
  function finish() {
    setModal("");
    setDirty(false);
    setDiscard(false);
    dialog.current?.close();
    const target = previousFocus.current;
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
      else document.querySelector<HTMLElement>("header input")?.focus();
    });
  }
  useEffect(() => {
    if (modal) {
      dialog.current?.showModal();
      dialog.current
        ?.querySelector<HTMLElement>("input,select,textarea,button")
        ?.focus();
    }
  }, [modal]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPop("");
        setQuery("");
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("header input")?.focus();
      }
    };
    window.addEventListener("keydown", fn);
    const nav = () => setPage(location.pathname);
    window.addEventListener("popstate", nav);
    return () => {
      window.removeEventListener("keydown", fn);
      window.removeEventListener("popstate", nav);
    };
  }, []);
  function navigate(path: string) {
    history.pushState({}, "", path);
    setPage(path);
    setMobile(false);
  }
  function action(text: string, l: Lesson | null = null) {
    if (text.includes("Отметить") || text.includes("Внести явку"))
      open("attendance", l || data.lessons[2]);
    else if (/Журнал|Открыть|Детали/.test(text)) open("details", l);
    else if (/Добавить занятие|Новое занятие/.test(text)) open("lesson");
    else if (text.includes("Принять оплату")) open("payment");
    else if (text.includes("Записать")) open("student");
    else if (text.includes("Создать группу")) open("group");
    else if (text.includes("Разрешить")) open("conflict");
    else if (text.includes("Напомнить")) open("draft");
    else if (text.includes("Назначить")) open("substitute");
    else if (text.includes("Помощь")) open("help");
    else if (text.includes("Создать")) setPop(pop === "create" ? "" : "create");
    else if (text.includes("Вчера")) setDay("2024-10-17");
    else if (text.includes("Завтра")) setDay("2024-10-19");
    else if (
      /Все \(|Идут сейчас|Предстоящие|Завершенные|Требуют отметки/.test(text)
    )
      setFilter(text.split(" (")[0]);
  }
  function textOf(e: Element): string {
    return e.children
      .map((c) =>
        c.type === "text" ? c.data : c instanceof Element ? textOf(c) : "",
      )
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const options = (lesson: Lesson | null = null): HTMLReactParserOptions => ({
    replace(node) {
      if (!(node instanceof Element)) return;
      if (
        node.name === "span" &&
        node.attribs.class?.includes("material-symbols-outlined")
      )
        return (
          <span className={node.attribs.class} aria-hidden="true">
            {textOf(node)}
          </span>
        );
      if (node.attribs["data-summary"]) {
        const [index, field] = node.attribs["data-summary"].split(":");
        const metric = dailySummary[Number(index)];
        const value = metric[field as keyof typeof metric];
        return node.name === "p" ? (
          <p className={node.attribs.class}>{value}</p>
        ) : (
          <span className={node.attribs.class}>{value}</span>
        );
      }
      if (node.attribs["data-component"] === "lessons") {
        const visible = data.lessons.filter(
          (l) =>
            l.date === day &&
            (filter === "Все" ||
              (filter === "Идут сейчас" && l.status === "live") ||
              (filter === "Предстоящие" && l.status === "planned") ||
              (filter === "Завершенные" && l.status === "completed") ||
              (filter === "Требуют отметки" &&
                !l.marked &&
                l.status === "completed")),
        );
        return (
          <div
            data-component="lesson-list"
            className="flex flex-col gap-space-sm"
          >
            {visible.length ? (
              visible.map((l) => (
                <LessonCard key={l.id} lesson={l} onOpen={open} />
              ))
            ) : (
              <div className="empty">Занятий по выбранным условиям нет</div>
            )}
          </div>
        );
      }
      if (
        node.name === "div" &&
        node.attribs.class === "flex flex-col gap-2 pt-2 border-t-0"
      )
        return (
          <div className={node.attribs.class}>
            {data.activities.length > 0 && (
              <div className="inline-feed">
                <b>Последние действия</b>
                {data.activities.slice(0, 4).map((s, i) => (
                  <p key={i}>{s}</p>
                ))}
              </div>
            )}
            {domToReact(node.children as never, options())}
          </div>
        );
      if (node.name === "main" && page !== "/" && page !== "/dashboard") {
        const a = Array.from(document.querySelectorAll("nav a")).find(
          (a) => a.getAttribute("href") === page,
        );
        return (
          <main className="placeholder">
            <h1>{a?.textContent || "Раздел"}</h1>
            <p>Макет раздела не предоставлен</p>
            <button className="primary" onClick={() => navigate("/")}>
              Вернуться на главную
            </button>
          </main>
        );
      }
      if (node.name === "a") {
        return (
          <a
            href={node.attribs.href}
            className={node.attribs.class}
            aria-current={page === node.attribs.href ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate(node.attribs.href);
            }}
          >
            {domToReact(node.children as never, options())}
          </a>
        );
      }
      if (node.name === "input")
        return (
          <div className="search-wrap">
            {icon("search")}
            <input
              aria-label="Поиск ученика, группы или преподавателя"
              className={node.attribs.class}
              placeholder={node.attribs.placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <div className="search-results">
                {[
                  ...data.students,
                  ...data.groups,
                  ...new Set(data.lessons.map((l) => l.teacher)),
                ]
                  .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
                  .slice(0, 8)
                  .map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setRecord(s);
                        open(
                          "details",
                          data.lessons.find(
                            (l) => l.title === s || l.teacher === s,
                          ) || null,
                        );
                        setQuery("");
                      }}
                    >
                      {s}
                    </button>
                  ))}
                {![
                  ...data.students,
                  ...data.groups,
                  ...data.lessons.map((l) => l.teacher),
                ].some((s) =>
                  s.toLowerCase().includes(query.toLowerCase()),
                ) && <p>Ничего не найдено</p>}
              </div>
            )}
          </div>
        );
      if (
        node.name === "span" &&
        node.attribs.class?.includes("font-body-sm") &&
        textOf(node).startsWith("Ауд. 204 в 17:15") &&
        data.incidents?.conflict
      ) {
        const c = data.incidents.conflict;
        return (
          <span className={node.attribs.class}>
            Авиамоделирование: ауд. {c.room}, {c.start}–{c.end} • конфликт
            устранён
          </span>
        );
      }
      if (
        node.name === "span" &&
        textOf(node).startsWith("Биология 10 кл.") &&
        data.incidents?.substitute
      )
        return (
          <span className={node.attribs.class}>
            Биология 10 кл. • {data.incidents.substitute.teacher}
          </span>
        );
      if (
        node.name === "span" &&
        textOf(node) === "Не выставлена посещаемость" &&
        data.resolved.includes("attendance")
      )
        return (
          <span className={node.attribs.class}>Посещаемость сохранена</span>
        );
      if (node.name === "button") {
        const text = textOf(node);
        const notification = text.includes("notifications");
        const isFilter =
          /Все \(|Идут сейчас|Предстоящие|Завершенные|Требуют отметки/.test(
            text,
          );
        return (
          <button
            type="button"
            className={
              node.attribs.class +
              (isFilter
                ? " filter " + (text.includes(filter + " (") ? "chosen" : "")
                : "")
            }
            aria-label={
              notification
                ? "Уведомления"
                : text.replace(/\b[a-z_]+\b/g, "").trim()
            }
            onClick={() =>
              notification
                ? setPop(pop === "notifications" ? "" : "notifications")
                : action(text, lesson)
            }
          >
            {domToReact(node.children as never, options(lesson))}
          </button>
        );
      }
      if (node.name === "div" && node.attribs.class?.includes("cursor-pointer"))
        return (
          <button
            className="profile"
            onClick={() => setPop(pop === "profile" ? "" : "profile")}
          >
            {domToReact(node.children as never, options())}
          </button>
        );
      if (node.name === "div" && textOf(node) === "Сегодня, 18 окт")
        return (
          <button className="today" onClick={() => setDay("2024-10-18")}>
            {day === "2024-10-18"
              ? "Сегодня, 18 окт"
              : day === "2024-10-17"
                ? "17 октября"
                : "19 октября"}
          </button>
        );
    },
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const values = Object.fromEntries(
      new FormData(form.current!).entries(),
    ) as Record<string, string>;
    for (const key of Object.keys(values)) values[key] = values[key].trim();
    if (
      ["title", "teacher", "name", "room", "reason"].some(
        (key) => key in values && !values[key],
      )
    ) {
      setError("Заполните обязательные поля");
      return;
    }
    if (
      modal === "conflict" &&
      values.room === "204" &&
      values.start < "18:45" &&
      values.end > "17:15"
    ) {
      setError("Пересечение сохраняется: выберите другое время или кабинет");
      return;
    }
    if (values.start && values.end && values.start >= values.end) {
      setError("Окончание должно быть позже начала");
      return;
    }
    if (modal === "payment" && Number(values.amount) <= 0) {
      setError("Сумма должна быть положительной");
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 150));
    const ok = commit(
      (d) => {
        if (modal === "lesson") {
          d.lessons.push({
            ...structuredClone(initial.lessons[4]),
            ...values,
            id: crypto.randomUUID(),
            marked: false,
            status: "planned",
            attendance: [],
            count: 0,
          });
        } else if (modal === "attendance" && selected) {
          const l = d.lessons.find((x) => x.id === selected.id)!;
          l.attendance = l.attendance.map((s, i) => ({
            ...s,
            state: values["attendance" + i],
          }));
          l.marked = !l.attendance.some((s) => s.state === "Не отмечено");
          if (l.marked && !d.resolved.includes("attendance"))
            d.resolved.push("attendance");
        } else if (["move", "cancel"].includes(modal) && selected) {
          Object.assign(
            d.lessons.find((x) => x.id === selected.id)!,
            values,
            modal === "cancel" ? { status: "cancelled" } : {},
          );
        } else if (modal === "payment") d.payments.push(values);
        else if (modal === "student") {
          d.students.push(values.name);
          d.enrollments ??= [];
          d.enrollments.push(values);
          for (const lesson of d.lessons.filter(
            (l) => l.title === values.group,
          )) {
            lesson.attendance.push({ name: values.name, state: "Не отмечено" });
            lesson.count++;
            lesson.marked = false;
          }
        } else if (modal === "group") {
          d.groups.push(values.name);
          d.groupDetails ??= [];
          d.groupDetails.push(values);
        } else if (modal === "draft") d.drafts.push(values);
        else if (modal === "conflict" || modal === "substitute") {
          d.incidents ??= {};
          d.incidents[modal] = values;
          d.resolved.push(modal);
        }
      },
      modal === "draft"
        ? "Локальный черновик сохранён. Отправка не выполнялась."
        : `${titles[modal]} — сохранено`,
    );
    setSaving(false);
    if (ok) finish();
  }
  const field = (
    name: string,
    label: string,
    type = "text",
    value = "",
    required = true,
  ) => (
    <label key={name}>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        min={type === "number" ? "0.01" : undefined}
        step={type === "number" ? "0.01" : undefined}
      />
    </label>
  );
  return (
    <div className={mobile ? "app mobile-open" : "app"}>
      <button
        className="mobile-toggle"
        aria-label="Открыть навигацию"
        onClick={() => setMobile(!mobile)}
      >
        {icon("menu")}
      </button>
      {mobile && (
        <button
          aria-label="Закрыть навигацию"
          className="nav-backdrop"
          onClick={() => setMobile(false)}
        />
      )}
      {parse(template, options())}

      {pop && (
        <>
          <button
            className="popover-backdrop"
            aria-label="Закрыть меню"
            onClick={() => setPop("")}
          />
          <div className={"popover " + pop}>
            {pop === "create" ? (
              ["lesson", "student", "group", "payment"].map((k) => (
                <button key={k} onClick={() => open(k)}>
                  {titles[k]}
                </button>
              ))
            ) : pop === "notifications" ? (
              <>
                <b>Уведомления</b>
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() =>
                      open(
                        n.action,
                        data.lessons.find((l) => l.id === n.lessonId) || null,
                      )
                    }
                  >
                    {n.title}
                  </button>
                ))}
              </>
            ) : (
              <>
                <b>Ольга Смирнова</b>
                <p>Старший администратор</p>
                <button onClick={() => open("profile")}>Данные профиля</button>
              </>
            )}
          </div>
        </>
      )}
      {modal && (
        <dialog
          ref={dialog}
          aria-labelledby="dialog-title"
          className={["details", "attendance"].includes(modal) ? "drawer" : ""}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <div className="dialog-heading">
            <h2 id="dialog-title">{titles[modal]}</h2>
            <button aria-label="Закрыть" onClick={close}>
              {icon("close")}
            </button>
          </div>
          {discard ? (
            <div>
              <p>Закрыть без сохранения изменений?</p>
              <div className="form-actions">
                <button onClick={() => setDiscard(false)}>
                  Продолжить редактирование
                </button>
                <button className="danger" onClick={finish}>
                  Не сохранять
                </button>
              </div>
            </div>
          ) : (
            <form ref={form} onSubmit={save} onChange={() => setDirty(true)}>
              {modal === "details" ? (
                <>
                  <h3>{selected?.title || record || "Результат поиска"}</h3>
                  {selected ? (
                    <>
                      <p>
                        {selected.date} • {selected.start}–{selected.end}
                      </p>
                      <p>
                        {selected.teacher} • {selected.room}
                      </p>
                      <p>
                        {selected.status === "cancelled"
                          ? "Отменено: " + selected.reason
                          : selected.marked
                            ? "Явка отмечена"
                            : "Явка не отмечена"}
                      </p>
                      <div className="detail-actions">
                        <button
                          type="button"
                          onClick={() => open("attendance", selected)}
                        >
                          Отметить посещаемость
                        </button>
                        <button
                          type="button"
                          onClick={() => open("move", selected)}
                        >
                          Перенести
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => open("cancel", selected)}
                        >
                          Отменить занятие
                        </button>
                      </div>
                    </>
                  ) : (
                    <p>
                      Демонстрационная запись найдена. Подробный макет раздела
                      не предоставлен.
                    </p>
                  )}
                </>
              ) : null}
              {modal === "attendance" && (
                <>
                  <h3>{selected?.title}</h3>
                  {selected?.attendance.length ? (
                    selected.attendance.map((s, i) => (
                      <label className="attendance-row" key={s.name}>
                        {s.name}
                        <select name={"attendance" + i} defaultValue={s.state}>
                          {["Присутствует", "Отсутствует", "Не отмечено"].map(
                            (v) => (
                              <option key={v}>{v}</option>
                            ),
                          )}
                        </select>
                      </label>
                    ))
                  ) : (
                    <p>В занятие пока не записаны ученики.</p>
                  )}
                </>
              )}
              {modal === "lesson" && (
                <>
                  {field("title", "Название или группа / ученик")}
                  {field("teacher", "Преподаватель")}
                  {field("date", "Дата", "date", day)}
                  <div className="form-grid">
                    {field("start", "Начало", "time")}
                    {field("end", "Окончание", "time")}
                  </div>
                  {field("room", "Кабинет")}
                </>
              )}
              {modal === "move" && (
                <>
                  {field("date", "Дата", "date", selected?.date)}
                  {field("start", "Начало", "time", selected?.start)}
                  {field("end", "Окончание", "time", selected?.end)}
                  {field("room", "Кабинет", "text", selected?.room)}
                </>
              )}
              {modal === "cancel" && field("reason", "Причина отмены")}
              {modal === "payment" && (
                <>
                  <label>
                    Ученик
                    <select required name="student">
                      {data.students.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  {field("amount", "Сумма, ₽", "number")}
                  {field("date", "Дата", "date", day)}
                  <label>
                    Способ оплаты
                    <select name="method">
                      <option>Банковская карта</option>
                      <option>Наличные</option>
                      <option>Перевод</option>
                    </select>
                  </label>
                  {field("comment", "Комментарий", "text", "", false)}
                </>
              )}
              {["student", "group"].includes(modal) && (
                <>
                  {field(
                    "name",
                    modal === "student" ? "Фамилия и имя" : "Название группы",
                  )}
                  {modal === "student" ? (
                    <label>
                      Группа
                      <select name="group">
                        {data.groups.map((g) => (
                          <option key={g}>{g}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    field("teacher", "Преподаватель")
                  )}
                </>
              )}
              {modal === "conflict" && (
                <>
                  <p>Ауд. 204, 18 октября, 17:15–18:45</p>
                  <p>
                    Робототехника • Дмитрий Соколов
                    <br />
                    Авиамоделирование • Михаил Кузнецов
                  </p>
                  <p>Изменить занятие «Авиамоделирование»:</p>
                  {field(
                    "start",
                    "Начало",
                    "time",
                    data.incidents?.conflict?.start || "17:15",
                  )}
                  {field(
                    "end",
                    "Окончание",
                    "time",
                    data.incidents?.conflict?.end || "18:45",
                  )}
                  {field(
                    "room",
                    "Кабинет",
                    "text",
                    data.incidents?.conflict?.room || "204",
                  )}
                  {data.resolved.includes("conflict") && (
                    <p>Локальное изменение уже сохранено.</p>
                  )}
                </>
              )}
              {modal === "draft" && (
                <>
                  <p>Ковалев Максим • 2 занятия в долг</p>
                  <p>
                    Сохранится только локальный черновик, без отправки и
                    создания счёта.
                  </p>
                  <label>
                    Тип
                    <select name="kind">
                      <option>Напоминание</option>
                      <option>Черновик счёта</option>
                    </select>
                  </label>
                  <label>
                    Текст
                    <textarea
                      required
                      name="text"
                      defaultValue="Просим уточнить оплату занятий."
                    />
                  </label>
                </>
              )}
              {modal === "substitute" && (
                <>
                  <p>Биология 10 кл. • Кузнецов М. заболел</p>
                  <label>
                    Новый преподаватель
                    <select
                      name="teacher"
                      defaultValue={data.incidents?.substitute?.teacher}
                    >
                      {data.lessons
                        .filter((l) => l.teacher !== "Михаил Кузнецов")
                        .map((l) => (
                          <option key={l.id}>{l.teacher}</option>
                        ))}
                    </select>
                  </label>
                  <p>Замена сохраняется локально для указанного занятия.</p>
                </>
              )}
              {modal === "help" && (
                <p>
                  Демонстрация «ЁРШ CRM». Данные сохраняются в этом браузере.
                  Инструкция по сбросу находится в README.md.
                </p>
              )}
              {modal === "profile" && (
                <>
                  <p>Ольга Смирнова</p>
                  <p>Старший администратор • Школа «Вектор»</p>
                </>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              {!["details", "help", "profile"].includes(modal) && (
                <div className="form-actions">
                  <button type="button" onClick={close}>
                    Отмена
                  </button>
                  <button className="primary" disabled={saving}>
                    {saving ? "Сохранение…" : "Сохранить"}
                  </button>
                </div>
              )}
            </form>
          )}
        </dialog>
      )}
      <Toast message={toast} />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
