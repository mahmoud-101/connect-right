import JSZip from "jszip";

export async function createZipBundle(params: {
  files: Array<{ path: string; data: Blob | string }>;
}): Promise<Blob> {
  const zip = new JSZip();
  for (const f of params.files) {
    zip.file(f.path, f.data as any);
  }
  return await zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
