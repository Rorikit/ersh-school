import { Store } from "./store.ts";
import { createApp } from "./http.ts";
const demo = process.argv.includes("--demo");
const path =
  process.env.DB_PATH || (demo ? "data/demo.sqlite" : "data/work.sqlite");
const store = new Store(path, demo);
const server = createApp(store, {
  origin:
    process.env.APP_ORIGIN || (demo ? "http://localhost:5173" : undefined),
  secure: process.env.COOKIE_SECURE === "1",
});
const port = Number(process.env.PORT || 3001);
server.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(
    `ЁРШ API http://localhost:${port} · ${demo ? "ДЕМО, тестовые данные" : "РАБОЧИЙ РЕЖИМ"}`,
  ),
);
for (const event of ["SIGINT", "SIGTERM"])
  process.on(event, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
