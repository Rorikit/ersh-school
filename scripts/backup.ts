import { backup, DatabaseSync } from "node:sqlite";
import { resolve, dirname } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { StateSchema } from "../shared/model.ts";
const source = process.env.DB_PATH;
const target = process.argv[2];
if (!source || !target)
  throw Error(
    "Использование: DB_PATH=<база> npm run db:backup -- <новый файл копии>",
  );
if (!existsSync(source)) throw Error("Исходная база не существует");
if (existsSync(target))
  throw Error("Файл назначения уже существует — перезапись запрещена");
if (resolve(source) === resolve(target)) throw Error("Пути совпадают");
mkdirSync(dirname(resolve(target)), { recursive: true });
const db = new DatabaseSync(source, { readOnly: true });
await backup(db, target);
db.close();
const verify = new DatabaseSync(target, { readOnly: true });
const integrity = verify.prepare("PRAGMA integrity_check").get();
if (integrity?.integrity_check !== "ok")
  throw Error("Проверка резервной копии не пройдена");
for (const row of verify.prepare("SELECT payload FROM schools").all())
  StateSchema.parse(JSON.parse(String(row.payload)));
verify.close();
console.log("Резервная копия создана и проверена: " + resolve(target));
