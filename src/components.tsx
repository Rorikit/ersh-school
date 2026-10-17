import type { Lesson } from "./data";
export function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {name}
    </span>
  );
}
export function LessonCard({
  lesson: l,
  onOpen,
}: {
  lesson: Lesson;
  onOpen: (kind: string, lesson: Lesson) => void;
}) {
  const waiting = l.status === "completed" && !l.marked,
    live = l.status === "live",
    cancelled = l.status === "cancelled";
  const present = l.attendance.filter((s) => s.state === "Присутствует").length;
  const badge = cancelled
    ? "Отменено: " + l.reason
    : l.marked
      ? (l.status === "completed" ? "Завершено" : live ? `Идёт сейчас (до ${l.end})` : "Запланировано") + " • Явка отмечена"
      : waiting
        ? "Ожидает отметки явки"
        : live
          ? `Идёт сейчас (до ${l.end})`
          : l.type === "individual"
            ? "Индив. занятие"
            : "Запланировано";
  const count = l.marked
    ? `${present}/${l.attendance.length} уч.`
    : waiting
      ? `${l.count} уч. в группе`
      : `${l.count} уч.`;
  const badgeStyle =
    cancelled || waiting
      ? "bg-error-container text-error"
      : l.marked
        ? "bg-tertiary-container/15 text-tertiary"
        : live
          ? "bg-surface-container text-primary"
          : l.type === "individual"
            ? "bg-secondary-container text-on-secondary-fixed"
            : "bg-surface-container-low text-on-surface-variant";
  const action = waiting
    ? "Отметить явку"
    : l.marked
      ? "Журнал"
      : live
        ? "Открыть"
        : "Детали";
  return (
    <article
      className={
        "lesson-card p-4 rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-space-md relative overflow-hidden " +
        (waiting ? "waiting" : "")
      }
    >
      {(waiting || live) && (
        <div
          className={
            "absolute left-0 top-0 bottom-0 w-1.5 " +
            (waiting ? "bg-error" : "bg-primary-container")
          }
        />
      )}
      <div
        className={
          "flex items-start gap-space-md " + (waiting || live ? "pl-1" : "")
        }
      >
        <div
          className={
            "lesson-time flex flex-col items-center justify-center min-w-[90px] py-1 px-2 rounded-lg " +
            (waiting
              ? "bg-error-container/20 text-error"
              : live
                ? "bg-primary-fixed text-primary"
                : "bg-surface-container-low")
          }
        >
          <span className="font-mono-num text-label-md font-bold">
            {l.start}
          </span>
          <span className="font-mono-num text-[11px]">{l.end}</span>
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-title-sm text-title-sm text-on-surface font-semibold truncate">
              {l.title}
            </h4>
            <span
              className={
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-sm text-label-sm " +
                badgeStyle
              }
            >
              {(waiting || live || l.marked) && (
                <span
                  className={
                    "w-1.5 h-1.5 rounded-full " +
                    (waiting ? "bg-error" : live ? "bg-primary" : "bg-tertiary")
                  }
                />
              )}{" "}
              {badge}
            </span>
          </div>
          <div className="flex items-center gap-3 text-on-surface-variant font-body-sm text-body-sm flex-wrap">
            <span className="flex items-center gap-1">
              <Icon name="person" />
              {l.teacher}
            </span>
            <span className="w-1 h-1 rounded-full bg-outline-variant" />
            <span className="flex items-center gap-1">
              <Icon
                name={
                  l.room.includes("Комп.") ? "desktop_windows" : "meeting_room"
                }
              />
              {l.room}
            </span>
            <span className="w-1 h-1 rounded-full bg-outline-variant" />
            <span
              className={
                "font-mono-num " +
                (l.marked && present === l.count
                  ? "text-tertiary font-semibold"
                  : "text-on-surface font-medium")
              }
            >
              {count}
              {l.marked && present < l.count && (
                <span className="text-error">
                  {" "}
                  ({l.count - present} отсутств.)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end md:self-center">
        <button
          type="button"
          className={
            "h-8 px-3 rounded-lg font-label-md text-label-md transition-colors flex items-center gap-1 " +
            (waiting
              ? "bg-primary-container text-on-primary font-semibold shadow-sm"
              : "bg-surface-container-low " +
                (live ? "text-primary" : "text-on-surface-variant"))
          }
          onClick={() => onOpen(waiting ? "attendance" : "details", l)}
        >
          {l.marked && <Icon name="menu_book" />}
          {waiting && <Icon name="how_to_reg" />}
          <span>{action}</span>
          {(live || (!waiting && !l.marked)) && (
            <Icon name={live ? "arrow_forward" : "more_vert"} />
          )}
        </button>
      </div>
    </article>
  );
}
export function Toast({ message }: { message: string }) {
  return message ? (
    <div role="status" className="toast">
      {message}
    </div>
  ) : null;
}
