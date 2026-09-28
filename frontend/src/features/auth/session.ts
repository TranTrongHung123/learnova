import { ApiError, createApiClient } from "@/lib/api/client";
import type { Workspace } from "@/features/workspace/navigation";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  status: "ACTIVE" | "LOCKED" | "DISABLED";
  roles: Workspace[];
};
type Tokens = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  expiresAt: string;
  user: CurrentUser;
};
export type AuthState = {
  status: "BOOTSTRAPPING" | "AUTHENTICATED" | "UNAUTHENTICATED" | "ERROR";
  user: CurrentUser | null;
  error?: string;
};
export const initialAuth: AuthState = { status: "BOOTSTRAPPING", user: null };

export class AuthSession {
  private token: string | null = null;
  private generation = 0;
  private state: AuthState = initialAuth;
  private listeners = new Set<() => void>();
  private refreshing?: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private channel?: BroadcastChannel;
  private raw;
  readonly api;
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher = fetch,
  ) {
    this.raw = createApiClient({
      baseUrl,
      fetcher,
      getAccessToken: () => this.token,
    });
    this.api = createApiClient({
      baseUrl,
      fetcher,
      getAccessToken: () => this.token,
      getAuthGeneration: () => this.generation,
      refreshAccessToken: () => this.refresh(),
    });
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  connect() {
    if (typeof BroadcastChannel === "undefined") return () => {};
    const channel = new BroadcastChannel("learnova-auth");
    this.channel = channel;
    channel.onmessage = (event) => {
      if (event.data === "logout") this.clear();
      if (event.data === "session-changed") {
        this.clear();
        // Đợi refresh cũ kết thúc trước khi bootstrap phiên mới từ cookie.
        void (this.refreshing ?? Promise.resolve())
          .catch(() => {})
          .then(() => this.bootstrap());
      }
    };
    return () => {
      channel.close();
      if (this.channel === channel) this.channel = undefined;
    };
  }
  private publish(state: AuthState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  private clear() {
    this.generation++;
    this.token = null;
    this.publish({ status: "UNAUTHENTICATED", user: null });
  }
  private accept(result: Tokens, generation: number) {
    if (generation !== this.generation) return;
    this.token = result.accessToken;
    this.publish({ status: "AUTHENTICATED", user: result.user });
  }
  private async locked<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      if (typeof navigator !== "undefined" && navigator.locks)
        return navigator.locks.request("learnova-auth-cookie", operation);
      return operation();
    });
    this.queue = result.catch(() => {});
    return result;
  }
  private async csrf() {
    const result = await this.raw.request<{
      headerName: string;
      token: string;
    }>("/api/v1/auth/csrf", { authenticated: false });
    return { [result.headerName]: result.token };
  }
  async bootstrap() {
    try {
      await this.refresh();
    } catch (error) {
      if (this.state.status === "UNAUTHENTICATED") return;
      this.publish({
        ...this.state,
        status: "ERROR",
        error: authMessage(error),
      });
    }
  }
  refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    const generation = this.generation;
    this.refreshing = this.locked(async () => {
      if (generation !== this.generation) return;
      try {
        const result = await this.raw.request<Tokens>("/api/v1/auth/refresh", {
          method: "POST",
          authenticated: false,
          headers: await this.csrf(),
        });
        this.accept(result, generation);
      } catch (error) {
        if (
          generation === this.generation &&
          error instanceof ApiError &&
          (error.status === 401 ||
            error.problem?.code === "ACCOUNT_LOCKED" ||
            error.problem?.code === "ACCOUNT_DISABLED")
        ) {
          this.clear();
        }
        throw error;
      }
    }).finally(() => {
      this.refreshing = undefined;
    });
    return this.refreshing;
  }
  async register(input: {
    email: string;
    password: string;
    displayName: string;
    roles: Workspace[];
  }) {
    return this.locked(async () =>
      this.raw.request<CurrentUser>("/api/v1/auth/register", {
        method: "POST",
        authenticated: false,
        headers: await this.csrf(),
        json: input,
      }),
    );
  }
  async login(email: string, password: string) {
    // Vô hiệu phản hồi refresh đang bay trước khi người dùng đổi tài khoản.
    const generation = ++this.generation;
    await this.locked(async () => {
      const result = await this.raw.request<Tokens>("/api/v1/auth/login", {
        method: "POST",
        authenticated: false,
        headers: await this.csrf(),
        json: { email, password },
      });
      this.accept(result, generation);
      if (generation === this.generation)
        this.channel?.postMessage("session-changed");
    });
  }
  async logout(all = false) {
    const generation = ++this.generation;
    await this.locked(async () => {
      if (generation !== this.generation)
        throw new Error("Authentication changed");
      try {
        if (all) {
          // Refresh và logout-all trong cùng khóa để tab khác không đổi cookie ở giữa.
          const result = await this.raw.request<Tokens>(
            "/api/v1/auth/refresh",
            {
              method: "POST",
              authenticated: false,
              headers: await this.csrf(),
            },
          );
          if (generation !== this.generation)
            throw new Error("Authentication changed");
          this.accept(result, generation);
        }
        await this.raw.request(
          `/api/v1/auth/${all ? "logout-all" : "logout"}`,
          {
            method: "POST",
            authenticated: all,
            headers: await this.csrf(),
          },
        );
      } finally {
        if (generation === this.generation) {
          this.clear();
          this.channel?.postMessage("logout");
        }
      }
    });
  }
}

export function authMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
      INVALID_CREDENTIALS: "Email hoặc mật khẩu chưa đúng.",
      EMAIL_ALREADY_EXISTS:
        "Email này không thể đăng ký. Vui lòng đăng nhập hoặc dùng email khác.",
      ACCOUNT_LOCKED: "Tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên.",
      ACCOUNT_DISABLED: "Tài khoản đã ngừng hoạt động.",
      CSRF_INVALID: "Phiên thao tác đã thay đổi. Vui lòng thử lại.",
      VALIDATION_FAILED: "Vui lòng kiểm tra thông tin đã nhập.",
    };
    return messages[error.problem?.code ?? ""] ?? error.message;
  }
  return "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
}
