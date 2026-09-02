const TOKEN_KEY = "parakh_token";
const USER_KEY = "parakh_user";

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; } }
export function saveSession(token, user) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); }
export function clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
export function authHeaders(json = false) { return { ...(json ? { "Content-Type": "application/json" } : {}), ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) }; }
export async function apiFetch(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...authHeaders(Boolean(options.body && typeof options.body === "string")), ...(options.headers || {}) } });
  if (response.status === 401) clearSession();
  return response;
}
