export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    },
  });
}

export function notFound(): Response {
  return jsonResponse({ error: "not found" }, 404);
}

export function badRequest(message: string): Response {
  return jsonResponse({ error: message }, 400);
}

export function serviceUnavailable(message: string): Response {
  return jsonResponse({ error: message }, 503);
}

export function internalError(message: string): Response {
  return jsonResponse({ error: message }, 500);
}

export function redirectResponse(location: string, headers: HeadersInit = {}): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location,
      ...headers,
    },
  });
}

export async function readJson<T>(request: Request): Promise<T> {
  const text = await request.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function utcNow(): string {
  return new Date().toISOString();
}

export function isDue(isoValue: string | null): boolean {
  if (!isoValue) return false;
  const time = Date.parse(isoValue);
  return Number.isFinite(time) && time <= Date.now();
}
