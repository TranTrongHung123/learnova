"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  ScrollText,
  Settings2,
  ShieldCheck,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  availableWorkspaces,
  isActiveNavigation,
  navigationFor,
  workspaceInfo,
  type Workspace,
} from "./navigation";

const icons = {
  dashboard: LayoutDashboard,
  exam: BookOpen,
  results: ChartNoAxesCombined,
  classes: Users,
  questions: FileQuestion,
  sessions: ClipboardList,
  monitor: Monitor,
  reports: ChartNoAxesCombined,
  users: Users,
  audit: ScrollText,
  notifications: Bell,
  profile: UserRound,
};

type ShellProps = {
  workspace: Workspace;
  roles: readonly string[];
  user: { displayName: string; subtitle?: string; avatarUrl?: string | null };
  pathname: string;
  children: ReactNode;
  onWorkspaceChange: (workspace: Workspace) => void;
  onLogout: () => void;
  onLogoutAll?: () => void;
  hrefFor?: (href: string) => string;
  notificationBell?: ReactNode;
};

export function WorkspaceShell({
  workspace,
  roles,
  user,
  pathname,
  children,
  onWorkspaceChange,
  onLogout,
  onLogoutAll,
  hrefFor = (href) => href,
  notificationBell,
}: ShellProps) {
  const drawer = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuRoot = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const allowed = availableWorkspaces(roles);
  const info = workspaceInfo[workspace];
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeAtDesktop = () => {
      if (media.matches) drawer.current?.close();
    };
    media.addEventListener("change", closeAtDesktop);
    return () => media.removeEventListener("change", closeAtDesktop);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => {
      if (!menuRoot.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menuOpen]);
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  function navigation() {
    return (
      <nav aria-label={`Điều hướng ${info.label}`} className="space-y-1">
        {navigationFor(workspace).map((item) => {
          const Icon = icons[item.icon];
          const active = !!item.href && isActiveNavigation(pathname, item.href, workspace);
          const content = (
            <>
              <Icon size={19} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 flex-1">{item.label}</span>
              {!item.available && <span className="text-[11px] font-normal">Sắp có</span>}
            </>
          );
          const className = `flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm ${active ? "bg-muted font-semibold text-primary" : "text-muted-foreground"}`;
          return item.available && item.href ? (
            <Link
              key={item.icon}
              href={hrefFor(item.href)}
              aria-current={active ? "page" : undefined}
              className={`${className} hover:bg-muted`}
              onClick={() => {
                drawer.current?.close();
                setMenuOpen(false);
              }}
            >
              {content}
            </Link>
          ) : (
            <button
              key={item.icon}
              type="button"
              disabled
              className={`${className} cursor-not-allowed`}
            >
              {content}
            </button>
          );
        })}
      </nav>
    );
  }
  const brand = (
    <Link href="/" className="flex min-h-11 items-center gap-3 text-xl font-extrabold">
      <span className="rounded-lg bg-primary p-2 text-on-primary">
        <GraduationCap aria-hidden="true" size={25} />
      </span>
      Learnova<span className="sr-only"> — Trang chủ</span>
    </Link>
  );
  return (
    <div className="min-h-dvh lg:pl-[var(--sidebar-width)]">
      <aside className="fixed inset-y-0 left-0 hidden w-[var(--sidebar-width)] flex-col overflow-y-auto border-r border-border bg-surface px-5 py-6 lg:flex">
        {brand}
        <p className="mt-10 mb-3 px-3 text-xs font-semibold tracking-wider text-muted-foreground">
          KHÔNG GIAN LÀM VIỆC
        </p>
        {navigation()}
        <div className="mt-auto pt-8">
          <div className="rounded-xl border border-border p-4">
            <ShieldCheck size={20} className="mb-2 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold">Tập trung vào đánh giá</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Rõ ràng trong từng bước, từ đề thi đến kết quả.
            </p>
          </div>
        </div>
      </aside>
      <dialog
        ref={drawer}
        className="drawer"
        aria-labelledby="drawer-title"
        onClose={() => {
          setDrawerOpen(false);
          if (trigger.current?.getClientRects().length) trigger.current.focus();
        }}
        onClick={(event) => {
          if (
            event.target === event.currentTarget &&
            event.clientX > event.currentTarget.getBoundingClientRect().right
          )
            event.currentTarget.close();
        }}
      >
        <div className="mb-6 flex items-center justify-between gap-2">
          <h2 id="drawer-title" className="text-lg font-bold">
            Điều hướng
          </h2>
          <Button
            variant="ghost"
            aria-label="Đóng điều hướng"
            onClick={() => drawer.current?.close()}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        {navigation()}
      </dialog>
      <header className="relative z-20 flex min-h-[var(--header-height)] flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            ref={trigger}
            type="button"
            aria-label="Mở điều hướng"
            aria-expanded={drawerOpen}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-muted lg:hidden"
            onClick={() => {
              drawer.current?.showModal();
              setDrawerOpen(true);
            }}
          >
            <Menu aria-hidden="true" />
          </button>
          {allowed.length > 1 ? (
            <div>
              <label htmlFor="workspace-switcher" className="block text-xs text-muted-foreground">
                Không gian làm việc
              </label>
              <select
                id="workspace-switcher"
                value={workspace}
                className="min-h-11 max-w-full rounded-lg border border-control-border bg-surface px-3 text-sm font-semibold"
                onChange={(event) => {
                  const target = allowed.find((value) => value === event.target.value);
                  if (target) {
                    drawer.current?.close();
                    setMenuOpen(false);
                    onWorkspaceChange(target);
                  }
                }}
              >
                {allowed.map((value) => (
                  <option key={value} value={value}>
                    {workspaceInfo[value].label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground">Không gian làm việc</p>
              <p className="font-semibold">{info.label}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {notificationBell}
          <div
            ref={menuRoot}
            className="relative"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && menuOpen) {
                setMenuOpen(false);
                menuTrigger.current?.focus();
                event.stopPropagation();
              }
            }}
          >
            <button
              ref={menuTrigger}
              type="button"
              aria-expanded={menuOpen}
              aria-controls="user-menu"
              className="flex min-h-11 max-w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
              onClick={() => setMenuOpen((value) => !value)}
            >
              <Avatar name={user.displayName} url={user.avatarUrl} />
              <span className="hidden max-w-48 text-left sm:block">
                <span className="block break-words text-sm font-semibold">{user.displayName}</span>
                {user.subtitle && (
                  <span className="block text-xs text-muted-foreground">{user.subtitle}</span>
                )}
              </span>
              <span className="sr-only">Menu người dùng</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div
                id="user-menu"
                className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-surface p-2 shadow-lg"
              >
                <p className="break-words px-3 py-2 text-sm font-semibold">{user.displayName}</p>
                <Link
                  href={hrefFor("/profile")}
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground"
                >
                  <Settings2 size={16} aria-hidden="true" />
                  Hồ sơ
                </Link>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                >
                  <LogOut size={16} aria-hidden="true" />
                  Đăng xuất
                </Button>
                {onLogoutAll && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setMenuOpen(false);
                      menuTrigger.current?.focus();
                      onLogoutAll();
                    }}
                  >
                    Đăng xuất tất cả thiết bị
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10"
      >
        {children}
      </main>
    </div>
  );
}
