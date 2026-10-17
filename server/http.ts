import { csvExport } from "./csv.ts";
import { applyCommand } from "./domain.ts";
import { allowed } from "../shared/permissions.ts";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Store, scoped } from "./store.ts";
import { DomainError, demand } from "./domain.ts";
import { ID, entitySchemas, type Entity } from "../shared/model.ts";
export function createApp(
  store: Store,
  options: { origin?: string; now?: () => Date; secure?: boolean } = {},
) {
  const attempts = new Map<string, { count: number; until: number }>();
  const server = createServer(async (req, res) => {
    const requestId = randomUUID();
    res.setHeader("X-Request-ID", requestId);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; font-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    if (options.secure)
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    const url = new URL(req.url || "/", "http://localhost");
    const json = (status: number, value: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    try {
      if (url.pathname === "/api/health") {
        return json(200, { ok: true, schemaVersion: 1, demo: store.demo });
      }
      if (!url.pathname.startsWith("/api/")) {
        const root = resolve("dist"),
          file = resolve(root, "." + decodeURIComponent(url.pathname));
        demand(
          file === root || file.startsWith(root + sep),
          "Путь недоступен",
          404,
        );
        const target =
          existsSync(file) && statSync(file).isFile()
            ? file
            : resolve(root, "index.html");
        demand(existsSync(target), "Сначала выполните npm run build", 503);
        const mime: Record<string, string> = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript",
          ".css": "text/css",
          ".woff2": "font/woff2",
          ".png": "image/png",
          ".svg": "image/svg+xml",
        };
        res.writeHead(200, {
          "Content-Type": mime[extname(target)] || "application/octet-stream",
          "Cache-Control": target.endsWith("index.html")
            ? "no-cache"
            : "public, max-age=31536000, immutable",
        });
        return res.end(readFileSync(target));
      }
      if (req.method !== "GET") {
        const origin = req.headers.origin;
        const expected = options.origin || "http://" + req.headers.host;
        demand(
          !origin || origin === expected,
          "Источник запроса запрещён",
          403,
        );
        demand(
          !req.headers["sec-fetch-site"] ||
            req.headers["sec-fetch-site"] !== "cross-site",
          "Межсайтовый запрос запрещён",
          403,
        );
      }
      if (url.pathname === "/api/login" && req.method === "POST") {
        const remote = req.socket.remoteAddress || "unknown";
        const record = attempts.get(remote);
        demand(
          !record || record.until < Date.now() || record.count < 15,
          "Слишком много попыток входа. Повторите позже",
          429,
        );
        attempts.set(remote, {
          count: record && record.until > Date.now() ? record.count + 1 : 1,
          until: Date.now() + 60000,
        });
        const body = z
          .object({
            email: z.string().email().max(200),
            password: z.string().min(1).max(200),
          })
          .parse(await readBody(req));
        const { token, session } = store.login(body.email, body.password);
        res.setHeader(
          "Set-Cookie",
          `ersh_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${options.secure ? "; Secure" : ""}`,
        );
        return json(200, session);
      }
      const token =
        String(req.headers.cookie || "")
          .split(";")
          .map((s) => s.trim())
          .find((s) => s.startsWith("ersh_session="))
          ?.slice(13) || "";
      const session = store.session(token);
      if (session.user.role === "director")
        session.user.branchIds = store
          .read(session.user.schoolId)
          .branches.map((b) => b.id);
      if (req.method !== "GET")
        demand(
          req.headers["x-csrf-token"] === session.csrf,
          "Сессия запроса не подтверждена",
          403,
        );
      if (url.pathname === "/api/session" && req.method === "GET")
        return json(200, session);
      if (url.pathname === "/api/logout" && req.method === "POST") {
        store.logout(token);
        res.setHeader(
          "Set-Cookie",
          `ersh_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${options.secure ? "; Secure" : ""}`,
        );
        return json(200, { ok: true });
      }
      if (url.pathname === "/api/state" && req.method === "GET")
        return json(
          200,
          scoped(store.read(session.user.schoolId), session.user),
        );
      if (url.pathname === "/api/records" && req.method === "GET") {
        const entity = z
          .enum(Object.keys(entitySchemas) as [Entity, ...Entity[]])
          .parse(url.searchParams.get("entity"));
        const page = z.coerce
          .number()
          .int()
          .min(1)
          .parse(url.searchParams.get("page") || 1);
        const limit = z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .parse(url.searchParams.get("limit") || 25);
        const q = (url.searchParams.get("q") || "").toLowerCase().slice(0, 200);
        const s = scoped(store.read(session.user.schoolId), session.user);
        const rows = s[entity].filter((x) =>
          JSON.stringify(x).toLowerCase().includes(q),
        );
        return json(200, {
          items: rows.slice((page - 1) * limit, page * limit),
          total: rows.length,
          page,
          limit,
          revision: s.revision,
        });
      }
      if (url.pathname === "/api/import/preview" && req.method === "POST") {
        demand(
          allowed(session.user, "import-students"),
          "Импорт недоступен",
          403,
        );
        const body = z
          .object({ csv: z.string().max(100000), branchId: ID })
          .parse(await readBody(req));
        const state = store.read(session.user.schoolId);
        const copy = structuredClone(state);
        applyCommand(
          copy,
          { type: "import-students", ...body },
          session.user,
          "preview",
          options.now?.() || new Date(),
        );
        return json(200, {
          count: copy.students.length - state.students.length,
          preview: copy.students
            .slice(state.students.length)
            .slice(0, 5)
            .map((s) => ({
              name: s.name,
              birthDate: s.birthDate,
              contact: s.contact,
            })),
          valid: true,
        });
      }
      if (url.pathname.startsWith("/api/export/") && req.method === "GET") {
        demand(session.user.role !== "teacher", "Выгрузка недоступна", 403);
        const s = scoped(store.read(session.user.schoolId), session.user);
        const student = url.pathname === "/api/export/students.csv";
        demand(
          student || url.pathname === "/api/export/finance.csv",
          "Выгрузка не найдена",
          404,
        );
        const rows = student
          ? [
              ["name", "birthDate", "contact"],
              ...s.students.map((x) => [x.name, x.birthDate, x.contact]),
            ]
          : [
              [
                "id",
                "date",
                "studentId",
                "kind",
                "amountKopecks",
                "method",
                "reverses",
              ],
              ...s.payments.map((x) => [
                x.id,
                x.date,
                x.studentId,
                x.kind,
                x.amountKopecks,
                x.method,
                x.reverses,
              ]),
            ];
        res.writeHead(200, {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="' +
            (student ? "students" : "finance") +
            '.csv"',
          "Cache-Control": "no-store",
        });
        return res.end(csvExport(rows));
      }
      if (url.pathname === "/api/commands" && req.method === "POST") {
        const body = z
          .object({
            requestId: ID,
            revision: z.number().int().min(0),
            command: z.unknown(),
          })
          .parse(await readBody(req));
        const result = store.command(
          session.user,
          body.command,
          body.requestId,
          body.revision,
          options.now?.() || new Date(),
        );
        return json(200, result);
      }
      throw new DomainError(404, "API-маршрут не найден");
    } catch (e) {
      const status =
        e instanceof DomainError
          ? e.status
          : e instanceof z.ZodError
            ? 422
            : 500;
      const message =
        e instanceof DomainError
          ? e.message
          : e instanceof z.ZodError
            ? "Проверьте поля формы: " +
              e.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")
            : "Ошибка сервера. Данные не изменены";
      if (status >= 500)
        console.error(
          JSON.stringify({
            requestId,
            status,
            code:
              e instanceof DomainError
                ? "STORAGE_OR_PROVIDER_ERROR"
                : "INTERNAL_ERROR",
          }),
        );
      json(status, {
        error: message,
        field:
          e instanceof DomainError
            ? e.field
            : e instanceof z.ZodError
              ? String(e.issues[0]?.path.at(-1) || "")
              : "",
        requestId,
      });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}
async function readBody(req: IncomingMessage) {
  demand(
    req.headers["content-type"]?.startsWith("application/json"),
    "Ожидается application/json",
    415,
  );
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    demand(size <= 256000, "Запрос слишком большой", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DomainError(400, "Некорректный JSON");
  }
}
