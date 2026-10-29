export class ApiError extends Error {
  constructor(message, { status, code, fields } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields || {};
  }
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include'
  });
  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.error?.message || 'Không thể hoàn tất yêu cầu.', {
      status: response.status,
      code: payload.error?.code,
      fields: payload.error?.fields
    });
  }
  return payload;
}

export function jsonBody(value) {
  return JSON.stringify(value);
}
