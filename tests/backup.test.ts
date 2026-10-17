import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Store } from "../server/store.ts";
import { TestAdapter, UnconfiguredAdapter } from "../server/integrations.ts";
test("Проверенное резервирование и восстановление в новую базу", () => {
  const dir = mkdtempSync(join(tmpdir(), "ersh-backup-"));
  try {
    const source = join(dir, "source.sqlite"),
      copy = join(dir, "snapshot.sqlite"),
      target = join(dir, "restored.sqlite");
    const s = new Store(source, true);
    const expected = s.read("school-demo");
    s.close();
    execFileSync(process.execPath, ["scripts/backup.ts", copy], {
      env: { ...process.env, DB_PATH: source },
    });
    execFileSync(process.execPath, ["scripts/backup.ts", target], {
      env: { ...process.env, DB_PATH: copy },
    });
    const restored = new Store(target, true);
    assert.deepEqual(restored.read("school-demo"), expected);
    restored.close();
    assert.throws(() =>
      execFileSync(process.execPath, ["scripts/backup.ts", copy], {
        env: { ...process.env, DB_PATH: source },
        stdio: "pipe",
      }),
    );
    assert.ok(existsSync(copy));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Контракт тестового провайдера и честный отказ рабочего без реквизитов", () => {
  const req = {
    idempotencyKey: "key",
    channel: "payment" as const,
    documentId: "doc",
  };
  const adapter = new TestAdapter();
  assert.deepEqual(adapter.accept(req), adapter.accept(req));
  assert.equal(adapter.accept(req).realDelivery, false);
  assert.throws(() => new UnconfiguredAdapter().accept(req), /не настроен/);
});
