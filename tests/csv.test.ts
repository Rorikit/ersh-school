import test from "node:test";
import assert from "node:assert/strict";
import { importStudents, csvExport } from "../server/csv.ts";
import { Store } from "../server/store.ts";
import type { User } from "../shared/model.ts";
test("CSV: кавычки, формулы, предварительная проверка и атомарный отказ дубля", () => {
  const parsed = importStudents(
    'name;birthDate;contact\n"Тест; Имя";2012-01-01;"test@example.invalid"',
    "s",
    "b",
    "batch",
  );
  assert.equal(parsed[0].name, "Тест; Имя");
  assert.match(csvExport([["=1+1", "+1", "@cmd", "-3"]]), /"'=1\+1"/);
  assert.throws(
    () => importStudents("name;birthDate;contact\nName;bad;", "s", "b", "p"),
    /Строка 2/,
  );
  const db = new Store(":memory:", true);
  const user: User = {
    id: "u",
    name: "Директор",
    schoolId: "school-demo",
    branchIds: ["branch-school-demo"],
    teacherId: "",
    role: "director",
  };
  try {
    const state = db.read(user.schoolId);
    const command = {
      type: "import-students",
      branchId: user.branchIds[0],
      csv: "name;birthDate;contact\nИмпорт Тест;2012-01-01;\nИмпорт Тест;2012-01-01;",
    };
    assert.throws(
      () => db.command(user, command, "import-key", state.revision),
      /уже существует/,
    );
    assert.deepEqual(db.read(user.schoolId), state);
  } finally {
    db.close();
  }
});
