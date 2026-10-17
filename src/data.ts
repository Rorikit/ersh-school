import seed from "./seed.json";
export type AttendanceState = "Присутствует" | "Отсутствует" | "Не отмечено";
export interface Lesson {
  id: string;
  title: string;
  teacher: string;
  room: string;
  start: string;
  end: string;
  date: string;
  status: string;
  type: string;
  marked: boolean;
  count: number;
  attendance: { name: string; state: string }[];
  reason?: string;
}
export interface Store {
  lessons: Lesson[];
  activities: string[];
  payments: Record<string, string>[];
  students: string[];
  groups: string[];
  drafts: Record<string, string>[];
  resolved: string[];
  enrollments?: Record<string, string>[];
  groupDetails?: Record<string, string>[];
  incidents?: Record<string, Record<string, string>>;
}
export const KEY = "ersh-demo-v1";
export const initial: Store = {
  lessons: seed,
  activities: [],
  payments: [],
  students: ["Ковалев Максим", "Иванова Татьяна", "Смирнов Арсений"],
  groups: seed.map((l) => l.title),
  drafts: [],
  resolved: [],
};
export const repository = {
  load(): Store {
    try {
      const value = localStorage.getItem(KEY);
      return value ? JSON.parse(value) : structuredClone(initial);
    } catch {
      return structuredClone(initial);
    }
  },
  save(data: Store) {
    localStorage.setItem(KEY, JSON.stringify(data));
  },
};

export interface Notification {
  id: string;
  title: string;
  action: string;
  lessonId?: string;
}
export const notifications: Notification[] = [
  {
    id: "attendance",
    title: "Не выставлена посещаемость",
    action: "attendance",
    lessonId: "3",
  },
  { id: "conflict", title: "Пересечение кабинета 204", action: "conflict" },
  {
    id: "substitute",
    title: "Требуется замена преподавателя",
    action: "substitute",
  },
];
export interface MetricSummary {
  label: string;
  value: number;
  note: string;
}
/** Независимая сводка полного дня; не вычисляется по видимым карточкам. */
export const dailySummary: MetricSummary[] = [
  { label: "Занятий сегодня", value: 28, note: "12 групп, 4 аудитории" },
  { label: "Проведено", value: 14, note: "112 учеников присутствовало" },
  { label: "Ожидают проведения", value: 11, note: "Ближайшее через 25 мин" },
  { label: "Отменено / Перенос", value: 3, note: "1 по болезни, 2 перенос" },
];
