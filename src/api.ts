import {
  StateSchema,
  type State,
  type Session,
  type Command,
} from "../shared/model";
export class ApiError extends Error {
  status: number;
  requestId: string;
  field: string;
  constructor(status: number, message: string, requestId = "", field = "") {
    super(message);
    this.status = status;
    this.requestId = requestId;
    this.field = field;
  }
}
export async function request<T>(
  path: string,
  init: RequestInit = {},
  csrf = "",
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      ...init,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        ...init.headers,
      },
      signal: init.signal || AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(
      0,
      "Нет связи с сервером. Проверьте подключение и повторите тот же запрос.",
    );
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new ApiError(response.status, "Некорректный ответ сервера");
  }
  if (!response.ok) {
    const error = value as {
      error: string;
      requestId?: string;
      field?: string;
    };
    throw new ApiError(
      response.status,
      error.error,
      error.requestId,
      error.field,
    );
  }
  return value as T;
}
export const api = {
  session: () => request<Session>("/session"),
  state: async () => {
    const value = await request<State>("/state");
    const result = StateSchema.safeParse(value);
    if (!result.success) throw new ApiError(503, "Схема ответа сервера повреждена или несовместима. Данные не сброшены.");
    return result.data;
  },
  login: (email: string, password: string) =>
    request<Session>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: (csrf: string) =>
    request("/logout", { method: "POST", body: "{}" }, csrf),
  command: (
    command: Command,
    revision: number,
    requestId: string,
    csrf: string,
  ) =>
    request<{ entityId: string; revision: number; replayed: boolean }>(
      "/commands",
      {
        method: "POST",
        body: JSON.stringify({ command, revision, requestId }),
      },
      csrf,
    ),
};
