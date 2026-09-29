"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { PageState, Skeleton } from "@/components/ui/page-state";
import { ProtectedWorkspace } from "@/features/auth/protected-workspace";
import { useAuth } from "@/features/auth/auth-provider";
import { authMessage, type Profile } from "@/features/auth/session";
import { ApiError } from "@/lib/api/client";

type Errors = Record<string, string>;
const panel = "rounded-xl border border-border bg-surface p-5 sm:p-6";

export function ProfileScreen() {
  return <ProtectedWorkspace title="Hồ sơ">{({ logoutAll }) => <ProfileContent logoutAll={logoutAll} />}</ProtectedWorkspace>;
}

function ProfileContent({ logoutAll }: { logoutAll: () => void }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [revision, reload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    session.getProfile(controller.signal).then(setProfile).catch((cause) => {
      if (!controller.signal.aborted) {
        setError(authMessage(cause));
        setForbidden(cause instanceof ApiError && cause.status === 403);
      }
    });
    return () => controller.abort();
  }, [session, revision]);
  if (error) return <PageState kind={forbidden ? "forbidden" : "network"} description={error} action={<Button onClick={() => { setError(""); reload(revision + 1); }}>Thử tải lại</Button>} />;
  if (!profile) return <Skeleton />;
  return <div className="space-y-6">
    <p className="text-muted-foreground">Quản lý thông tin cá nhân và bảo vệ tài khoản Learnova của bạn.</p>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <PersonalInformation profile={profile} onSaved={setProfile} />
      <div className="min-w-0 space-y-6">
        <section className={panel} aria-labelledby="roles-title">
          <h2 id="roles-title" className="text-xl font-bold">Vai trò</h2>
          <div className="my-4 flex flex-wrap gap-2">{profile.roles.map((role) => <span key={role} className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-primary">{role}</span>)}</div>
          <p className="text-sm text-muted-foreground">Vai trò được quản lý bởi hệ thống. Bạn có thể chuyển không gian làm việc từ thanh điều hướng.</p>
        </section>
        <section className={panel} aria-labelledby="security-title">
          <h2 id="security-title" className="flex items-center gap-2 text-xl font-bold"><ShieldCheck size={22} aria-hidden="true" />Bảo mật</h2>
          {profile.hasLocalIdentity ? <PasswordForm /> : <p className="mt-4 text-muted-foreground">Bạn đăng nhập bằng Google. Tài khoản này chưa hỗ trợ đổi mật khẩu tại Learnova.</p>}
          <div className="mt-6 space-y-3 border-t border-border pt-6">
            <h3 className="font-semibold">Phiên đăng nhập</h3>
            <p className="text-sm text-muted-foreground">Đăng xuất tất cả thiết bị, bao gồm phiên bạn đang sử dụng.</p>
            <Button variant="secondary" onClick={logoutAll}>Đăng xuất tất cả thiết bị</Button>
          </div>
        </section>
      </div>
    </div>
  </div>;
}

function ErrorSummary({ errors, message, prefix }: { errors: Errors; message: string; prefix: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (message || Object.keys(errors).length) ref.current?.focus(); }, [errors, message]);
  if (!message && !Object.keys(errors).length) return null;
  return <div ref={ref} role="alert" tabIndex={-1} className="rounded-lg border border-danger p-3 text-sm text-danger">
    <p className="font-semibold">{message || "Vui lòng kiểm tra thông tin đã nhập."}</p>
    {Object.entries(errors).map(([field, text]) => <a key={field} href={`#${prefix}-${field}`} className="mt-2 block underline">{text}</a>)}
  </div>;
}

function fieldsFrom(cause: unknown): Errors {
  if (!(cause instanceof ApiError)) return {};
  return Object.fromEntries((cause.problem?.fieldErrors ?? []).map(({ field }) => [field,
    field === "currentPassword" ? "Mật khẩu hiện tại chưa đúng." : field === "newPassword" ? "Mật khẩu mới cần từ 12 đến 128 ký tự." : field === "avatarUrl" ? "Nhập URL HTTPS hợp lệ, không chứa thông tin đăng nhập." : "Tên hiển thị cần từ 1 đến 100 ký tự."]));
}

