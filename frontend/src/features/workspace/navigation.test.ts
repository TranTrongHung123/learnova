import { describe, expect, it } from "vitest";
import {
  availableWorkspaces,
  canEnterWorkspace,
  isActiveNavigation,
  isWorkspace,
  navigationFor,
  workspaceInfo,
} from "./navigation";
describe("Workspace navigation", () => {
  it("giữ cả hai role nghiệp vụ", () =>
    expect(availableWorkspaces(["CREATOR", "PARTICIPANT"])).toEqual([
      "PARTICIPANT",
      "CREATOR",
    ]));
  it("ADMIN không suy ra role khác", () => {
    expect(availableWorkspaces(["ADMIN"])).toEqual(["ADMIN"]);
    expect(canEnterWorkspace("CREATOR", ["ADMIN"])).toBe(false);
  });
  it("bỏ qua role lạ, trùng và rỗng", () => {
    expect(availableWorkspaces(["UNKNOWN", "CREATOR", "CREATOR"])).toEqual([
      "CREATOR",
    ]);
    expect(availableWorkspaces([])).toEqual([]);
    expect(isWorkspace("creator")).toBe(false);
  });
  it("dashboard chỉ active đúng route gốc", () => {
    expect(isActiveNavigation("/creator", "/creator", "CREATOR")).toBe(true);
    expect(
      isActiveNavigation("/creator/questions", "/creator", "CREATOR"),
    ).toBe(false);
  });
  it("route con dùng segment boundary", () => {
    expect(
      isActiveNavigation(
        "/creator/questions/123",
        "/creator/questions",
        "CREATOR",
      ),
    ).toBe(true);
    expect(
      isActiveNavigation(
        "/creator/questions-new",
        "/creator/questions",
        "CREATOR",
      ),
    ).toBe(false);
  });
  it.each(["PARTICIPANT", "CREATOR", "ADMIN"] as const)(
    "%s không kích hoạt feature chưa có",
    (workspace) => {
      expect(
        navigationFor(workspace).filter((item) => item.available),
      ).toEqual([
        expect.objectContaining({ icon: "dashboard" }),
        ...(workspace === "CREATOR" ? [expect.objectContaining({ icon: "questions", available: true })] : []),
        ...(workspace === "ADMIN" ? [] : [expect.objectContaining({ href: `${workspaceInfo[workspace].href}/classes`, icon: "classes" })]),
        expect.objectContaining({ href: "/profile", icon: "profile" }),
      ]);
    },
  );
});
