import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/language";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeErrorMessage } from "@/lib/errors";
import { exportAsPdf } from "@/lib/pdf";
import { buildWhatsAppText, openWhatsAppShare } from "@/lib/whatsapp";
import { track } from "@/lib/analytics";
import { MessageCircle } from "lucide-react";

type Tone = "casual" | "professional" | "luxury" | "friendly";

type ItemRow = {
  id: string;
  source_url: string;
  product_title: string | null;
  product_image_urls: string[];
  generated_image_urls: string[];
  cover_image_url: string | null;
  original_price: string | null;
  specs: string | null;
  tone: string;
  generated_description: string | null;
  generated_short_post: string | null;
  generated_selling_points: string[];
  generated_hashtags: string[];
  suggested_pricing: any;
  created_at: string;
};

export default function LibraryItem() {
  const { id } = useParams();
  const nav = useNavigate();
  const { lang } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [item, setItem] = useState<ItemRow | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    description: "",
    shortPost: "",
    sellingPoints: "",
    hashtags: "",
  });

  const title = item?.product_title ?? (lang === "ar" ? "بدون عنوان" : "Untitled");

  const allText = useMemo(() => {
    if (!item) return "";
    const parts = [
      title ? `Title: ${title}` : "",
      item.original_price ? `Price: ${item.original_price}` : "",
      draft.description ? `\n\nDescription:\n${draft.description}` : "",
      draft.shortPost ? `\n\nPost:\n${draft.shortPost}` : "",
      draft.sellingPoints ? `\n\nSelling points:\n- ${draft.sellingPoints}` : "",
      draft.hashtags ? `\n\nHashtags:\n${draft.hashtags}` : "",
    ].filter(Boolean);
    return parts.join("\n");
  }, [draft, item, title]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("extracted_products")
        .select(
          "id, source_url, product_title, product_image_urls, generated_image_urls, cover_image_url, original_price, specs, tone, generated_description, generated_short_post, generated_selling_points, generated_hashtags, suggested_pricing, created_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(lang === "ar" ? "المنتج غير موجود" : "Product not found");

      const row = data as unknown as ItemRow;
      setItem(row);
      setCoverUrl(row.cover_image_url);
      setDraft({
        description: row.generated_description ?? "",
        shortPost: row.generated_short_post ?? "",
        sellingPoints: (row.generated_selling_points ?? []).join("\n"),
        hashtags: (row.generated_hashtags ?? []).join(" "),
      });
    } catch (err) {
      toast({ title: "Error", description: sanitizeErrorMessage(err), variant: "destructive" });
      nav("/library", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setAsCover = async (src: string) => {
    if (!id) return;
    setCoverUrl(src);
    try {
      const { error } = await supabase.from("extracted_products").update({ cover_image_url: src }).eq("id", id);
      if (error) throw error;
      setItem((prev) => (prev ? { ...prev, cover_image_url: src } : prev));
      toast({ title: lang === "ar" ? "تم تحديث الغلاف" : "Cover updated" });
    } catch (err) {
      toast({ title: "Error", description: sanitizeErrorMessage(err), variant: "destructive" });
    }
  };

  const saveEdits = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const selling = draft.sellingPoints
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      const tags = draft.hashtags
        .split(/\s+/)
        .map((x) => x.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from("extracted_products")
        .update({
          generated_description: draft.description,
          generated_short_post: draft.shortPost,
          generated_selling_points: selling,
          generated_hashtags: tags,
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: lang === "ar" ? "تم الحفظ" : "Saved" });
    } catch (err) {
      toast({ title: "Error", description: sanitizeErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async (section: "description" | "short_post" | "selling_points" | "hashtags" | "pricing") => {
    if (!item) return;
    setRegenerating(section);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-product-content", {
        body: { url: item.source_url, tone: (item.tone as Tone) ?? "casual", section },
      });
      if (fnError) throw fnError;
      if ((fnData as any)?.error) throw new Error((fnData as any).error);

      const next = fnData as any;
      const patch: Partial<ItemRow> = {};

      if (section === "description") {
        const v = next.content?.description ?? "";
        setDraft((d) => ({ ...d, description: v }));
        patch.generated_description = v;
      }
      if (section === "short_post") {
        const v = next.content?.shortPost ?? "";
        setDraft((d) => ({ ...d, shortPost: v }));
        patch.generated_short_post = v;
      }
      if (section === "selling_points") {
        const arr = (next.content?.sellingPoints ?? []) as string[];
        const v = arr.join("\n");
        setDraft((d) => ({ ...d, sellingPoints: v }));
        patch.generated_selling_points = arr;
      }
      if (section === "hashtags") {
        const arr = (next.content?.hashtags ?? []) as string[];
        const v = arr.join(" ");
        setDraft((d) => ({ ...d, hashtags: v }));
        patch.generated_hashtags = arr;
      }
      if (section === "pricing") {
        patch.suggested_pricing = next.content?.pricing ?? null;
      }

      const { error } = await supabase.from("extracted_products").update(patch).eq("id", item.id);
      if (error) throw error;
      setItem((prev) => (prev ? { ...prev, ...patch } : prev));
      toast({ title: lang === "ar" ? "تم التحديث" : "Updated" });
    } catch (err) {
      toast({ title: "Error", description: sanitizeErrorMessage(err), variant: "destructive" });
    } finally {
      setRegenerating(null);
    }
  };

  const exportPdf = () => {
    if (!item) return;
    const img = coverUrl ?? item.generated_image_urls?.[0] ?? item.product_image_urls?.[0];
    const esc = (s: string) => s.replace(/</g, "&lt;");
    exportAsPdf({
      title: title ?? "SellFast",
      html: `
        <h1>${esc(title ?? "SellFast")}</h1>
        ${img ? `<img src="${img}" alt="${esc(title ?? "product")}" />` : ""}
        <div class="card"><h2>Description</h2><pre>${esc(draft.description ?? "")}</pre></div>
        <div class="card"><h2>Post</h2><pre>${esc(draft.shortPost ?? "")}</pre></div>
        <div class="card"><h2>Selling points</h2><pre>${esc(draft.sellingPoints ?? "")}</pre></div>
        <div class="card"><h2>Hashtags</h2><pre>${esc(draft.hashtags ?? "")}</pre></div>
      `,
    });
  };

  const shareToWhatsApp = () => {
    if (!item) return;
    const selling = draft.sellingPoints
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    const hashtags = draft.hashtags
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean);

    const text = buildWhatsAppText({
      title,
      description: draft.description,
      sellingPoints: selling,
      price: item.original_price,
      hashtags,
    });

    openWhatsAppShare(text);
    track("whatsapp_share_clicked", { source: "library_item" });
  };

  const images = useMemo(() => {
    if (!item) return [] as string[];
    return Array.from(
      new Set([...(item.generated_image_urls ?? []), ...(item.product_image_urls ?? [])].filter(Boolean)),
    ).slice(0, 6);
  }, [item]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{item?.source_url}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => nav("/library")}>
              {lang === "ar" ? "رجوع" : "Back"}
            </Button>
            <Button variant="secondary" onClick={shareToWhatsApp} disabled={loading || !item}>
              <MessageCircle className="h-4 w-4" />
              {lang === "ar" ? "مشاركة واتساب" : "WhatsApp"}
            </Button>
            <Button variant="secondary" onClick={exportPdf}>
              {lang === "ar" ? "تصدير PDF" : "Export PDF"}
            </Button>
            <Button onClick={saveEdits} disabled={saving || loading}>
              {saving ? (lang === "ar" ? "جارٍ الحفظ..." : "Saving...") : lang === "ar" ? "حفظ" : "Save"}
            </Button>
          </div>
        </div>

        {loading || !item ? (
          <div className="text-sm text-muted-foreground">{lang === "ar" ? "تحميل..." : "Loading..."}</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{lang === "ar" ? "الصور" : "Images"}</h2>
                <div className="text-xs text-muted-foreground">
                  {lang === "ar" ? "اضغط لتعيين كغلاف" : "Tap to set cover"}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {images.map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setAsCover(src)}
                    className="relative overflow-hidden rounded-md text-left"
                    aria-label={lang === "ar" ? "تعيين كغلاف" : "Set as cover"}
                  >
                    <img src={src} alt={title} className="h-48 w-full object-cover" loading="lazy" />
                    <div
                      className="pointer-events-none absolute inset-0 ring-2 ring-transparent data-[active=true]:ring-ring"
                      data-active={coverUrl === src}
                    />
                    {coverUrl === src ? (
                      <div className="absolute start-2 top-2 rounded-md bg-background/80 px-2 py-1 text-xs font-medium text-foreground backdrop-blur">
                        {lang === "ar" ? "غلاف" : "Cover"}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            </Card>

            <div className="grid gap-4">
              <Card className="p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-lg font-semibold">{lang === "ar" ? "الوصف" : "Description"}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!!regenerating}
                    onClick={() => regenerate("description")}
                  >
                    {regenerating === "description" ? (lang === "ar" ? "جارٍ..." : "…") : lang === "ar" ? "إعادة توليد" : "Regenerate"}
                  </Button>
                </div>
                <div className="mt-3 grid gap-2">
                  <Label>{lang === "ar" ? "تعديل" : "Edit"}</Label>
                  <Textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-lg font-semibold">{lang === "ar" ? "البوست" : "Post"}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!!regenerating}
                    onClick={() => regenerate("short_post")}
                  >
                    {regenerating === "short_post" ? (lang === "ar" ? "جارٍ..." : "…") : lang === "ar" ? "إعادة توليد" : "Regenerate"}
                  </Button>
                </div>
                <div className="mt-3 grid gap-2">
                  <Label>{lang === "ar" ? "تعديل" : "Edit"}</Label>
                  <Textarea value={draft.shortPost} onChange={(e) => setDraft((d) => ({ ...d, shortPost: e.target.value }))} />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-lg font-semibold">{lang === "ar" ? "نقاط البيع" : "Selling points"}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!!regenerating}
                    onClick={() => regenerate("selling_points")}
                  >
                    {regenerating === "selling_points" ? (lang === "ar" ? "جارٍ..." : "…") : lang === "ar" ? "إعادة توليد" : "Regenerate"}
                  </Button>
                </div>
                <div className="mt-3 grid gap-2">
                  <Label>{lang === "ar" ? "سطر لكل نقطة" : "One per line"}</Label>
                  <Textarea value={draft.sellingPoints} onChange={(e) => setDraft((d) => ({ ...d, sellingPoints: e.target.value }))} />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-lg font-semibold">{lang === "ar" ? "هاشتاجات" : "Hashtags"}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!!regenerating}
                    onClick={() => regenerate("hashtags")}
                  >
                    {regenerating === "hashtags" ? (lang === "ar" ? "جارٍ..." : "…") : lang === "ar" ? "إعادة توليد" : "Regenerate"}
                  </Button>
                </div>
                <div className="mt-3 grid gap-2">
                  <Label>{lang === "ar" ? "افصل بمسافة" : "Space separated"}</Label>
                  <Textarea value={draft.hashtags} onChange={(e) => setDraft((d) => ({ ...d, hashtags: e.target.value }))} />
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