function PersonalInformation({ profile, onSaved }: { profile: Profile; onSaved: (value: Profile) => void }) {
  const { session } = useAuth();
  const [name, setName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState(profile.avatarUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const dirty = name !== profile.displayName || avatar !== (profile.avatarUrl ?? "");
  async function save(event: FormEvent) {
    event.preventDefault();
    setSuccess(false); setMessage("");
    const invalid: Errors = {};
    if (!name.trim() || Array.from(name.trim()).length > 100) invalid.displayName = "Tên hiển thị cần từ 1 đến 100 ký tự.";
    if (avatar.trim()) {
      try {
        const url = new URL(avatar.trim());
        if (url.protocol !== "https:" || !url.hostname || url.username || url.password || avatar.trim().length > 2048) throw new Error();
      } catch { invalid.avatarUrl = "Nhập URL HTTPS hợp lệ, không chứa thông tin đăng nhập."; }
    }
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    setBusy(true);
    try {
      const updated = await session.saveProfile({ displayName: name.trim(), avatarUrl: avatar.trim() || null });
      onSaved(updated); setName(updated.displayName); setAvatar(updated.avatarUrl ?? ""); setSuccess(true);
    } catch (cause) { setErrors(fieldsFrom(cause)); setMessage(authMessage(cause)); }
    finally { setBusy(false); }
  }
  return <section className={`${panel} min-w-0`} aria-labelledby="personal-title">
    <h2 id="personal-title" className="flex items-center gap-2 text-xl font-bold"><UserRound size={22} aria-hidden="true" />Thông tin cá nhân</h2>
    <div className="my-6 flex items-center gap-4"><Avatar name={profile.displayName} url={profile.avatarUrl} large /><div className="min-w-0"><p className="break-words font-semibold">{profile.displayName}</p><p className="text-sm text-muted-foreground">{profile.status}</p></div></div>
    <dl className="mb-6 space-y-3 text-sm">
      <div><dt className="text-muted-foreground">Email</dt><dd className="wrap-anywhere font-medium">{profile.email}</dd></div>
      <div><dt className="text-muted-foreground">ID tài khoản</dt><dd className="wrap-anywhere">{profile.id}</dd></div>
      <div><dt className="text-muted-foreground">Ngày tạo</dt><dd>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(profile.createdAt))}</dd></div>
    </dl>
    <form onSubmit={save} noValidate className="space-y-5" aria-label="Sửa hồ sơ" aria-busy={busy}>
      <ErrorSummary errors={errors} message={message} prefix="profile" />
      <Input id="profile-displayName" label="Tên hiển thị" autoComplete="name" required value={name} disabled={busy} error={errors.displayName} onChange={(event) => { setName(event.target.value); setSuccess(false); }} />
      <Input id="profile-avatarUrl" label="URL ảnh đại diện" type="url" hint="Dùng đường dẫn HTTPS. Để trống để dùng chữ cái tên của bạn." value={avatar} disabled={busy} error={errors.avatarUrl} onChange={(event) => { setAvatar(event.target.value); setSuccess(false); }} />
      <p className="text-sm text-muted-foreground">Email, vai trò và trạng thái không thể chỉnh sửa tại đây.</p>
      <Button type="submit" disabled={busy || !dirty}>{busy ? "Đang lưu…" : "Lưu hồ sơ"}</Button>
      {success && <p role="status" className="text-sm text-success">Đã lưu hồ sơ.</p>}
    </form>
  </section>;
}

function PasswordForm() {
  const { session } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  async function change(event: FormEvent) {
    event.preventDefault(); setSuccess(false); setMessage("");
    const invalid: Errors = {};
    if (!current) invalid.currentPassword = "Nhập mật khẩu hiện tại.";
    if (Array.from(next).length < 12 || Array.from(next).length > 128) invalid.newPassword = "Mật khẩu mới cần từ 12 đến 128 ký tự.";
    if (confirm !== next) invalid.confirm = "Mật khẩu xác nhận chưa khớp.";
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    setBusy(true);
    try {
      await session.changePassword({ currentPassword: current, newPassword: next });
      setCurrent(""); setNext(""); setConfirm(""); setSuccess(true);
    } catch (cause) {
      setErrors(fieldsFrom(cause));
      setMessage(cause instanceof ApiError && cause.kind !== "http"
        ? "Chưa xác nhận được kết quả đổi mật khẩu. Nếu mật khẩu cũ không còn đúng, hãy đăng nhập bằng mật khẩu mới."
        : authMessage(cause));
    } finally { setBusy(false); }
  }
  return <form onSubmit={change} noValidate className="mt-5 space-y-4" aria-label="Đổi mật khẩu" aria-busy={busy}>
    <h3 className="font-semibold">Đổi mật khẩu</h3>
    <p className="text-sm text-muted-foreground">Giữ phiên hiện tại và thu hồi quyền gia hạn của các phiên khác. Phiên truy cập đã cấp có thể còn hiệu lực tối đa 15 phút.</p>
    <ErrorSummary errors={errors} message={message} prefix="password" />
    <Input id="password-currentPassword" label="Mật khẩu hiện tại" type="password" autoComplete="current-password" required value={current} disabled={busy} error={errors.currentPassword} onChange={(event) => { setCurrent(event.target.value); setSuccess(false); }} />
    <Input id="password-newPassword" label="Mật khẩu mới" type="password" autoComplete="new-password" required hint="Từ 12 đến 128 ký tự, có thể dùng dấu cách và Unicode." value={next} disabled={busy} error={errors.newPassword} onChange={(event) => { setNext(event.target.value); setSuccess(false); }} />
    <Input id="password-confirm" label="Xác nhận mật khẩu mới" type="password" autoComplete="new-password" required value={confirm} disabled={busy} error={errors.confirm} onChange={(event) => { setConfirm(event.target.value); setSuccess(false); }} />
    <Button variant="secondary" type="submit" disabled={busy}>{busy ? "Đang đổi mật khẩu…" : "Đổi mật khẩu"}</Button>
    {success && <p role="status" className="text-sm text-success">Đã đổi mật khẩu và thu hồi các phiên khác. Phiên hiện tại được giữ lại.</p>}
  </form>;
}
