import type { ApiProblem } from "./types";

export class ApiError extends Error {
  constructor(
    public readonly kind: "http" | "network" | "invalid-response",
    public readonly status: number,
    public readonly problem?: ApiProblem,
  ) {
    super(errorMessage(kind, status, problem?.code));
    this.name = "ApiError";
  }
}

function errorMessage(kind: ApiError["kind"], status: number, code?: string) {
  if (kind === "network") return "Chưa thể kết nối. Vui lòng kiểm tra mạng và thử lại.";
  if (kind === "invalid-response") return "Phản hồi không hợp lệ. Vui lòng thử lại sau.";
  if (code === "VALIDATION_FAILED") return "Vui lòng kiểm tra thông tin đã nhập.";
  if (status === 401) return "Bạn cần đăng nhập để tiếp tục.";
  if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  if (status === 404) return "Không tìm thấy nội dung yêu cầu.";
  if (status === 409) return "Dữ liệu đã thay đổi. Vui lòng tải lại trước khi tiếp tục.";
  return "Không thể hoàn tất yêu cầu. Vui lòng thử lại sau.";
}

function isProblem(value: unknown): value is ApiProblem {
  if (!value || typeof value !== "object") return false;
  const problem = value as Record<string, unknown>;
  return (
    ["type", "title", "detail", "instance", "code"].every(
      (key) => typeof problem[key] === "string",
    ) &&
    Number.isInteger(problem.status) &&
    Number(problem.status) >= 400 &&
    Number(problem.status) <= 599 &&
    Array.isArray(problem.fieldErrors) &&
    problem.fieldErrors.every(
      (field) =>
        field &&
        typeof field === "object" &&
        typeof field.field === "string" &&
        typeof field.message === "string",
    )
  );
}

type RequestOptions = Omit<RequestInit, "body" | "cache" | "redirect"> & {
  json?: unknown;
  formData?: FormData;
  responseType?: "json" | "blob";
  authenticated?: boolean;
};

type ClientOptions = {
  baseUrl: string;
  getAccessToken?: () => string | null;
  fetcher?: typeof fetch;
  refreshAccessToken?: () => Promise<void>;
  getAuthGeneration?: () => number;
};

export function createApiClient({
  baseUrl,
  getAccessToken = () => null,
  fetcher = fetch,
  refreshAccessToken,
  getAuthGeneration = () => 0,
}: ClientOptions) {
  const origin = new URL(baseUrl);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("API base URL must be an HTTP(S) origin.");
  return {
    async request<T>(
      path: string,
      {
        json,
        formData,
        responseType = "json",
        authenticated = true,
        ...options
      }: RequestOptions = {},
    ): Promise<T> {
      const url = new URL(path, origin);
      // Chỉ gửi credential đến API origin và namespace đã cấu hình.
      if (
        !path.startsWith("/api/v1/") ||
        url.origin !== origin.origin ||
        !url.pathname.startsWith("/api/v1/") ||
        url.hash ||
        /\\/.test(path.split("?")[0]) ||
        /%2f|%5c|%2e/i.test(url.pathname)
      )
        throw new Error("Invalid API path.");
      const headers = new Headers(options.headers);
      headers.set(
        "Accept",
        responseType === "blob"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/problem+json"
          : "application/json, application/problem+json",
      );
      const token = authenticated ? getAccessToken() : null;
      const generation = getAuthGeneration();
      const assertCurrentSession = () => {
        if (authenticated && generation !== getAuthGeneration())
          throw new DOMException("Authentication changed", "AbortError");
      };
      headers.delete("Authorization");
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (json !== undefined) headers.set("Content-Type", "application/json");
      if (json !== undefined && formData) throw new Error("Choose JSON or multipart body.");
      if (formData) headers.delete("Content-Type");
      const body = formData ?? (json === undefined ? undefined : JSON.stringify(json));
      const send = async () => {
        try {
          const response = await fetcher(url, {
            ...options,
            headers,
            body,
            credentials: options.credentials ?? "include",
            cache: "no-store",
            redirect: "error",
          });
          return {
            response,
            raw:
              response.ok && responseType === "blob"
                ? await response.blob()
                : await response.text(),
          };
        } catch (error) {
          if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError"))
            throw error;
          throw new ApiError("network", 0);
        }
      };
      let { response, raw } = await send();
      assertCurrentSession();
      if (response.status === 401 && authenticated && refreshAccessToken) {
        // Request cũ có thể trả 401 sau khi request khác đã refresh xong.
        if (getAccessToken() === token) await refreshAccessToken();
        options.signal?.throwIfAborted();
        assertCurrentSession();
        const refreshed = getAccessToken();
        if (!refreshed) throw new ApiError("http", 401);
        headers.set("Authorization", `Bearer ${refreshed}`);
        ({ response, raw } = await send());
        assertCurrentSession();
      }
      if (response.status === 204 && response.ok) return undefined as T;
      if (typeof raw !== "string") {
        if (
          !response.headers
            .get("content-type")
            ?.toLowerCase()
            .includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        )
          throw new ApiError("invalid-response", response.status);
        return raw as T;
      }
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new ApiError(response.ok ? "invalid-response" : "http", response.status);
      }
      if (!response.ok)
        throw new ApiError(
          "http",
          response.status,
          isProblem(data) && data.status === response.status ? data : undefined,
        );
      if (!response.headers.get("content-type")?.toLowerCase().includes("application/json"))
        throw new ApiError("invalid-response", response.status);
      return data as T;
    },
  };
}

// F03 truyền callback đọc token hiện tại từ memory; không giữ token trong module server.
export function createBrowserApiClient(getAccessToken?: () => string | null) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_URL is required.");
  return createApiClient({ baseUrl, getAccessToken });
}
