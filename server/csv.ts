import { StudentSchema, type Student } from "../shared/model.ts";
import { DomainError } from "./domain.ts";
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function csvExport(rows: unknown[][]) {
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
}
export function importStudents(
  csv: string,
  schoolId: string,
  branchId: string,
  prefix: string,
): Student[] {
  if (csv.length > 100000) throw new DomainError(422, "CSV превышает 100 КБ");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const text = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === ";" || c === "\n" || c === undefined)) {
      row.push(cell);
      cell = "";
      if (c !== ";") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else if (c !== "\r" || quoted) cell += c ?? "";
  }
  if (quoted) throw new DomainError(422, "CSV: незакрытая кавычка");
  if (rows.length < 2 || rows.length > 101)
    throw new DomainError(422, "CSV: заголовок и от 1 до 100 строк");
  if (rows[0].join(";") !== "name;birthDate;contact")
    throw new DomainError(
      422,
      "Заголовок CSV должен быть name;birthDate;contact",
    );
  return rows.slice(1).map((r, i) => {
    if (r.length !== 3)
      throw new DomainError(422, "Строка " + (i + 2) + ": ожидаются 3 столбца");
    const result = StudentSchema.safeParse({
      id: prefix + "-" + i,
      schoolId,
      branchId,
      name: r[0],
      birthDate: r[1],
      contact: r[2],
      archived: false,
    });
    if (!result.success)
      throw new DomainError(
        422,
        "Строка " +
          (i + 2) +
          ": " +
          result.error.issues
            .map((e) => e.path.join(".") + " " + e.message)
            .join("; "),
      );
    return result.data;
  });
}
