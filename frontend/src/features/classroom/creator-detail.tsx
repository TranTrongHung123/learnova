"use client";

import { SessionList } from "@/features/session/session-list";
import { useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { ClassroomForm } from "./classroom-form";
import { ClassroomMembers } from "./members";
import { apiRoot, Confirm, date, ErrorText, panel, QueryState, useClassroomQuery } from "./shared";
import { codeLabels, type ClassroomDetail } from "./types";

export function CreatorClassroomDetail({ classId }: { classId: string }) {
  const { session } = useAuth();
  const query = useClassroomQuery<ClassroomDetail>(`${apiRoot}/${classId}`);
  const [tab, setTab] = useState<"overview" | "members">("overview");
  const [editing, setEditing] = useState(false);
  const [command, setCommand] = useState<"generate" | "revoke">();
  const [notice, setNotice] = useState("");
  const [copyError, setCopyError] = useState("");
  if (!query.data) return <QueryState error={query.error} retry={query.reload} />;
  const c = query.data;
  async function copyCode() {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(c.joinCode.code!);
      setNotice("Đã sao chép mã tham gia.");
    } catch {
      setCopyError("Không thể sao chép tự động. Hãy chọn và sao chép mã bên dưới.");
    }
  }
  return (
    <div className="space-y-6">
      <LinkButton href="/creator/classes" variant="ghost">
        Quay lại danh sách lớp
      </LinkButton>
      <header className="space-y-2">
        <h2 className="text-2xl font-bold [overflow-wrap:anywhere]">{c.name}</h2>
        <p className="text-muted-foreground">{c.activeParticipants} thành viên đang tham gia</p>
      </header>
      {notice && (
        <p role="status" className="text-success">
          {notice}
        </p>
      )}
      <nav aria-label="Nội dung lớp" className="flex flex-wrap gap-2">
        <Button
          aria-pressed={tab === "overview"}
          variant={tab === "overview" ? "primary" : "secondary"}
          onClick={() => setTab("overview")}
        >
          Tổng quan
        </Button>
        <Button
          aria-pressed={tab === "members"}
          variant={tab === "members" ? "primary" : "secondary"}
          onClick={() => setTab("members")}
        >
          Thành viên
        </Button>
      </nav>
      {tab === "members" ? (
        <ClassroomMembers classId={classId} onChanged={query.reload} />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          {editing ? (
            <ClassroomForm
              existing={c}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                setNotice("Đã cập nhật thông tin lớp.");
                query.reload();
              }}
            />
          ) : (
            <section className={`${panel} space-y-4`}>
              <h3 className="text-xl font-bold">Thông tin lớp</h3>
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                {c.description || "Chưa có mô tả."}
              </p>
              <p className="text-sm text-muted-foreground">Tạo ngày {date(c.createdAt)}</p>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Chỉnh sửa lớp
              </Button>
            </section>
          )}
          <section className={`${panel} space-y-4`} aria-label="Mã tham gia">
            <h3 className="text-xl font-bold">Mã tham gia</h3>
            <p>{codeLabels[c.joinCode.status]}</p>
            <p className="text-sm text-muted-foreground">
              Mã mới có hiệu lực 7 ngày. Chỉ chia sẻ cho người bạn muốn mời vào lớp.
            </p>
            {c.joinCode.code && (
              <>
                <code
                  className="block select-all rounded-lg bg-muted p-4 text-lg font-bold tracking-wide [overflow-wrap:anywhere]"
                  data-testid="join-code"
                >
                  {c.joinCode.code}
                </code>
                <Button variant="secondary" onClick={() => void copyCode()}>
                  Sao chép mã
                </Button>
              </>
            )}
            {c.joinCode.expiresAt && (
              <p className="text-sm">Hết hạn: {date(c.joinCode.expiresAt)}</p>
            )}
            <ErrorText message={copyError} />
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setCommand("generate")}>
                {c.joinCode.status === "NOT_CREATED" ? "Tạo mã tham gia" : "Tạo lại mã"}
              </Button>
              {c.joinCode.status === "ACTIVE" && (
                <Button variant="secondary" onClick={() => setCommand("revoke")}>
                  Thu hồi mã
                </Button>
              )}
            </div>
          </section>
        </div>
      )}
      <SessionList classroomId={classId} compact />
      {command && (
        <Confirm
          title={command === "generate" ? "Tạo mã tham gia mới?" : "Thu hồi mã tham gia?"}
          description={
            command === "generate"
              ? "Mã hiện tại (nếu có) sẽ mất hiệu lực. Mã mới dùng được trong 7 ngày; thành viên hiện tại không bị ảnh hưởng."
              : "Mã hiện tại sẽ không thể dùng để tham gia lớp. Thành viên hiện tại không bị ảnh hưởng."
          }
          confirmLabel={command === "generate" ? "Xác nhận tạo mã" : "Xác nhận thu hồi"}
          action={() =>
            session.api.request(`${apiRoot}/${classId}/join-code`, {
              method: command === "generate" ? "POST" : "DELETE",
            })
          }
          onFailed={query.reload}
          onClose={() => setCommand(undefined)}
          onDone={() => {
            setNotice(
              command === "generate" ? "Đã tạo mã tham gia mới." : "Đã thu hồi mã tham gia.",
            );
            query.reload();
          }}
        />
      )}
    </div>
  );
}
