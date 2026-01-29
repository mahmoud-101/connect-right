import { useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { sanitizeErrorMessage } from "@/lib/errors";
import { createZipBundle, downloadBlob } from "@/lib/zipBundle";

type Variant = "feed" | "story";

async function loadImageFromFile(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawFbBadge(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const pad = Math.round(Math.min(w, h) * 0.03);
  const bw = Math.round(w * 0.36);
  const bh = Math.round(h * 0.08);
  const x = pad;
  const y = pad;

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "hsl(var(--primary))";
  const r = Math.round(bh / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + bw, y, x + bw, y + bh, r);
  ctx.arcTo(x + bw, y + bh, x, y + bh, r);
  ctx.arcTo(x, y + bh, x, y, r);
  ctx.arcTo(x, y, x + bw, y, r);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = "hsl(var(--primary-foreground))";
  ctx.font = `${Math.round(bh * 0.45)}px system-ui, -apple-system, Segoe UI, Roboto`;
  ctx.textBaseline = "middle";
  ctx.fillText("FB READY", x + Math.round(bh * 0.35), y + bh / 2);
  ctx.restore();
}

async function optimizeToBlob(file: File, variant: Variant): Promise<Blob> {
  const targetW = 1080;
  const targetH = variant === "story" ? 1920 : 1080;

  const img = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const scale = Math.max(targetW / img.width, targetH / img.height);
  const sw = targetW / scale;
  const sh = targetH / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

  // Simple white overlay fallback (NOT true bg removal)
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.restore();

  drawFbBadge(ctx, targetW, targetH);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to export image"))),
      "image/jpeg",
      0.92,
    );
  });
  return blob;
}

export default function ImageOptimizer() {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [variant, setVariant] = useState<Variant>("feed");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const previews = useMemo(() => files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })), [files]);

  const clearPreviews = () => previews.forEach((p) => URL.revokeObjectURL(p.url));

  const onPick = (next: FileList | null) => {
    clearPreviews();
    setFiles(next ? Array.from(next).slice(0, 10) : []);
  };

  const downloadZip = async () => {
    if (!files.length) return;
    setBusy(true);
    try {
      const optimized = await Promise.all(
        files.map(async (f, idx) => {
          const blob = await optimizeToBlob(f, variant);
          return { path: `images/${idx + 1}-${variant}.jpg`, data: blob };
        }),
      );

      const zip = await createZipBundle({
        files: [...optimized, { path: "README.txt", data: "FB Image Optimizer: Canvas crop + FB READY badge.\n" }],
      });
      downloadBlob(zip, `fb-images-${variant}.zip`);
      toast({ title: "تم تنزيل الصور" });
    } catch (err) {
      toast({ title: "خطأ", description: sanitizeErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">FB Image Optimizer</h1>
        <p className="mt-1 text-sm text-muted-foreground">قص تلقائي 1080×1080 و1080×1920 + FB READY badge (بدون مفاتيح).</p>
      </div>

      <Card className="p-6">
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onPick(e.target.files)}
            />
            <Button onClick={() => inputRef.current?.click()} disabled={busy}>Upload images</Button>
            <Button variant={variant === "feed" ? "default" : "secondary"} onClick={() => setVariant("feed")} disabled={busy}>
              1080×1080 Feed
            </Button>
            <Button variant={variant === "story" ? "default" : "secondary"} onClick={() => setVariant("story")} disabled={busy}>
              1080×1920 Story
            </Button>
            <Button variant="secondary" onClick={downloadZip} disabled={!files.length || busy}>
              {busy ? "جارٍ التحضير…" : "Download ZIP"}
            </Button>
          </div>

          {files.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {previews.map((p) => (
                <div key={p.url} className="rounded-md border bg-muted/20 p-2">
                  <img src={p.url} alt={p.name} className="h-40 w-full rounded object-cover" loading="lazy" />
                  <div className="mt-2 truncate text-xs text-muted-foreground">{p.name}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">ارفع صور المنتج (حتى 10) لتجهيزها لفيسبوك.</div>
          )}

          <Card className="p-4">
            <div className="text-sm font-semibold">FB Ready Check</div>
            <ul className="mt-2 list-disc space-y-1 ps-6 text-sm text-muted-foreground">
              <li>Feed/Story مقاسات صحيحة</li>
              <li>جودة JPEG عالية</li>
              <li>Badge جاهز</li>
            </ul>
          </Card>
        </div>
      </Card>
    </main>
  );
}
