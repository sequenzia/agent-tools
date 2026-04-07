/**
 * API client abstraction replacing Tauri's invoke() and listen().
 *
 * Provides:
 * - `api.get()`, `api.post()`, `api.put()`, `api.delete()` for REST calls
 * - `ws.on()` for WebSocket event subscription
 * - `ws.send()` for WebSocket commands
 */

// --- HTTP Client ---

const DEFAULT_TIMEOUT_MS = 10_000;

/** Build URL with query parameters. */
function buildUrl(
  path: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/** Parse response, throwing on error status codes. */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage: string;
    try {
      const body = (await response.json()) as { error?: string };
      errorMessage = body.error ?? response.statusText;
    } catch {
      errorMessage = response.statusText;
    }
    throw new Error(errorMessage);
  }
  return response.json() as Promise<T>;
}

export const api = {
  async get<T>(
    path: string,
    params?: Record<string, string | number | undefined | null>,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(buildUrl(path, params), {
        signal: controller.signal,
      });
      return handleResponse<T>(response);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        throw new Error(`Request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body != null ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      return handleResponse<T>(response);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        throw new Error(`Request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: body != null ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      return handleResponse<T>(response);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        throw new Error(`Request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  },

  async delete<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(path, {
        method: "DELETE",
        signal: controller.signal,
      });
      return handleResponse<T>(response);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        throw new Error(`Request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  },
};

// --- WebSocket Client ---

type EventHandler = (payload: unknown) => void;
type UnsubscribeFn = () => void;

class WsClient {
  private socket: WebSocket | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 5000;
  private isClosing = false;

  constructor() {
    this.connect();
  }

  private getWsUrl(): string {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }

  private connect(): void {
    if (this.isClosing) return;

    try {
      this.socket = new WebSocket(this.getWsUrl());

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            event: string;
            payload: unknown;
          };
          const eventHandlers = this.handlers.get(msg.event);
          if (eventHandlers) {
            for (const handler of eventHandlers) {
              handler(msg.payload);
            }
          }
        } catch {
          // Ignore malformed messages
        }
      };

      this.socket.onclose = () => {
        if (!this.isClosing) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = () => {
        // Error event is always followed by close, reconnect handled there
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isClosing) return;

    const delay = Math.min(
      1000 * Math.pow(1.5, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /** Subscribe to a WebSocket event. Returns an unsubscribe function. */
  on<T>(event: string, handler: (payload: T) => void): UnsubscribeFn {
    let eventHandlers = this.handlers.get(event);
    if (!eventHandlers) {
      eventHandlers = new Set();
      this.handlers.set(event, eventHandlers);
    }

    const wrappedHandler: EventHandler = (payload) =>
      handler(payload as T);
    eventHandlers.add(wrappedHandler);

    return () => {
      eventHandlers!.delete(wrappedHandler);
      if (eventHandlers!.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  /** Send a message to the server via WebSocket. */
  send(event: string, payload?: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ event, payload }));
    }
  }

  /** Whether the WebSocket is currently connected. */
  connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /** Close the WebSocket connection. */
  close(): void {
    this.isClosing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.socket?.close();
  }
}

// Singleton WebSocket client
export const ws = new WsClient();
