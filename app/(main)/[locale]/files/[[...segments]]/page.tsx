import { FilesApp } from "@/components/files/files-app";

// Files permalinks (#733): /files/<folder>/<subfolder>, one path segment per
// level, with ?preview=<name> to open a file straight into the preview modal.
export default async function FilesRoute({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments } = await params;
  return <FilesApp linkSegments={segments ?? []} />;
}
