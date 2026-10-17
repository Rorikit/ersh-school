import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store.ts";
import { createApp } from "../server/http.ts";
import { randomUUID } from "node:crypto";
const NOW = new Date("2026-10-18T12:00:00Z");
async function fixture() {
  const db = new Store(":memory:", true, NOW),
    server = createApp(db, { now: () => NOW });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number };
  const base = "http://127.0.0.1:" + address.port;
  const login = async (role: string) => {
    const res = await fetch(base + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: role + "@demo.local",
        password: "Demo-School-2026!",
      }),
    });
    assert.equal(res.status, 200);
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    const session = await res.json();
    return {
      headers: {
        "Content-Type": "application/json",
        cookie,
        "X-CSRF-Token": session.csrf,
      },
      session,
    };
  };
  return {
    db,
    base,
    login,
    close: async () => {
      await new Promise<void>((r, e) =>
        server.close((err) => (err ? e(err) : r())),
      );
      db.close();
    },
  };
}
test("API: сессия, 401, роли, школа/филиал, CSRF, истечение и logout", async () => {
  const f = await fixture();
  try {
    assert.equal((await fetch(f.base + "/api/state")).status, 401);
    const director = await f.login("director"),
      teacher = await f.login("teacher"),
      finance = await f.login("finance"),
      other = await f.login("other");
    const state = await (
      await fetch(f.base + "/api/state", { headers: teacher.headers })
    ).json();
    assert.equal(state.payments.length, 0);
    assert.ok(
      state.lessons.every(
        (l: { teacherId: string }) => l.teacherId === "teacher-0",
      ),
    );
    const full = await (
      await fetch(f.base + "/api/state", { headers: director.headers })
    ).json();
    const post = (
      headers: Record<string, string>,
      command: unknown,
      revision = full.revision,
    ) =>
      fetch(f.base + "/api/commands", {
        method: "POST",
        headers,
        body: JSON.stringify({ revision, requestId: randomUUID(), command }),
      });
    const settings = {
      type: "settings",
      name: "Подмена",
      timezone: "Europe/Moscow",
      academicYear: "2026",
      closedThrough: "",
    };
    assert.equal((await post(teacher.headers, settings)).status, 403);
    assert.equal(
      (
        await post(finance.headers, {
          type: "save",
          entity: "students",
          value: full.students[0],
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await post(other.headers, {
          type: "save",
          entity: "students",
          value: full.students[0],
        })
      ).status,
      403,
    );
    const otherState = await (
      await fetch(f.base + "/api/state", { headers: other.headers })
    ).json();
    assert.equal(otherState.school.id, "school-other");
    assert.equal(
      (await post({ ...director.headers, "X-CSRF-Token": "bad" }, settings))
        .status,
      403,
    );
    assert.equal(
      (
        await post(
          { ...director.headers, Origin: "https://attacker.invalid" },
          settings,
        )
      ).status,
      403,
    );
    f.db.db
      .prepare("UPDATE sessions SET expires=0 WHERE user_id=?")
      .run("user-teacher");
    assert.equal(
      (await fetch(f.base + "/api/state", { headers: teacher.headers })).status,
      401,
    );
    assert.equal(
      (
        await fetch(f.base + "/api/logout", {
          method: "POST",
          headers: director.headers,
          body: "{}",
        })
      ).status,
      200,
    );
    assert.equal(
      (await fetch(f.base + "/api/state", { headers: director.headers }))
        .status,
      401,
    );
  } finally {
    await f.close();
  }
});
test("API: конкуренция двух администраторов и повтор ответа, валидация, 500/503", async () => {
  const f = await fixture();
  try {
    const a = await f.login("admin"),
      b = await f.login("admin");
    const s = await (
      await fetch(f.base + "/api/state", { headers: a.headers })
    ).json();
    const command = {
      type: "save",
      entity: "students",
      value: { ...s.students[0], id: randomUUID(), name: "Новый ученик" },
    };
    const id = randomUUID();
    const post = (
      headers: Record<string, string>,
      rid: string,
      cmd = command,
    ) =>
      fetch(f.base + "/api/commands", {
        method: "POST",
        headers,
        body: JSON.stringify({
          requestId: rid,
          revision: s.revision,
          command: cmd,
        }),
      });
    const responses = await Promise.all([
      post(a.headers, id),
      post(b.headers, randomUUID()),
    ]);
    assert.deepEqual(responses.map((x) => x.status).sort(), [200, 409]);
    const repeat = await post(a.headers, id);
    assert.equal(repeat.status, 200);
    assert.equal((await repeat.json()).replayed, true);
    const state = await (
      await fetch(f.base + "/api/state", { headers: a.headers })
    ).json();
    assert.equal(
      state.students.filter((x: { name: string }) => x.name === "Новый ученик")
        .length,
      1,
    );
    const invalid = await fetch(f.base + "/api/commands", {
      method: "POST",
      headers: a.headers,
      body: JSON.stringify({
        requestId: randomUUID(),
        revision: state.revision,
        command: { ...command, value: { ...command.value, name: "" } },
      }),
    });
    assert.equal(invalid.status, 422);
    f.db.db
      .prepare("UPDATE schools SET payload=? WHERE id=?")
      .run("{invalid", s.school.id);
    const broken = await fetch(f.base + "/api/state", { headers: a.headers });
    assert.equal(broken.status, 503);
    assert.ok(broken.headers.get("x-request-id"));
    const err = await broken.json();
    assert.ok(err.requestId);
    assert.ok(!JSON.stringify(err).includes("Новый ученик"));
  } finally {
    await f.close();
  }
});

test("API: обязательные заголовки, malformed JSON, изоляция филиала и внутренний 500", async () => {
  const f = await fixture();
  try {
    const a = await f.login("admin");
    const state = await (
      await fetch(f.base + "/api/state", { headers: a.headers })
    ).json();
    const response = await fetch(f.base + "/api/state", { headers: a.headers });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(
      response.headers.get("content-security-policy") || "",
      /frame-ancestors 'none'/,
    );
    assert.equal(
      (
        await fetch(f.base + "/api/commands", {
          method: "POST",
          headers: a.headers,
          body: "{bad",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(f.base + "/api/commands", {
          method: "POST",
          headers: a.headers,
          body: JSON.stringify({
            revision: state.revision,
            requestId: randomUUID(),
            command: {
              type: "save",
              entity: "rooms",
              value: {
                id: "bad-room",
                schoolId: state.school.id,
                branchId: "foreign-branch",
                name: "Подмена филиала",
                capacity: 10,
              },
            },
          }),
        })
      ).status,
      403,
    );
    const read = f.db.read.bind(f.db);
    f.db.read = () => {
      throw Error("sensitive-internal-value");
    };
    const failed = await fetch(f.base + "/api/state", { headers: a.headers });
    assert.equal(failed.status, 500);
    assert.ok(!(await failed.text()).includes("sensitive-internal-value"));
    f.db.read = read;
  } finally {
    await f.close();
  }
});
test("API: импорт preview без записи, экспорт с правами и запрет чужого занятия", async () => {
  const f = await fixture();
  try {
    const a = await f.login("admin"),
      t = await f.login("teacher");
    const s = await (
      await fetch(f.base + "/api/state", { headers: a.headers })
    ).json();
    const preview = await fetch(f.base + "/api/import/preview", {
      method: "POST",
      headers: a.headers,
      body: JSON.stringify({
        branchId: s.branches[0].id,
        csv: "name;birthDate;contact\nCSV Тест;2012-01-01;",
      }),
    });
    assert.equal(preview.status, 200);
    assert.equal((await preview.json()).count, 1);
    assert.equal(f.db.read(s.school.id).students.length, s.students.length);
    assert.equal(
      (await fetch(f.base + "/api/export/students.csv", { headers: t.headers }))
        .status,
      403,
    );
    assert.equal(
      (await fetch(f.base + "/api/export/students.csv", { headers: a.headers }))
        .status,
      200,
    );
    const deny = await fetch(f.base + "/api/commands", {
      method: "POST",
      headers: t.headers,
      body: JSON.stringify({
        revision: s.revision,
        requestId: randomUUID(),
        command: {
          type: "attendance",
          lessonId: "lesson-1",
          entries: [],
          reason: "Подмена педагога",
        },
      }),
    });
    assert.equal(deny.status, 403);
  } finally {
    await f.close();
  }
});
