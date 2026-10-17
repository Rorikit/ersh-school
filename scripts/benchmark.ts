import { Store } from "../server/store.ts";
import { addDays, metrics } from "../shared/model.ts";
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
const store = new Store(":memory:", true, new Date("2026-10-18T12:00Z"));
try {
  const s = store.read("school-demo");
  const first = s.students[0],
    lesson = s.lessons[0];
  for (let i = s.students.length; i < 10000; i++)
    s.students.push({
      ...first,
      id: "bench-student-" + i,
      name: "Синтетический ученик " + i,
      birthDate: "",
    });
  for (let i = s.lessons.length; i < 100000; i++)
    s.lessons.push({
      ...lesson,
      id: "bench-lesson-" + i,
      date: addDays("2020-01-01", i),
      start: "08:00",
      end: "09:00",
      status: "scheduled",
    });
  let start = performance.now();
  const text = JSON.stringify(s);
  const serializeMs = performance.now() - start;
  store.db
    .prepare("UPDATE schools SET payload=? WHERE id=?")
    .run(text, s.school.id);
  start = performance.now();
  const loaded = store.read(s.school.id);
  const readValidateMs = performance.now() - start;
  start = performance.now();
  const m = metrics(loaded, "2026-10-18");
  const metricsMs = performance.now() - start;
  const report = {
    environment: { node: process.version, platform: process.platform },
    students: s.students.length,
    lessons: s.lessons.length,
    bytes: Buffer.byteLength(text),
    serializeMs: Math.round(serializeMs),
    readValidateMs: Math.round(readValidateMs),
    metricsMs: Math.round(metricsMs),
    dailyTotal: m.total,
    scope:
      "Только синтетический серверный агрегат в памяти, без браузера, сети, SLA и реальной базы",
  };
  writeFileSync("docs/benchmark.json", JSON.stringify(report, null, 2));
  console.log(report);
} finally {
  store.close();
}
