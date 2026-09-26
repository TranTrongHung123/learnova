"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, LayoutTemplate } from "lucide-react";
import { WorkspaceShell } from "@/features/workspace/workspace-shell";
import {
  canEnterWorkspace,
  isWorkspace,
  workspaceInfo,
  type Workspace,
} from "@/features/workspace/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PageState,
  Skeleton,
  type PageStateKind,
} from "@/components/ui/page-state";

const fixtures: Record<string, Workspace[]> = {
  multi: ["PARTICIPANT", "CREATOR"],
  participant: ["PARTICIPANT"],
  creator: ["CREATOR"],
  admin: ["ADMIN"],
  all: ["PARTICIPANT", "CREATOR", "ADMIN"],
};
const stateOptions = {
  unavailable: "Chưa sẵn sàng",
  loading: "Đang tải",
  empty: "Trống",
  validation: "Validation",
  forbidden: "Không có quyền",
  "not-found": "Không tìm thấy",
  network: "Lỗi mạng",
  error: "Lỗi hiển thị",
};
export function WorkspacePreview() {
  const search = useSearchParams();
  const router = useRouter();
  const [loggedOut, setLoggedOut] = useState(false);
  const [validationError, setValidationError] = useState("");
  const roleSet = search.get("roles") ?? "multi";
  const roles = Object.hasOwn(fixtures, roleSet)
    ? fixtures[roleSet]
    : fixtures.multi;
  const requested = search.get("workspace") ?? "CREATOR";
  const allowed = isWorkspace(requested) && canEnterWorkspace(requested, roles);
  const workspace = allowed ? requested : roles[0];
  const state = search.get("state") ?? "unavailable";
  const knownState = Object.hasOwn(stateOptions, state)
    ? (state as keyof typeof stateOptions)
    : "unavailable";
  function update(values: Record<string, string>) {
    const params = new URLSearchParams(search.toString());
    Object.entries(values).forEach(([key, value]) => params.set(key, value));
    router.push(`/dev/workspace-preview?${params}`, { scroll: false });
  }
  function previewHref() {
    return `/dev/workspace-preview?${search.toString()}`;
  }
  function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("title");
    setValidationError(
      typeof value === "string" && value.trim()
        ? ""
        : "Vui lòng nhập tên để kiểm tra trạng thái validation.",
    );
    if (!value || !String(value).trim())
      event.currentTarget.querySelector("input")?.focus();
  }
  if (loggedOut)
    return (
      <main
        id="main-content"
        className="mx-auto max-w-3xl space-y-6 px-6 py-16"
      >
        <Badge>Bản xem trước</Badge>
        <h1 className="text-2xl font-bold">Đã thoát phiên minh họa</h1>
        <p>
          Không có phiên đăng nhập thật hoặc token nào được tạo hay thu hồi.
        </p>
        <Button onClick={() => setLoggedOut(false)}>
          Quay lại bản xem trước
        </Button>
      </main>
    );
  return (
    <WorkspaceShell
      workspace={workspace}
      roles={roles}
      pathname={workspaceInfo[workspace].href}
      user={{
        displayName: "Tài khoản minh họa",
        subtitle: "Không phải phiên đăng nhập",
      }}
      onWorkspaceChange={(value) => update({ workspace: value })}
      onLogout={() => setLoggedOut(true)}
      hrefFor={previewHref}
    >
      <section
        aria-label="Điều khiển bản xem trước"
        className="rounded-xl border border-border bg-surface p-4"
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge>Bản xem trước · Development</Badge>
          <p className="text-sm text-muted-foreground">
            Chỉ kiểm tra giao diện. Không có dữ liệu hoặc quyền thật.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="text-sm font-semibold">
            Tập role
            <select
              aria-label="Tập role"
              value={Object.hasOwn(fixtures, roleSet) ? roleSet : "multi"}
              className="mt-1 block min-h-11 rounded-lg border border-control-border bg-surface px-3"
              onChange={(event) =>
                update({
                  roles: event.target.value,
                  workspace: fixtures[event.target.value][0],
                })
              }
            >
              <option value="multi">PARTICIPANT + CREATOR</option>
              <option value="participant">PARTICIPANT</option>
              <option value="creator">CREATOR</option>
              <option value="admin">ADMIN</option>
              <option value="all">Cả ba role</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Trạng thái UI
            <select
              aria-label="Trạng thái UI"
              value={knownState}
              className="mt-1 block min-h-11 rounded-lg border border-control-border bg-surface px-3"
              onChange={(event) => update({ state: event.target.value })}
            >
              {Object.entries(stateOptions).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <div>
        <p className="mb-2 text-sm font-semibold text-primary">
          {workspaceInfo[workspace].label}
        </p>
        <h1 className="text-3xl font-bold">Không gian của bạn</h1>
        <p className="mt-3 text-muted-foreground">
          {workspaceInfo[workspace].description}
        </p>
      </div>
      {!allowed ? (
        <PageState kind="forbidden" />
      ) : knownState === "loading" ? (
        <Skeleton />
      ) : knownState === "validation" ? (
        <form
          noValidate
          onSubmit={validate}
          className="max-w-xl space-y-5 rounded-xl border border-border bg-surface p-6"
        >
          <h2 className="text-lg font-bold">Minh họa validation</h2>
          <Input
            id="preview-title"
            name="title"
            label="Tên minh họa"
            required
            hint="Biểu mẫu này không gửi dữ liệu lên máy chủ."
            error={validationError}
          />
          <Button type="submit">Kiểm tra thông tin</Button>
        </form>
      ) : (
        <PageState
          kind={knownState as PageStateKind}
          action={
            knownState === "network" || knownState === "error" ? (
              <Button onClick={() => update({ state: "loading" })}>
                Thử lại (minh họa)
              </Button>
            ) : (
              <LinkButton variant="secondary" href="/">
                Về trang chủ <ArrowRight size={16} aria-hidden="true" />
              </LinkButton>
            )
          }
        />
      )}
      <div className="flex items-start gap-3 text-sm text-muted-foreground">
        <LayoutTemplate
          className="mt-1 shrink-0"
          size={20}
          aria-hidden="true"
        />
        <p>
          Giao diện nền tảng cho việc soạn đề, tổ chức kỳ thi và theo dõi kết
          quả. Nội dung nghiệp vụ sẽ được kết nối khi từng tính năng sẵn sàng.
        </p>
      </div>
    </WorkspaceShell>
  );
}
