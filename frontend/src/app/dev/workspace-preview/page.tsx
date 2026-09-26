import { notFound } from "next/navigation";

export default async function WorkspacePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const { WorkspacePreview } = await import("./preview");
  return <WorkspacePreview />;
}
