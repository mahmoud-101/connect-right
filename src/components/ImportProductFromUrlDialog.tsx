import { useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { sanitizeErrorMessage } from "@/lib/errors";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/language";
import type { Database } from "@/integrations/supabase/types";
import { track } from "@/lib/analytics";

const urlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine((v) => {
    try {
      // allow missing protocol; we'll normalize later
      // eslint-disable-next-line no-new
      new URL(v.startsWith("http") ? v : `https://${v}`);
      return true;
    } catch {
      return false;
    }
  }, "Invalid URL");

type Extracted = {
  product?: {
    title?: string;
    price?: string;
    images?: string[];
    description?: string;
    variants?: unknown;
  };
  screenshot?: string;
  finalUrl?: string;
  cached?: boolean;
};

function parseFunctionError(err: unknown): { message?: string; code?: string } {
  const anyErr = err as any;
  const rawBody = anyErr?.context?.body ?? anyErr?.context?.response?.body ?? anyErr?.cause?.context?.body;
  let body: any = rawBody;
  if (typeof rawBody === "string") {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = null;
    }
  }
  const message = body && typeof body === "object" ? body?.error : undefined;
  const code = body && typeof body === "object" ? body?.code : undefined;
  return {
    message: typeof message === "string" ? message : undefined,
    code: typeof code === "string" ? code : undefined,
  };
}

function normalizeUrl(raw: string) {
  const u = raw.trim();
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `https://${u}`;
}

export function ImportProductFromUrlDialog({ tone }: { tone: string }) {
  const { lang } = useLanguage();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Extracted | null>(null);

  const canSave = useMemo(() => {
    const title = result?.product?.title?.trim();
    const hasImages = (result?.product?.images?.length ?? 0) > 0;
    return Boolean(title || hasImages);
  }, [result]);

  const labels = useMemo(() => {
    const ar = {
      trigger: "Import Product from URL",
      title: "استيراد منتج من رابط",
      url: "رابط المنتج",
      fetch: "استخراج البيانات",
      retry: "إعادة المحاولة",
      add: "Add to Products",
      close: "إغلاق",
      extracted: "البيانات المستخرجة",
      screenshot: "Screenshot",
      low: "فشل الاستخراج — جرّب إدخال يدوي.",
      loading: "جارٍ…",
    };
    const en = {
      trigger: "Import Product from URL",
      title: "Import product from URL",
      url: "Product URL",
      fetch: "Extract",
      retry: "Retry",
      add: "Add to Products",
      close: "Close",
      extracted: "Extracted data",
      screenshot: "Screenshot",
      low: "Extraction failed — try manual input.",
      loading: "Loading…",
    };
    return lang === "ar" ? ar : en;
  }, [lang]);

  const extract = async () => {
    const parsed = urlSchema.safeParse(url);
    if (!parsed.success) {
      toast({ title: "خطأ", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const normalized = normalizeUrl(url);
      track("import_product_extract_start", { tool: "extract", tone });

      const { data, error } = await supabase.functions.invoke("firecrawl-extract-product", {
        body: { url: normalized },
      });
      if (error) throw error;

      const payload = data as Extracted;
      setResult(payload);
      track("import_product_extract_success", { cached: Boolean(payload?.cached) });
    } catch (err) {
      track("import_product_extract_failed", { message: sanitizeErrorMessage(err) });
      const parsed = parseFunctionError(err);
      const msg = parsed.message || sanitizeErrorMessage(err);
      const suffix = parsed.code ? ` (${parsed.code})` : "";
      toast({ title: "خطأ", description: `${msg}${suffix}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!result) return;

    setSaving(true);
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = auth.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const insert: Database["public"]["Tables"]["extracted_products"]["Insert"] = {
        user_id: userId,
        source_url: normalizeUrl(url),
        product_title: result.product?.title?.trim() || null,
        original_price: result.product?.price?.trim() || null,
        product_image_urls: Array.from(new Set(result.product?.images ?? [])).slice(0, 30),
        specs: result.product?.description?.trim() || null,
        tone: (tone as any) ?? "casual",
        generated_description: null,
        generated_short_post: null,
        generated_selling_points: [],
        generated_hashtags: [],
        suggested_pricing: null,
        generated_image_urls: [],
        cover_image_url: (result.product?.images?.[0] ?? null) as any,
        is_saved: true,
      };

      const { data: row, error } = await supabase
        .from("extracted_products")
        .insert(insert)
        .select("id")
        .maybeSingle();
      if (error) throw error;

      track("import_product_saved", { has_images: (insert.product_image_urls?.length ?? 0) > 0 });
      toast({ title: "تم", description: "تمت الإضافة للمكتبة" });
      setOpen(false);
      setUrl("");
      setResult(null);

      // Best-effort: log usage
      if (row?.id) {
        await supabase.from("usage_logs").insert({ user_id: userId, action: "import_product" });
      }
    } catch (err) {
      toast({ title: "خطأ", description: sanitizeErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          {labels.trigger}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="importUrl">{labels.url}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="importUrl"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                disabled={loading || saving}
              />
              <Button type="button" onClick={extract} disabled={loading || saving || !url.trim()}>
                {loading ? labels.loading : labels.fetch}
              </Button>
            </div>
          </div>

          {result ? (
            <div className="grid gap-3">
              <Card className="p-4">
                <div className="text-sm font-semibold">{labels.extracted}</div>
                <div className="mt-3 grid gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Title:</span> {result.product?.title || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Price:</span> {result.product?.price || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Images:</span> {result.product?.images?.length ?? 0}
                  </div>
                  <div className="text-muted-foreground">{result.product?.description ? result.product.description.slice(0, 280) + (result.product.description.length > 280 ? "…" : "") : "—"}</div>
                </div>

                {!!result.product?.images?.length ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {result.product.images.slice(0, 4).map((src, i) => (
                      <img key={i} src={src} alt={result.product?.title ?? "product"} className="h-24 w-full rounded-md object-cover" loading="lazy" />
                    ))}
                  </div>
                ) : null}
              </Card>

              {result.screenshot ? (
                <Card className="p-4">
                  <div className="text-sm font-semibold">{labels.screenshot}</div>
                  <img
                    src={result.screenshot.startsWith("data:") ? result.screenshot : `data:image/png;base64,${result.screenshot}`}
                    alt="page screenshot"
                    className="mt-3 max-h-64 w-full rounded-md object-cover"
                    loading="lazy"
                  />
                </Card>
              ) : null}
            </div>
          ) : null}

          {!loading && !result ? (
            <p className="text-sm text-muted-foreground">{labels.low}</p>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving || loading}>
            {labels.close}
          </Button>
          <Button type="button" onClick={save} disabled={!canSave || saving || loading}>
            {saving ? labels.loading : labels.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
