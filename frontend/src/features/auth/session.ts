import { ApiError, createApiClient } from "@/lib/api/client";
import type { Workspace } from "@/features/workspace/navigation";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  status: "ACTIVE" | "LOCKED" | "DISABLED";
  roles: Workspace[];
};
export type Profile = CurrentUser & { createdAt: string; hasLocalIdentity: boolean };
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

export type GoogleFlow = {
  state: "ONBOARDING" | "LINK_REQUIRED" | "LINK_CONFIRMATION";
  email: string;
};

export class AuthSession {
  private token: string | null = null;
  private generation = 0;
  private state: AuthState = initialAuth;
  private listeners = new Set<() => void>();
  private refreshing?: Promise<void>;
  private googleResolving?: Promise<GoogleFlow | null>;
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
  googleConfig(signal?: AbortSignal) {
    return this.raw.request<{ enabled: boolean }>("/api/v1/auth/google/config", {
      authenticated: false, signal,
    });
  }
  get googleUrl() { return new URL("/api/v1/auth/google", this.baseUrl).href; }
  googleFlow() {
    return this.raw.request<GoogleFlow>("/api/v1/auth/google/flow", { authenticated: false });
  }
  resolveGoogleCallback(): Promise<GoogleFlow | null> {
    // Strict Mode và nhiều component cùng dùng kết quả callback, không rotate hai lần.
    if (this.googleResolving) return this.googleResolving;
    this.googleResolving = (async () => {
      try { return await this.googleFlow(); }
      catch (error) {
        if (!(error instanceof ApiError) || error.problem?.code !== "GOOGLE_FLOW_EXPIRED") throw error;
        await this.refresh();
        this.channel?.postMessage("session-changed");
        return null;
      }
    })().finally(() => { this.googleResolving = undefined; });
    return this.googleResolving;
  }
  async googleAction(action: "onboarding" | "link/verify" | "link/confirm" | "cancel", input?: unknown) {
    const completes = action === "onboarding" || action === "link/confirm";
    const generation = completes ? ++this.generation : this.generation;
    return this.locked(async () => {
      await this.raw.request<void>(`/api/v1/auth/google/${action}`, {
        method: "POST", authenticated: false, headers: await this.csrf(), json: input,
      });
      if (completes) {
        const result = await this.raw.request<Tokens>("/api/v1/auth/refresh", {
          method: "POST", authenticated: false, headers: await this.csrf(),
        });
        this.accept(result, generation);
        if (generation === this.generation) this.channel?.postMessage("session-changed");
      }
    });
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

  getProfile(signal?: AbortSignal) {
    return this.api.request<Profile>("/api/v1/auth/profile", { signal });
  }
  async saveProfile(input: { displayName: string; avatarUrl: string | null }) {
    return this.accountMutation<Profile>("/api/v1/auth/profile", "PUT", input, (profile) => {
      if (this.state.user?.id === profile.id)
        this.publish({ ...this.state, user: { ...this.state.user, displayName: profile.displayName, avatarUrl: profile.avatarUrl } });
    });
  }
  changePassword(input: { currentPassword: string; newPassword: string }) {
    return this.accountMutation<void>("/api/v1/auth/change-password", "POST", input);
  }
  private accountMutation<T>(path: string, method: string, input: unknown, accept?: (value: T) => void) {
    const generation = this.generation;
    return this.locked(async () => {
      const assertCurrent = () => {
        if (generation !== this.generation) throw new DOMException("Authentication changed", "AbortError");
      };
      assertCurrent();
      // Refresh trong cùng khóa cookie; không gọi refresh() lồng vì sẽ tự chờ hàng đợi.
      try {
        const result = await this.raw.request<Tokens>("/api/v1/auth/refresh", {
          method: "POST", authenticated: false, headers: await this.csrf(),
        });
        assertCurrent();
        this.accept(result, generation);
      } catch (error) {
        if (generation === this.generation && error instanceof ApiError &&
            (error.status === 401 || ["ACCOUNT_LOCKED", "ACCOUNT_DISABLED"].includes(error.problem?.code ?? ""))) this.clear();
        throw error;
      }
      const headers = await this.csrf();
      assertCurrent();
      // Không tự gửi lại command khi chưa biết server đã commit hay chưa.
      const result = await this.raw.request<T>(path, { method, headers, json: input });
      assertCurrent();
      accept?.(result);
      return result;
    });
  }
}

export function authMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
      INVALID_CREDENTIALS: "Email hoặc mật khẩu chưa đúng.",
      CURRENT_PASSWORD_INCORRECT: "Mật khẩu hiện tại chưa đúng.",
      LOCAL_IDENTITY_REQUIRED: "Tài khoản Google chưa hỗ trợ đổi mật khẩu tại Learnova.",
      EMAIL_ALREADY_EXISTS:
        "Email này không thể đăng ký. Vui lòng đăng nhập hoặc dùng email khác.",
      ACCOUNT_LOCKED: "Tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên.",
      ACCOUNT_DISABLED: "Tài khoản đã ngừng hoạt động.",
      CSRF_INVALID: "Phiên thao tác đã thay đổi. Vui lòng thử lại.",
      GOOGLE_FLOW_EXPIRED: "Phiên Google đã hết hạn hoặc đã hoàn tất. Vui lòng đăng nhập lại.",
      GOOGLE_FLOW_CHANGED: "Phiên Google đã thay đổi ở một thao tác khác. Vui lòng tải lại trạng thái.",
      GOOGLE_IDENTITY_CONFLICT: "Không thể liên kết tài khoản Google này. Vui lòng đăng nhập bằng phương thức đã có.",
      GOOGLE_LINK_ATTEMPTS_EXCEEDED: "Đã vượt số lần xác minh. Vui lòng bắt đầu đăng nhập Google lại.",
      ONBOARDING_REQUIRED: "Vui lòng đăng nhập Google và hoàn tất chọn vai trò.",
      VALIDATION_FAILED: "Vui lòng kiểm tra thông tin đã nhập.",
    };
    return messages[error.problem?.code ?? ""] ?? error.message;
  }
  return "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
}
