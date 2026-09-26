import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "./client";
const problem = {
  type: "about:blank",
  title: "Bad Request",
  status: 400,
  detail: "Invalid",
  instance: "/api/v1/questions",
  code: "VALIDATION_FAILED",
  fieldErrors: [
    { field: "title", message: "Required" },
    { field: "title", message: "Too short" },
  ],
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type":
        status >= 400 ? "application/problem+json" : "application/json",
    },
  });
function setup(res: Response = response({ status: "UP" })) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(res);
  return {
    fetcher,
    client: createApiClient({ baseUrl: "https://api.example.test", fetcher }),
  };
}
describe("API transport", () => {
  it("cho phép query chứa URL đã encode mà không nới origin", async () => {
    const { client, fetcher } = setup();
    await client.request("/api/v1/questions?search=https%3A%2F%2Fexample.test");
    expect(String(fetcher.mock.calls[0][0])).toBe("https://api.example.test/api/v1/questions?search=https%3A%2F%2Fexample.test");
  });
  it("đọc token mới ở mỗi request, gửi credentials và JSON", async () => {
    let token = "first";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => response({ ok: true }));
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      fetcher,
      getAccessToken: () => token,
    });
    await client.request("/api/v1/questions", {
      method: "POST",
      json: { title: "Đề thi" },
    });
    token = "second";
    await client.request("/api/v1/questions");
    const first = fetcher.mock.calls[0][1]!;
    expect(first).toMatchObject({
      credentials: "include",
      cache: "no-store",
      redirect: "error",
      body: JSON.stringify({ title: "Đề thi" }),
    });
    expect(new Headers(first.headers).get("Authorization")).toBe(
      "Bearer first",
    );
    expect(
      new Headers(fetcher.mock.calls[1][1]!.headers).get("Authorization"),
    ).toBe("Bearer second");
  });
  it("request công khai không gửi bearer và có thể bỏ cookie", async () => {
    const { fetcher } = setup();
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      fetcher,
      getAccessToken: () => "secret",
    });
    await client.request("/api/v1/health", {
      authenticated: false,
      credentials: "omit",
    });
    expect(fetcher.mock.calls[0][1]!.credentials).toBe("omit");
    expect(
      new Headers(fetcher.mock.calls[0][1]!.headers).has("Authorization"),
    ).toBe(false);
  });
  it("đọc JSON và xử lý 204", async () => {
    expect(await setup().client.request("/api/v1/health")).toEqual({
      status: "UP",
    });
    expect(
      await setup(new Response(null, { status: 204 })).client.request(
        "/api/v1/test",
      ),
    ).toBeUndefined();
  });
  it("giữ nhiều fieldErrors cùng field theo contract", async () => {
    const { client } = setup(response(problem, 400));
    await expect(client.request("/api/v1/questions")).rejects.toMatchObject({
      kind: "http",
      status: 400,
      problem,
      message: "Vui lòng kiểm tra thông tin đã nhập.",
    });
  });
  it.each([401, 403, 409, 500])("không tự retry HTTP %s", async (status) => {
    const { fetcher, client } = setup(response({ ...problem, status }, status));
    await expect(
      client.request("/api/v1/test", { method: "POST" }),
    ).rejects.toMatchObject({ kind: "http", status });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("không hiển thị raw HTML hay lỗi nội bộ", async () => {
    const { client } = setup(
      new Response("<html>SQL secret</html>", { status: 502 }),
    );
    await expect(client.request("/api/v1/test")).rejects.toMatchObject({
      kind: "http",
      status: 502,
      problem: undefined,
    });
  });
  it.each([
    new Response("not json"),
    new Response("{}", { headers: { "content-type": "text/html" } }),
  ])("phân biệt response thành công sai định dạng", async (res) => {
    await expect(
      setup(res).client.request("/api/v1/test"),
    ).rejects.toMatchObject({ kind: "invalid-response" });
  });
  it("không tin ProblemDetail sai schema", async () => {
    await expect(
      setup(response({ ...problem, fieldErrors: {} }, 400)).client.request(
        "/api/v1/test",
      ),
    ).rejects.toMatchObject({ problem: undefined });
  });
  it("chuẩn hóa lỗi mạng", async () => {
    const { client, fetcher } = setup();
    fetcher.mockRejectedValue(new TypeError("fetch failed"));
    await expect(client.request("/api/v1/test")).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(client.request("/api/v1/test")).rejects.toMatchObject({
      kind: "network",
      status: 0,
    });
  });
  it("truyền AbortSignal và giữ nguyên cancellation", async () => {
    const controller = new AbortController();
    const aborted = new DOMException("Aborted", "AbortError");
    const { client, fetcher } = setup();
    fetcher.mockRejectedValue(aborted);
    controller.abort();
    await expect(
      client.request("/api/v1/test", { signal: controller.signal }),
    ).rejects.toBe(aborted);
    expect(fetcher.mock.calls[0][1]!.signal).toBe(controller.signal);
  });
  it.each([
    "https://evil.test/api/v1/test",
    "//evil.test/api/v1/test",
    "/api/v1/../../../secret",
    "/api/v1/%2e%2e/secret",
    "/api/v1/test#secret",
  ])("chặn đường dẫn ngoài namespace: %s", async (path) => {
    const { client, fetcher } = setup();
    await expect(client.request(path)).rejects.toThrow("Invalid API path");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
