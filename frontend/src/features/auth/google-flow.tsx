"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "./auth-provider";
import { authMessage, type GoogleFlow } from "./session";
import { resolveWorkspace } from "./workspace-resolution";

const callbackErrors: Record<string, string> = {
  GOOGLE_UNAVAILABLE: "Đăng nhập Google chưa được cấu hình. Bạn có thể dùng tài khoản Local.",
  GOOGLE_AUTH_FAILED: "Đăng nhập Google bị hủy, hết hạn hoặc không hợp lệ. Vui lòng thử lại.",
  GOOGLE_EMAIL_UNVERIFIED: "Google chưa xác minh email này. Vui lòng sử dụng email đã xác minh.",
  GOOGLE_IDENTITY_INVALID: "Không thể xác minh tài khoản Google. Vui lòng thử lại.",
  GOOGLE_IDENTITY_CONFLICT:
    "Tài khoản này đã có phương thức đăng nhập khác. Vui lòng đăng nhập bằng phương thức đã liên kết.",
  ACCOUNT_LOCKED: "Tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên.",
  ACCOUNT_DISABLED: "Tài khoản đã ngừng hoạt động.",
  SERVICE_UNAVAILABLE: "Dịch vụ đăng nhập tạm thời không khả dụng. Vui lòng thử lại sau.",
};

export function GoogleAuthFlow({ page }: { page: "callback" | "roles" | "link" }) {
  const { session } = useAuth();
  const router = useRouter();
  const [flow, setFlow] = useState<GoogleFlow | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const routeFlow = useCallback(
    (value: GoogleFlow | null) => {
      if (!value) {
        const user = session.getSnapshot().user;
        if (user) router.replace(resolveWorkspace(user));
        return;
      }
      const target = value.state === "ONBOARDING" ? "roles" : "link";
      if (target !== page)
        router.replace(target === "roles" ? "/onboarding/roles" : "/auth/link-account");
      else setFlow(value);
    },
    [page, router, session],
  );
  useEffect(() => {
    let active = true;
    const code = new URLSearchParams(window.location.search).get("error");
    async function load() {
      try {
        if (page === "callback" && code) {
          if (active) setError(callbackErrors[code] ?? callbackErrors.GOOGLE_AUTH_FAILED);
          return;
        }
        const value = await session.resolveGoogleCallback();
        if (active) routeFlow(value);
      } catch (cause) {
        if (active) setError(authMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [page, session, routeFlow, attempt]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (flow) titleRef.current?.focus();
  }, [flow]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flow || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    if (flow.state === "LINK_REQUIRED" && !password) {
      setPasswordError("Nhập mật khẩu tài khoản Local.");
      setError("Vui lòng nhập mật khẩu để xác minh.");
      return;
    }
    setBusy(true);
    setError("");
    setPasswordError("");
    try {
      if (flow.state === "LINK_REQUIRED") {
        await session.googleAction("link/verify", { password });
        form.reset();
        routeFlow(await session.googleFlow());
      } else {
        const purpose = data.get("purpose");
        await session.googleAction(
          flow.state === "ONBOARDING" ? "onboarding" : "link/confirm",
          flow.state === "ONBOARDING"
            ? { roles: purpose === "BOTH" ? ["PARTICIPANT", "CREATOR"] : [purpose] }
            : undefined,
        );
        routeFlow(null);
      }
    } catch (cause) {
      setError(authMessage(cause));
      if (flow.state === "LINK_REQUIRED") setPasswordError(authMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    setError("");
    try {
      await session.googleAction("cancel");
      router.replace("/login");
    } catch (cause) {
      setError(authMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  const title =
    flow?.state === "ONBOARDING"
      ? "Bạn muốn dùng Learnova để làm gì?"
      : flow?.state === "LINK_CONFIRMATION"
        ? "Xác nhận liên kết Google"
        : flow?.state === "LINK_REQUIRED"
          ? "Liên kết tài khoản đã có"
          : "Đăng nhập với Google";
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-10 sm:px-6"
    >
      <section
        className="rounded-xl border border-border bg-surface p-6 sm:p-8"
        aria-labelledby="google-title"
        aria-busy={busy || loading}
      >
        <h1 ref={titleRef} tabIndex={-1} id="google-title" className="text-3xl font-bold">
          {title}
        </h1>
        {loading && (
          <p role="status" className="mt-5">
            Đang kiểm tra đăng nhập Google…
          </p>
        )}
        {error && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="mt-5 rounded-lg border border-danger p-3 text-danger"
          >
            <p>{error}</p>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setLoading(true);
                setError("");
                setAttempt(attempt + 1);
              }}
            >
              Tải lại trạng thái
            </Button>
          </div>
        )}
        {flow && !loading && (
          <form onSubmit={submit} className="mt-5 space-y-5" noValidate>
            <p className="break-words text-muted-foreground">
              Tài khoản: <strong className="text-foreground">{flow.email}</strong>
            </p>
            {flow.state === "ONBOARDING" ? (
              <fieldset className="space-y-3" disabled={busy}>
                <legend className="mb-3">Chọn vai trò của bạn</legend>
                {[
                  ["PARTICIPANT", "Làm bài kiểm tra"],
                  ["CREATOR", "Tạo và tổ chức bài kiểm tra"],
                  ["BOTH", "Cả hai"],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-control-border px-3 py-2"
                  >
                    <input
                      type="radio"
                      name="purpose"
                      value={value}
                      defaultChecked={value === "PARTICIPANT"}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            ) : flow.state === "LINK_REQUIRED" ? (
              <>
                <p>
                  Email này đã có tài khoản Local. Nhập mật khẩu của tài khoản đó để xác minh trước
                  khi liên kết Google.
                </p>
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={flow.email}
                  readOnly
                  hidden
                />
                <Input
                  id="link-password"
                  name="password"
                  label="Mật khẩu tài khoản Local"
                  type="password"
                  autoComplete="current-password"
                  maxLength={256}
                  required
                  disabled={busy}
                  error={passwordError}
                />
              </>
            ) : (
              <p>
                Đã xác minh tài khoản Local. Sau khi liên kết, bạn có thể đăng nhập cùng tài khoản
                Learnova bằng Google hoặc mật khẩu hiện có.
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? "Đang xử lý…"
                : flow.state === "ONBOARDING"
                  ? "Hoàn tất và tiếp tục"
                  : flow.state === "LINK_REQUIRED"
                    ? "Xác minh tài khoản"
                    : "Xác nhận liên kết Google"}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void cancel()}>
              Hủy và về đăng nhập
            </Button>
          </form>
        )}
        {!loading && !flow && (
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => window.location.assign(session.googleUrl)}>
              Đăng nhập Google lại
            </Button>
            <LinkButton variant="secondary" href="/login">
              Về đăng nhập
            </LinkButton>
          </div>
        )}
      </section>
    </main>
  );
}
