import type { LogEntry } from './types';

type EventHandler = (data: unknown) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private maxRetries = 10;
  private retryCount = 0;
  private baseDelay = 1000;
  private onConnectCallback?: () => void;
  private onDisconnectCallback?: () => void;

  constructor(url: string = import.meta.env.VITE_WS_URL || 'ws://localhost:8501') {
    this.url = url;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.CONNECTING || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.retryCount = 0;
      this.onConnectCallback?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type || 'message';
        this.handlers.get(type)?.forEach((fn) => fn(data));
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.onDisconnectCallback?.();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // close will be triggered next
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.retryCount >= this.maxRetries) return;

    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.retryCount),
      30000
    );
    this.retryCount++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  on(type: string, handler: EventHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  off(type: string, handler: EventHandler) {
    this.handlers.get(type)?.delete(handler);
  }

  emit(type: string, data?: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }

  subscribeToLogs(
    serverId: string,
    onEntry: (entry: LogEntry) => void,
    level?: string
  ) {
    this.emit('subscribe_logs', { serverId, level });

    return this.on('log_entry', (data: unknown) => {
      const entry = data as LogEntry;
      if (entry.serverId === serverId) {
        onEntry(entry);
      }
    });
  }

  subscribeToMetrics(
    serverId: string,
    onUpdate: (data: unknown) => void
  ) {
    this.emit('subscribe_metrics', { serverId });

    return this.on('metrics_update', (data: unknown) => {
      const m = data as { serverId?: string };
      if (!m.serverId || m.serverId === serverId) {
        onUpdate(data);
      }
    });
  }

  subscribeToServerStatus(serverId: string, onUpdate: (data: unknown) => void) {
    this.emit('subscribe_server', { serverId });

    return this.on('server_status', (data: unknown) => {
      const s = data as { serverId?: string; status?: string };
      if (s.serverId === serverId) {
        onUpdate(data);
      }
    });
  }

  setOnConnect(cb: () => void) {
    this.onConnectCallback = cb;
  }

  setOnDisconnect(cb: () => void) {
    this.onDisconnectCallback = cb;
  }

  disconnect() {
    this.retryCount = this.maxRetries;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();
