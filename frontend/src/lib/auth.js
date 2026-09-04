const TOKEN_KEY = "parakh_token";
const USER_KEY = "parakh_user";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; } }
export function saveSession(token, user) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); }
export function clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
export function authHeaders(json = false) { return { ...(json ? { "Content-Type": "application/json" } : {}), ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) }; }

async function optimizeOcrBody(body) {
  if (!(body instanceof FormData)) return body;
  const entries = [...body.entries()];
  const optimized = new FormData();
  for (const [key, value] of entries) {
    if (!(typeof File !== "undefined" && value instanceof File && value.type.startsWith("image/"))) { optimized.append(key, value); continue; }
    try {
      const bitmap = await createImageBitmap(value);
      const maxSide = 1600;
      if (Math.max(bitmap.width, bitmap.height) <= maxSide && value.size <= 2 * 1024 * 1024) {
        bitmap.close(); optimized.append(key, value, value.name); continue;
      }
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) { bitmap.close(); optimized.append(key, value, value.name); continue; }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
      if (blob && blob.size < value.size) {
        optimized.append(key, new File([blob], value.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }), value.name.replace(/\.[^.]+$/, ".jpg"));
      } else optimized.append(key, value, value.name);
    } catch { optimized.append(key, value, value.name); }
  }
  return optimized;
}

export async function apiFetch(url, options = {}) {
  const rawUrl = String(url);
  const resolvedUrl = rawUrl.startsWith("http://localhost:5000/api")
    ? rawUrl.replace("http://localhost:5000/api", API_URL)
    : rawUrl;
  const body = resolvedUrl.includes("/api/ocr/analyze") ? await optimizeOcrBody(options.body) : options.body;
  const response = await fetch(resolvedUrl, { ...options, body, headers: { ...authHeaders(Boolean(body && typeof body === "string")), ...(options.headers || {}) } });
  if (response.status === 401) clearSession();
  return response;
}
