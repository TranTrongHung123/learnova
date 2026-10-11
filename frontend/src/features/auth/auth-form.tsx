"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, GraduationCap, ShieldCheck, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "./auth-provider";
import { authMessage } from "./session";
import { resolveWorkspace } from "./workspace-resolution";
import { GoogleButton } from "./google-button";
import type { Workspace } from "@/features/workspace/navigation";

export function AuthForm({
  register = false,
  registered = false,
}: {
  register?: boolean;
  registered?: boolean;
}) {
  const { session, status, user, error: bootstrapError } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status === "AUTHENTICATED" && user)
      router.replace(
        resolveWorkspace(user, new URLSearchParams(window.location.search).get("returnTo")),
      );
  }, [router, status, user]);
  useEffect(() => {
    if (error) summary.current?.focus();
  }, [error, fields]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const displayName = String(data.get("displayName") ?? "").trim();
    const errors: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Nhập email hợp lệ.";
    if (!password) errors.password = "Nhập mật khẩu.";
    if (register) {
      if (!displayName) errors.displayName = "Nhập tên hiển thị.";
      if ([...password].length < 12 || [...password].length > 128)
        errors.password = "Mật khẩu cần từ 12 đến 128 ký tự.";
      if (password !== data.get("confirmPassword"))
        errors.confirmPassword = "Mật khẩu xác nhận chưa khớp.";
    }
    setFields(errors);
    if (Object.keys(errors).length) {
      setError("Vui lòng kiểm tra các trường bên dưới.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      if (register) {
        const purpose = data.get("purpose");
        const roles: Workspace[] =
          purpose === "BOTH"
            ? ["PARTICIPANT", "CREATOR"]
            : [purpose === "CREATOR" ? "CREATOR" : "PARTICIPANT"];
        await session.register({ email, password, displayName, roles });
        router.replace("/login?registered=1");
      } else await session.login(email, password);
    } catch (cause) {
      setError(authMessage(cause));
      if (cause instanceof ApiError)
        setFields(
          Object.fromEntries(
            (cause.problem?.fieldErrors ?? []).map((field) => [
              field.field,
              "Vui lòng kiểm tra giá trị này.",
            ]),
          ),
        );
    } finally {
      setBusy(false);
    }
  }
  const waiting = status === "BOOTSTRAPPING" || status === "AUTHENTICATED";
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto grid min-h-dvh w-full max-w-6xl content-center items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:py-12"
    >
      <div className="min-w-0">
        <Link
          href="/"
          className="flex min-h-11 items-center justify-center gap-3 text-2xl font-extrabold tracking-tight lg:justify-start"
        >
          <span className="rounded-xl bg-primary p-2 text-on-primary">
            <GraduationCap size={28} aria-hidden="true" />
          </span>
          <span>
            Learnova<span className="text-primary">.</span>
          </span>
        </Link>
        <div className="mt-12 hidden lg:block">
          <p className="text-xs font-bold tracking-wider text-primary">
            MỖI BÀI KIỂM TRA, MỘT BƯỚC TIẾN
          </p>
          <p className="mt-5 text-4xl leading-tight font-extrabold tracking-tight">
            Không gian của bạn
            <br />
            <span className="text-primary">Sẵn sàng cho kỳ thi tiếp theo</span>
          </p>
          <p className="mt-5 max-w-md text-lg leading-8 text-muted-foreground">
            Tạo bài kiểm tra, tham gia kỳ thi và theo dõi kết quả — tất cả bắt đầu từ đây
          </p>
          <ul className="mt-9 space-y-5">
            {[
              { icon: BookOpen, text: "Soạn câu hỏi và tổ chức kỳ thi" },
              { icon: ShieldCheck, text: "Lưu bài tự động, tiếp tục sau khi tải lại" },
              { icon: Users, text: "Linh hoạt chuyển giữa tạo đề và làm bài" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm font-medium">
                <span className="rounded-lg border border-border bg-surface p-2 text-primary">
                  <Icon size={19} aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <Link
            href="/"
            className="mt-9 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
          >
            Khám phá Learnova <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <section
        className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-9"
        aria-labelledby="auth-title"
      >
        <h1 id="auth-title" className="text-3xl font-bold">
          {register ? "Tạo tài khoản" : "Đăng nhập"}
        </h1>
        <p className="mt-2 mb-6 text-muted-foreground">
          {register
            ? "Chọn cách bạn muốn sử dụng Learnova"
            : "Đăng nhập để tiếp tục"}
        </p>
        {registered && !register && (
          <p role="status" className="mb-4 text-success">
            Đăng ký thành công. Bạn có thể đăng nhập.
          </p>
        )}
        {status === "ERROR" && (
          <div role="alert" className="mb-4 text-danger">
            <p>{bootstrapError}</p>
            <Button variant="secondary" onClick={() => void session.bootstrap()}>
              Thử khôi phục phiên lại
            </Button>
          </div>
        )}
        {waiting ? (
          <p role="status">Đang kiểm tra phiên đăng nhập…</p>
        ) : (
          <>
            {error && (
              <div
                ref={summary}
                tabIndex={-1}
                role="alert"
                className="mb-5 rounded-lg border border-danger p-3 text-danger"
              >
                <p>{error}</p>
                {Object.entries(fields).map(([field, message]) => (
                  <a className="mt-1 block underline" key={field} href={`#${field}`}>
                    {message}
                  </a>
                ))}
              </div>
            )}
            <form noValidate onSubmit={submit} className="space-y-5" aria-busy={busy}>
              {register && (
                <Input
                  id="displayName"
                  name="displayName"
                  label="Tên hiển thị"
                  autoComplete="name"
                  maxLength={100}
                  required
                  error={fields.displayName}
                />
              )}
              <Input
                id="email"
                name="email"
                label="Email"
                type="email"
                autoComplete="username"
                maxLength={254}
                required
                error={fields.email}
              />
              <Input
                id="password"
                name="password"
                label="Mật khẩu"
                type={visible ? "text" : "password"}
                autoComplete={register ? "new-password" : "current-password"}
                maxLength={256}
                required
                error={fields.password}
                hint={
                  register ? "12–128 ký tự. Có thể dùng dấu cách và tiếng Việt." : undefined
                }
              />
              <Button
                variant="ghost"
                onClick={() => setVisible(!visible)}
                aria-pressed={visible}
              >
                {visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              </Button>
              {register && (
                <>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    label="Xác nhận mật khẩu"
                    type={visible ? "text" : "password"}
                    autoComplete="new-password"
                    maxLength={256}
                    required
                    error={fields.confirmPassword}
                  />
                  <fieldset className="space-y-2">
                    <legend className="mb-2 font-semibold">
                      Bạn muốn sử dụng Learnova để làm gì?
                    </legend>
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
                    {fields.roles && <p className="text-danger">{fields.roles}</p>}
                  </fieldset>
                </>
              )}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập"}
              </Button>
            </form>
            <GoogleButton />
            <p className="mt-6 text-sm text-muted-foreground">
              {register ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
              <Link
                className="font-semibold text-primary underline"
                href={register ? "/login" : "/register"}
              >
                {register ? "Đăng nhập" : "Tạo tài khoản"}
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
