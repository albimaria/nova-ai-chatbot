// Nova API client: one place for the backend URL, auth headers, errors and streaming.

const PRODUCTION_API = "https://nova-ai-chatbot-1gwj.onrender.com";

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:8000" : PRODUCTION_API)
).replace(/\/$/, "");

const TOKEN_KEY = "nova_access_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Called when any request comes back 401 so the app can return to the login screen.
let onUnauthorized = () => {};

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

function headers(extra = {}) {
  const token = tokenStore.get();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

async function readError(response, fallback) {
  try {
    const data = await response.json();

    if (typeof data?.detail === "string") return data.detail;

    if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
      return data.detail[0].msg.replace(/^Value error, /, "");
    }
  } catch {
    // Not JSON.
  }

  if (response.status === 429) return "Too many requests. Please slow down a little.";
  if (response.status >= 500) return "Nova's server had a problem. Please try again.";

  return fallback;
}

async function handle(response, fallback, { auth = true } = {}) {
  if (response.ok) {
    return response.status === 204 ? null : response.json();
  }

  if (response.status === 401 && auth && tokenStore.get()) {
    onUnauthorized();
  }

  throw new ApiError(await readError(response, fallback), response.status);
}

async function request(path, { method = "GET", body, signal, fallback, auth } = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal,
      headers: headers(body !== undefined ? { "Content-Type": "application/json" } : {}),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(
      "Can't reach Nova's server. It may be waking up — try again in a few seconds.",
      0
    );
  }

  return handle(response, fallback || "Something went wrong.", { auth });
}

// ------------------------------------------------------------
// Auth & account
// ------------------------------------------------------------

export const authApi = {
  signup: (email, password, name) =>
    request("/auth/signup", {
      method: "POST",
      body: { email, password, name: name || null },
      auth: false,
      fallback: "Couldn't create your account.",
    }),
  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
      fallback: "Couldn't log in.",
    }),
  guest: () =>
    request("/auth/guest", {
      method: "POST",
      auth: false,
      fallback: "Couldn't start the demo.",
    }),
  me: () => request("/auth/me"),
  updateProfile: (fields) => request("/auth/me", { method: "PATCH", body: fields }),
  changePassword: (current_password, new_password) =>
    request("/auth/change-password", {
      method: "POST",
      body: { current_password, new_password },
    }),
  exportData: () => request("/auth/export"),
  deleteAccount: (password) =>
    request("/auth/me", { method: "DELETE", body: { password } }),
};

// ------------------------------------------------------------
// Conversations
// ------------------------------------------------------------

export const conversationsApi = {
  list: () => request("/api/v1/conversations", { fallback: "Couldn't load your chats." }),
  get: (id) => request(`/api/v1/conversations/${id}`, { fallback: "Couldn't open that chat." }),
  update: (id, fields) =>
    request(`/api/v1/conversations/${id}`, { method: "PATCH", body: fields }),
  remove: (id) => request(`/api/v1/conversations/${id}`, { method: "DELETE" }),
  removeAll: () => request("/api/v1/conversations", { method: "DELETE" }),
  share: (id) => request(`/api/v1/conversations/${id}/share`, { method: "POST" }),
  unshare: (id) => request(`/api/v1/conversations/${id}/share`, { method: "DELETE" }),
  shared: (token) =>
    request(`/api/v1/shared/${token}`, { auth: false, fallback: "This shared chat isn't available." }),
};

export const chatApi = {
  models: () => request("/api/v1/chat/models"),
  feedback: (messageId, feedback) =>
    request(`/api/v1/chat/messages/${messageId}/feedback`, {
      method: "PUT",
      body: { feedback },
    }),
};

export const usageApi = {
  get: (days = 30) => request(`/api/v1/usage?days=${days}`, { fallback: "Couldn't load usage." }),
};

// ------------------------------------------------------------
// Files
// ------------------------------------------------------------

export async function uploadFile(file, signal) {
  const form = new FormData();
  form.append("file", file);

  let response;

  try {
    response = await fetch(`${API_BASE_URL}/api/v1/files/upload`, {
      method: "POST",
      headers: headers(),
      body: form,
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("Upload failed: can't reach Nova's server.", 0);
  }

  return handle(response, `Couldn't upload ${file.name}.`);
}

// ------------------------------------------------------------
// Streaming (Server-Sent Events over fetch)
// ------------------------------------------------------------

function parseEvent(block) {
  let event = "message";
  const data = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }

  if (!data.length) return null;

  try {
    return { event, data: JSON.parse(data.join("\n")) };
  } catch {
    return null;
  }
}

/**
 * Start a streamed reply.
 *
 * kind: "send" | "edit" | "regenerate"
 * handlers: { onStart, onDelta, onReset, onSources, onNotice, onDone }
 */
export async function streamChat({ kind, messageId, body, signal, handlers = {} }) {
  const path =
    kind === "edit"
      ? `/api/v1/chat/messages/${messageId}/edit`
      : kind === "regenerate"
        ? `/api/v1/chat/messages/${messageId}/regenerate`
        : "/api/v1/chat/stream";

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      signal,
      headers: headers({ "Content-Type": "application/json", Accept: "text/event-stream" }),
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(
      "Can't reach Nova's server. It may be waking up — try again in a few seconds.",
      0
    );
  }

  if (!response.ok) {
    await handle(response, "Nova couldn't answer that.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (parsed) => {
    if (!parsed) return;
    const { event, data } = parsed;

    if (event === "start") handlers.onStart?.(data);
    else if (event === "delta") handlers.onDelta?.(data.text);
    else if (event === "reset") handlers.onReset?.();
    else if (event === "sources") handlers.onSources?.(data.sources);
    else if (event === "notice") handlers.onNotice?.(data.message);
    else if (event === "done") handlers.onDone?.(data);
    else if (event === "error") throw new ApiError(data.message, 502);
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        dispatch(parseEvent(block));
      }
    }

    if (buffer.trim()) dispatch(parseEvent(buffer));
  } finally {
    reader.releaseLock?.();
  }
}
