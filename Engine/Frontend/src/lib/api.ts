export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function getJson<T>(input: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(input, {
    ...init,
    method: init?.method ?? "GET",
  });
}

export async function postJson<T>(input: string, body: unknown, init?: RequestInit): Promise<T> {
  return apiFetch<T>(input, {
    ...init,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    throw new ApiError(
      response.statusText || "Request failed",
      response.status,
      data,
    );
  }

  return data as T;
}
