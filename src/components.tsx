import { useEffect, useRef, useState, type ReactNode } from "react";
export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    home: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M7 2v6m10-6v6" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M2 21v-3a7 7 0 0 1 14 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 4 5v2" />
      </>
    ),
    book: (
      <>
        <path d="M3 4q5-2 9 1 4-3 9-1v16q-5-2-9 1-4-3-9-1zM12 5v16" />
      </>
    ),
    money: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <circle cx="12" cy="12" r="4" />
        <path d="M5 9v6m14-6v6" />
      </>
    ),
    chart: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7 17v-4m5 4V7m5 10v-7" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="m10 2 4 0 1 3 3 1 3 2-1 4 1 4-3 2-3 1-1 3h-4l-1-3-3-1-3-2 1-4-1-4 3-2 3-1z" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="m15 15 6 6" />
      </>
    ),
    plus: <path d="M12 4v16M4 12h16" />,
    close: <path d="m5 5 14 14M19 5 5 19" />,
    bell: (
      <>
        <path d="M4 17h16l-2-3V9a6 6 0 0 0-12 0v5zM10 21h4" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m7 12 3 3 7-7" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 3" />
      </>
    ),
    warning: (
      <>
        <path d="m12 2 10 19H2zM12 8v6m0 3v1" />
      </>
    ),
    menu: <path d="M3 6h18M3 12h18M3 18h18" />,
    room: (
      <>
        <path d="M4 22V3l13-1v20M2 22h20M17 5h4v17M13 12v2" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M3 22v-2a9 9 0 0 1 18 0v2" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.book}
    </svg>
  );
}
export function Button({
  children,
  onClick,
  primary = false,
  disabled = false,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  [key: string]: unknown;
}) {
  return (
    <button
      type="button"
      className={primary ? "btn primary" : "btn"}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
export type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  value?: string;
  options?: { value: string; label: string }[];
  help?: string;
};
export interface FormSpec {
  title: string;
  fields: Field[];
  submit: (values: Record<string, string>, key: string) => Promise<void>;
  intro?: ReactNode;
  bulk?: boolean;
  preview?: (values: Record<string, string>) => Promise<ReactNode>;
}
export function Modal({
  spec,
  onClose,
}: {
  spec: FormSpec;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    origin = useRef<HTMLElement | null>(null),
    key = useRef(crypto.randomUUID());
  const [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        spec.fields.map((f) => [
          f.name,
          f.value ?? f.options?.[0]?.value ?? "",
        ]),
      ),
    ),
    [dirty, setDirty] = useState(false),
    [confirm, setConfirm] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [fieldError, setFieldError] = useState(""),
    [preview, setPreview] = useState<ReactNode>(null);
  const close = () => {
    if (saving) return;
    if (dirty) setConfirm(true);
    else onClose();
  };
  useEffect(() => {
    origin.current = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      const el = origin.current;
      requestAnimationFrame(() =>
        el?.isConnected && el !== document.body
          ? el.focus()
          : document.querySelector<HTMLElement>("main h1")?.focus(),
      );
    };
  }, []);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setFieldError("");
    try {
      await spec.submit(values, key.current);
      onClose();
    } catch (e) {
      const err = e as Error & { requestId?: string; field?: string };
      setError(err.message + (err.requestId ? " · Код: " + err.requestId : ""));
      setFieldError(err.field || "");
      requestAnimationFrame(() =>
        dialog.current?.querySelector<HTMLElement>('[role="alert"]')?.focus(),
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="modal-header">
        <h2 id="modal-title">{spec.title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Закрыть"
          disabled={saving}
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </div>
      {confirm && (
        <div
          className="discard"
          role="alertdialog"
          aria-label="Несохранённые изменения"
        >
          <p>Закрыть без сохранения изменений?</p>
          <Button onClick={() => setConfirm(false)}>
            Продолжить редактирование
          </Button>
          <Button onClick={onClose}>Не сохранять</Button>
        </div>
      )}
      <form onSubmit={submit} hidden={confirm}>
        <div>{spec.intro}</div>
        {spec.bulk && (
          <Button
            onClick={() => {
              setValues(
                Object.fromEntries(
                  Object.entries(values).map(([k, v]) => [
                    k,
                    k.startsWith("state-") ? "present" : v,
                  ]),
                ),
              );
              setDirty(true);
            }}
          >
            Предпросмотр: все присутствуют
          </Button>
        )}
        {spec.fields.map((f) => (
          <label key={f.name} htmlFor={"field-" + f.name}>
            {f.label}
            {f.options ? (
              <select
                id={"field-" + f.name}
                aria-label={f.label}
                name={f.name}
                value={values[f.name]}
                required={f.required !== false}
                aria-invalid={fieldError === f.name}
                aria-describedby={
                  fieldError === f.name ? "form-error" : undefined
                }
                onChange={(e) => {
                  setValues({ ...values, [f.name]: e.target.value });
                  setDirty(true);
                  setPreview(null);
                }}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                id={"field-" + f.name}
                aria-label={f.label}
                name={f.name}
                value={values[f.name]}
                required={f.required !== false}
                maxLength={2000}
                onChange={(e) => {
                  setValues({ ...values, [f.name]: e.target.value });
                  setDirty(true);
                  setPreview(null);
                }}
              />
            ) : (
              <input
                id={"field-" + f.name}
                aria-label={f.label}
                name={f.name}
                type={f.type || "text"}
                value={values[f.name]}
                required={f.required !== false}
                maxLength={200}
                min={f.type === "number" ? "1" : undefined}
                aria-invalid={fieldError === f.name}
                aria-describedby={
                  fieldError === f.name ? "form-error" : undefined
                }
                onChange={(e) => {
                  setValues({ ...values, [f.name]: e.target.value });
                  setDirty(true);
                  setPreview(null);
                }}
              />
            )}
            {f.help && <small>{f.help}</small>}
          </label>
        ))}
        {spec.preview && (
          <>
            <Button
              disabled={saving}
              onClick={() => {
                setSaving(true);
                setError("");
                void spec.preview!(values)
                  .then(setPreview)
                  .catch((e) => setError(e.message))
                  .finally(() => setSaving(false));
              }}
            >
              Проверить импорт
            </Button>
            {preview}
          </>
        )}
        {error && (
          <p className="error" id="form-error" role="alert" tabIndex={-1}>
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button onClick={close} disabled={saving}>
            Отмена
          </Button>
          <button
            className="btn primary"
            type="submit"
            disabled={saving || (!!spec.preview && !preview)}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
export function Drawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      requestAnimationFrame(() =>
        previous?.isConnected && previous !== document.body
          ? previous.focus()
          : document.querySelector<HTMLElement>("main h1")?.focus(),
      );
    };
  }, []);
  return (
    <dialog
      className="drawer"
      ref={ref}
      aria-labelledby="drawer-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-header">
        <h2 id="drawer-title">{title}</h2>
        <Button onClick={onClose} aria-label="Закрыть карточку">
          <Icon name="close" />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({ children = "Нет записей" }: { children?: ReactNode }) {
  return <p className="empty">{children}</p>;
}
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(rows.length / 25);
  useEffect(() => setPage(0), [rows.length]);
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 25, page * 25 + 25).map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty />}
      </div>
      {pages > 1 && (
        <div className="pagination">
          <Button disabled={!page} onClick={() => setPage(page - 1)}>
            Назад
          </Button>
          <span>
            {page + 1} / {pages}
          </span>
          <Button
            disabled={page >= pages - 1}
            onClick={() => setPage(page + 1)}
          >
            Далее
          </Button>
        </div>
      )}
    </>
  );
}
