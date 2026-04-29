const RAW_API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api') as string
const API_URL = RAW_API_URL.replace(/\/+$/, '')
const TOKEN_KEY = 'genial-quizz:token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getApiBase(): string {
  return API_URL
}

/**
 * Resolves a media reference (returned by /media uploads as `/media/<id>`) to an
 * absolute URL the browser can fetch directly. External URLs (http/https/data)
 * are returned untouched.
 */
export function resolveMediaUrl(ref: string | null | undefined): string | undefined {
  if (!ref) return undefined
  if (/^(https?:|data:|blob:)/i.test(ref)) return ref
  if (ref.startsWith('/')) return `${API_URL}${ref}`
  return ref
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers)
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData
  if (opts.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_URL}${path}`, { ...opts, headers })

  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      // ignore non-JSON error bodies
    }
    const message =
      (body as { message?: string } | undefined)?.message ?? res.statusText ?? 'Request failed'
    throw new ApiError(res.status, message, body)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
