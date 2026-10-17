import React, { useState, useEffect, useRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./style.css";
import { api, ApiError, request } from "./api";
import {
  today,
  addDays,
  notifications,
  metrics,
  roleNames,
  type State,
  type Session,
  type Command,
} from "../shared/model";
import { allowed } from "../shared/permissions";
import {
  Button,
  Icon,
  Modal,
  Drawer,
  Empty,
  type FormSpec,
} from "./components";
import { createActions } from "./actions";
import {
  Dashboard,
  Schedule,
  Registry,
  LessonRegistry,
  Finance,
  Analytics,
  Settings,
  Profile,
  LessonDetails,
  type Workspace,
} from "./screens";
const routes = [
  ["/dashboard", "Главная", "home"],
  ["/schedule", "Расписание", "calendar"],
  ["/lessons", "Занятия", "book"],
  ["/students", "Ученики", "people"],
  ["/groups", "Группы", "people"],
  ["/teachers", "Преподаватели", "user"],
  ["/finance", "Финансы", "money"],
  ["/analytics", "Статистика", "chart"],
  ["/settings", "Настройки", "settings"],
];
function App() {
  const [session, setSession] = useState<Session | null>(null),
    [data, setData] = useState<State | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [demo, setDemo] = useState(false),
    [path, setPath] = useState(location.pathname),
    [date, setDate] = useState(today()),
    [spec, setSpec] = useState<FormSpec | null>(null),
    [toast, setToast] = useState(""),
    [query, setQuery] = useState(""),
    [menu, setMenu] = useState(""),
    [mobile, setMobile] = useState(false),
    [branch, setBranch] = useState("");
  const latest = useRef<State | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  latest.current = data;
  function notify(message: string) {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 6000);
  }
  async function refresh() {
    try {
      const s = await api.state();
      setData(s);
      latest.current = s;
      setError("");
      return s;
    } catch (e) {
      const err = e as ApiError;
      setError(err.message + (err.requestId ? " · " + err.requestId : ""));
      if (err.status === 401) {
        setSession(null);
        setData(null);
      }
      throw e;
    }
  }
  async function boot() {
    setLoading(true);
    setError("");
    try {
      const health = await request<{ demo: boolean }>("/health");
      setDemo(health.demo);
      const session = await api.session();
      setSession(session);
      const s = await refresh();
      setDate(today(s.school.timezone));
    } catch (e) {
      if ((e as ApiError).status !== 401) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void boot();
    const nav = () => {
      setPath(location.pathname);
      setQuery("");
      setMenu("");
      setMobile(false);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("main h1")?.focus(),
      );
    };
    window.addEventListener("popstate", nav);
    return () => window.removeEventListener("popstate", nav);
  }, []);
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      if (!spec) void refresh().catch(() => {});
    }, 30000);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setQuery("");
        setMenu("");
        setMobile(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      clearInterval(interval);
      window.removeEventListener("keydown", key);
    };
  }, [session, spec]);
  function navigate(url: string) {
    history.pushState({}, "", url);
    setPath(location.pathname);
    setQuery("");
    setMobile(false);
    setMenu("");
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("main h1")?.focus(),
    );
  }
  async function run(command: Command, key?: string) {
    try {
      if (!session || !latest.current)
        throw new ApiError(401, "Войдите повторно");
      await api.command(
        command,
        latest.current.revision,
        key || crypto.randomUUID(),
        session.csrf,
      );
      await refresh();
      notify(
        command.type === "deliver"
          ? "Тестовый адаптер принял запрос. Реальная отправка не выполнялась."
          : "Сохранено на сервере",
      );
    } catch (e) {
      if ((e as ApiError).status === 409) await refresh().catch(() => {});
      if (key) throw e;
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    if (!menu) return;
    const previous = document.activeElement as HTMLElement;
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(".popover button")?.focus(),
    );
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [menu]);
  useEffect(() => {
    if (!mobile) return;
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(".sidebar nav a")?.focus(),
    );
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".sidebar a,.sidebar button,.sidebar select",
        ),
      );
      const index = nodes.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && index === 0) {
        e.preventDefault();
        nodes.at(-1)?.focus();
      } else if (!e.shiftKey && index === nodes.length - 1) {
        e.preventDefault();
        nodes[0]?.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => {
      window.removeEventListener("keydown", trap);
      document.querySelector<HTMLElement>(".mobile-menu")?.focus();
    };
  }, [mobile]);
  if (loading)
    return (
      <div className="loading" role="status">
        Загрузка «ЁРШ»…
      </div>
    );
  if (!session)
    return (
      <Login
        demo={demo}
        error={error}
        onLogin={async (email, password) => {
          const session = await api.login(email, password);
          setSession(session);
          const s = await refresh();
          setDate(today(s.school.timezone));
        }}
        retry={() => void boot()}
      />
    );
  if (!data)
    return (
      <div className="loading">
        <p role="alert">{error || "Данные пока не загружены"}</p>
        <Button onClick={() => void refresh().catch(() => {})}>
          Повторить загрузку
        </Button>
        <Button
          onClick={() => {
            void api.logout(session.csrf);
            setSession(null);
          }}
        >
          Выйти
        </Button>
      </div>
    );
  const s: State = branch
    ? {
        ...data,
        lessons: data.lessons.filter((x) => x.branchId === branch),
        rooms: data.rooms.filter((x) => x.branchId === branch),
        groups: data.groups.filter((x) => x.branchId === branch),
        teachers: data.teachers.filter((x) => x.branchId === branch),
        students: data.students.filter((x) => x.branchId === branch),
        enrollments: data.enrollments.filter((x) => x.branchId === branch),
        attendance: data.attendance.filter((x) => x.branchId === branch),
        tariffs: data.tariffs.filter((x) => x.branchId === branch),
        subscriptions: data.subscriptions.filter((x) => x.branchId === branch),
        payments: data.payments.filter((x) => x.branchId === branch),
        charges: data.charges.filter((x) => x.branchId === branch),
        debits: data.debits.filter((x) => x.branchId === branch),
      }
    : data;
  const a = createActions(s, run, setSpec, session.csrf);
  const ctx: Workspace = {
    s,
    user: session.user,
    a,
    run,
    lesson: (id) => navigate("/lessons/" + encodeURIComponent(id)),
    profile: (entity, id) =>
      navigate("/" + entity + "/" + encodeURIComponent(id)),
  };
  const parts = path.split("/").filter(Boolean),
    root = parts[0] || "dashboard";
  const active = routes.find(([href]) => href === "/" + root);
  const alerts = notifications(s);
  const results = [
    ...s.students.map((x) => ({
      entity: "students" as const,
      id: x.id,
      name: x.name,
      type: "Ученик",
    })),
    ...s.groups.map((x) => ({
      entity: "groups" as const,
      id: x.id,
      name: x.name,
      type: "Группа",
    })),
    ...s.teachers.map((x) => ({
      entity: "teachers" as const,
      id: x.id,
      name: x.name,
      type: "Преподаватель",
    })),
  ].filter((x) => x.name.toLowerCase().includes(query.toLowerCase()));
  const financeAllowed = session.user.role !== "teacher";
  const detail =
    parts.length === 2 &&
    ["students", "teachers", "groups", "lessons"].includes(root)
      ? { entity: root, id: decodeURIComponent(parts[1]) }
      : null;
  return (
    <div className="crm">
      <button
        className="mobile-menu icon-button"
        aria-label={mobile ? "Закрыть навигацию" : "Открыть навигацию"}
        aria-expanded={mobile}
        aria-controls="sidebar"
        onClick={() => setMobile(!mobile)}
      >
        <Icon name="menu" />
      </button>
      {mobile && (
        <button
          className="scrim"
          tabIndex={-1}
          aria-label="Закрыть меню навигации"
          onClick={() => setMobile(false)}
        />
      )}
      <aside id="sidebar" className={"sidebar " + (mobile ? "open" : "")}>
        <div>
          <div className="brand">
            <span className="brand-mark">Ё</span>
            <div>
              <b>
                ЁРШ <span className="badge">CRM</span>
              </b>
              <p>{s.school.name}</p>
            </div>
          </div>
          <label className="campus">
            <span className="dot green" />
            <span className="sr-only">Филиал</span>
            <select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Все доступные филиалы</option>
              {s.branches.map((b) => (
                <option value={b.id} key={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <nav aria-label="Основная навигация">
            {routes
              .filter(
                ([href]) =>
                  financeAllowed ||
                  !["/finance", "/analytics", "/settings"].includes(href),
              )
              .map(([href, title, icon]) => (
                <a
                  key={href}
                  href={href}
                  aria-current={active?.[0] === href ? "page" : undefined}
                  className={active?.[0] === href ? "active" : ""}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(href);
                  }}
                >
                  <Icon name={icon} />
                  {title}
                </a>
              ))}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <p>
            <Icon name="book" />
            {s.school.academicYear} уч. год
          </p>
          <Button onClick={() => setMenu(menu === "help" ? "" : "help")}>
            Помощь и связь
            <Icon name="chevron" />
          </Button>
        </div>
      </aside>
      <header className="topbar" inert={mobile || undefined}>
        <div className="global-search">
          <Icon name="search" />
          <input
            id="global-search"
            role="combobox"
            aria-autocomplete="list"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                document
                  .querySelector<HTMLElement>("#search-results button")
                  ?.focus();
              }
            }}
            aria-label="Поиск ученика, группы или преподавателя"
            aria-expanded={!!query}
            aria-controls="search-results"
            autoComplete="off"
            placeholder="Поиск ученика, группы или преподавателя…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>⌘K</kbd>
          {query && (
            <div
              id="search-results"
              className="search-results"
              role="listbox"
              aria-label="Результаты поиска"
              onKeyDown={(e) => {
                const nodes = Array.from(
                  document.querySelectorAll<HTMLElement>(
                    "#search-results button",
                  ),
                );
                const i = nodes.indexOf(document.activeElement as HTMLElement);
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  nodes[
                    (i + (e.key === "ArrowDown" ? 1 : -1) + nodes.length) %
                      nodes.length
                  ]?.focus();
                }
                if (e.key === "Escape") {
                  setQuery("");
                  document.getElementById("global-search")?.focus();
                }
              }}
            >
              {results.slice(0, 8).map((x) => (
                <button
                  role="option"
                  aria-selected={false}
                  key={x.entity + x.id}
                  onClick={() => ctx.profile(x.entity, x.id)}
                >
                  <small>{x.type}</small>
                  {x.name}
                </button>
              ))}
              {!results.length && <Empty>Ничего не найдено</Empty>}
              {results.length > 8 && (
                <button
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    navigate("/search");
                    setQuery(query);
                  }}
                >
                  Все результаты ({results.length})
                </button>
              )}
            </div>
          )}
        </div>
        {allowed(session.user, "lesson") && (
          <Button
            primary
            aria-label="Создать"
            aria-expanded={menu === "create"}
            aria-controls="create-menu"
            onClick={() => setMenu(menu === "create" ? "" : "create")}
          >
            <Icon name="plus" />
            <span>Создать</span>
          </Button>
        )}
        <div className="top-date">
          <Icon name="calendar" />
          <span>
            Сегодня,
            <br />
            {new Date(today(s.school.timezone) + "T12:00Z").toLocaleDateString(
              "ru-RU",
              { day: "numeric", month: "short" },
            )}
          </span>
          <span>
            {metrics(s, today(s.school.timezone)).total}
            <br />
            занятий
          </span>
        </div>
        <Button
          aria-label={"Уведомления: " + alerts.length}
          aria-expanded={menu === "notifications"}
          aria-controls="notifications-menu"
          onClick={() =>
            setMenu(menu === "notifications" ? "" : "notifications")
          }
        >
          <Icon name="bell" />
          {alerts.length > 0 && (
            <span className="counter">{alerts.length}</span>
          )}
        </Button>
        <button
          className="profile-button"
          aria-expanded={menu === "profile"}
          aria-controls="profile-menu"
          onClick={() => setMenu(menu === "profile" ? "" : "profile")}
        >
          <span className="avatar">Ё</span>
          <span>
            {session.user.name}
            <small>{roleNames[session.user.role]}</small>
          </span>
        </button>
      </header>
      <main className="workspace" inert={mobile || undefined}>
        {s.demo && (
          <div className="demo-banner">
            ДЕМОРЕЖИМ · Отдельная тестовая база на сервере. Реальные платежи и
            сообщения не отправляются.
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}{" "}
            <Button onClick={() => void refresh().catch(() => {})}>
              Повторить / обновить
            </Button>
          </div>
        )}
        {parts.length > 2 || (parts.length === 2 && !detail) || (!active && root !== "search") ? (
          <section className="panel">
            <h1 tabIndex={-1}>404 — Страница не найдена</h1>
            <p>Проверьте адрес страницы.</p>
            <Button onClick={() => navigate("/dashboard")}>На главную</Button>
          </section>
        ) : !financeAllowed &&
          ["finance", "analytics", "settings"].includes(root) ? (
          <section className="panel">
            <h1 tabIndex={-1}>Доступ ограничен</h1>
            <p>Раздел доступен другой роли. Полномочия проверяются сервером.</p>
          </section>
        ) : root === "dashboard" ? (
          <Dashboard {...ctx} date={date} setDate={setDate} />
        ) : root === "schedule" ? (
          <Schedule {...ctx} date={date} setDate={setDate} />
        ) : root === "lessons" ? (
          <LessonRegistry {...ctx} />
        ) : ["students", "groups", "teachers"].includes(root) ? (
          <Registry key={root} entity={root as "students"} ctx={ctx} />
        ) : root === "finance" ? (
          <Finance {...ctx} />
        ) : root === "analytics" ? (
          <Analytics {...ctx} />
        ) : root === "settings" ? (
          <Settings {...ctx} />
        ) : (
          <section className="panel">
            <h1 tabIndex={-1}>Результаты поиска</h1>
            {results.map((x) => (
              <p key={x.entity + x.id}>
                <button
                  className="text-link"
                  onClick={() => ctx.profile(x.entity, x.id)}
                >
                  {x.type}: {x.name}
                </button>
              </p>
            ))}
          </section>
        )}
      </main>
      {menu && (
        <>
          <button
            className="popover-scrim"
            aria-label="Закрыть всплывающее меню"
            onClick={() => setMenu("")}
          />
          <div className={"popover " + menu} id={menu + "-menu"}>
            {menu === "create" ? (
              <>
                {allowed(session.user, "lesson") && (
                  <button
                    onClick={() => {
                      setMenu("");
                      a.lesson();
                    }}
                  >
                    Добавить занятие
                  </button>
                )}
                {allowed(session.user, "save", "students") && (
                  <button
                    onClick={() => {
                      setMenu("");
                      a.edit("students");
                    }}
                  >
                    Добавить ученика
                  </button>
                )}
                {allowed(session.user, "save", "groups") && (
                  <button
                    onClick={() => {
                      setMenu("");
                      a.edit("groups");
                    }}
                  >
                    Создать группу
                  </button>
                )}
                {allowed(session.user, "payment") && (
                  <button
                    onClick={() => {
                      setMenu("");
                      a.payment();
                    }}
                  >
                    Принять оплату
                  </button>
                )}
              </>
            ) : menu === "profile" ? (
              <>
                <h3>{session.user.name}</h3>
                <p>{roleNames[session.user.role]}</p>
                <p>
                  Сессия до{" "}
                  {new Date(session.expiresAt).toLocaleTimeString("ru-RU", {
                    timeZone: s.school.timezone,
                  })}
                </p>
                <Button
                  onClick={() => {
                    void api
                      .logout(session.csrf)
                      .then(() => {
                        setSession(null);
                        setData(null);
                        setMenu("");
                        notify("Вы вышли из системы");
                      })
                      .catch((e) => setError(e.message));
                  }}
                >
                  Выйти
                </Button>
              </>
            ) : menu === "notifications" ? (
              <>
                <h3>Уведомления ({alerts.length})</h3>
                {alerts.length ? (
                  alerts.map((x) => (
                    <button
                      key={x.id}
                      onClick={() => {
                        setMenu("");
                        void run({
                          type: "read-notification",
                          notificationId: x.id,
                        });
                        if (x.lessonId) ctx.lesson(x.lessonId);
                        else if (x.studentId)
                          ctx.profile("students", x.studentId);
                      }}
                    >
                      {x.title}
                      {s.notificationReads.some(
                        (r) => r.notificationId === x.id,
                      ) && <small>Прочитано</small>}
                    </button>
                  ))
                ) : (
                  <Empty>Нет нерешённых уведомлений</Empty>
                )}
              </>
            ) : (
              <>
                <h3>Помощь</h3>
                <p>
                  Данные хранятся на сервере. Правила учёта, резервирования и
                  запуска описаны в README и docs/business-rules.md.
                </p>
                <p>
                  Поддержка: обратитесь к директору школы. Внешний канал
                  поддержки не подключён.
                </p>
              </>
            )}
          </div>
        </>
      )}
      {detail && !spec && (
        <Drawer
          key={detail.entity + detail.id}
          title={detail.entity === "lessons" ? "Занятие и журнал" : "Карточка"}
          onClose={() => navigate("/" + detail.entity)}
        >
          {detail.entity === "lessons" ? (
            s.lessons.find((l) => l.id === detail.id) ? (
              <LessonDetails
                l={s.lessons.find((l) => l.id === detail.id)!}
                ctx={ctx}
              />
            ) : (
              <Empty>Занятие не найдено или недоступно</Empty>
            )
          ) : (
            <Profile
              entity={detail.entity as "students"}
              id={detail.id}
              ctx={ctx}
            />
          )}
        </Drawer>
      )}
      {spec && <Modal spec={spec} onClose={() => setSpec(null)} />}
      {toast && (
        <div role="status" className="toast">
          {toast}
        </div>
      )}
    </div>
  );
}
function Login({
  demo,
  error,
  onLogin,
  retry,
}: {
  demo: boolean;
  error: string;
  onLogin: (email: string, password: string) => Promise<void>;
  retry: () => void;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  return (
    <main className="login-page">
      <section className="login-card panel">
        <div className="brand">
          <span className="brand-mark">Ё</span>
          <div>
            <b>ЁРШ CRM</b>
            <p>Вход в систему школы</p>
          </div>
        </div>
        {demo && (
          <div className="demo-banner">
            <b>Демонстрационная среда</b>
            <p>
              Только тестовые данные. Для входа: director@demo.local,
              admin@demo.local, teacher@demo.local или finance@demo.local.
              Пароль: Demo-School-2026!
            </p>
          </div>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setMessage("");
            try {
              await onLogin(email, password);
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {(message || error) && (
            <p role="alert" className="error">
              {message || error}
            </p>
          )}
          <button className="btn primary" disabled={saving}>
            {saving ? "Вход…" : "Войти"}
          </button>
        </form>
        {error && <Button onClick={retry}>Повторить подключение</Button>}
        <small>
          Пароль рабочего аккаунта выдаёт администратор сервера. Сброс сессии не
          удаляет данные школы.
        </small>
      </section>
    </main>
  );
}
class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { error: boolean; id: string }
> {
  state = { error: false, id: "" };
  static getDerivedStateFromError() {
    return { error: true, id: crypto.randomUUID() };
  }
  render() {
    return this.state.error ? (
      <main className="loading">
        <h1>Не удалось отобразить экран</h1>
        <p>Данные на сервере сохранены. Диагностический код: {this.state.id}</p>
        <Button onClick={() => location.reload()}>
          Перезагрузить интерфейс
        </Button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
