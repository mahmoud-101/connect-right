import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { useLanguage } from "@/contexts/language";
import { copyToClipboard } from "@/lib/copy";
import { exportAsPdf } from "@/lib/pdf";
import type { Database } from "@/integrations/supabase/types";

type Tone = "casual" | "professional" | "luxury" | "friendly";
type Generated = {
  productData?: {
    title?: string;
    price?: string;
    specs?: string;
    imageUrls?: string[];
    ratingsSummary?: string;
  };
  content?: {
    description?: string;
    shortPost?: string;
    sellingPoints?: string[];
    hashtags?: string[];
    pricing?: any;
  };
};

export default function Extract() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [url, setUrl] = useState("");
  const [tone, setTone] = useState<Tone>("casual");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<"idle" | "extract" | "generate">("idle");
  const [data, setData] = useState<Generated | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ description: string; shortPost: string; hashtags: string; sellingPoints: string }>(
    { description: "", shortPost: "", hashtags: "", sellingPoints: "" },
  );

  const allText = useMemo(() => {
    if (!data?.content) return "";
    const parts = [
      data.productData?.title ? `Title: ${data.productData.title}` : "",
      data.productData?.price ? `Price: ${data.productData.price}` : "",
      data.content.description ? `\n\nDescription:\n${data.content.description}` : "",
      data.content.shortPost ? `\n\nPost:\n${data.content.shortPost}` : "",
      data.content.sellingPoints?.length ? `\n\nSelling points:\n- ${data.content.sellingPoints.join("\n- ")}` : "",
      data.content.hashtags?.length ? `\n\nHashtags:\n${data.content.hashtags.join(" ")}` : "",
    ].filter(Boolean);
    return parts.join("\n");
  }, [data]);

  const run = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setStage("extract");
    setData(null);
    setRowId(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Unauthorized");

      setStage("generate");
      const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-product-content", {
        body: { url, tone, section: "all" },
      });
      if (fnError) throw fnError;

      const parsed = fnData as Generated & { error?: string };
      if ((parsed as any)?.error) throw new Error((parsed as any).error);
      setData(parsed);
      setEditing(false);
      setDraft({
        description: parsed.content?.description ?? "",
        shortPost: parsed.content?.shortPost ?? "",
        hashtags: (parsed.content?.hashtags ?? []).join(" "),
        sellingPoints: (parsed.content?.sellingPoints ?? []).join("\n"),
      });

      const imageUrls = parsed.productData?.imageUrls ?? [];
      const insert: Database["public"]["Tables"]["extracted_products"]["Insert"] = {
        user_id: userId,
        source_url: url,
        product_title: parsed.productData?.title ?? null,
        product_image_urls: imageUrls,
        original_price: parsed.productData?.price ?? null,
        specs: parsed.productData?.specs ?? null,
        tone,
        generated_description: parsed.content?.description ?? null,
        generated_short_post: parsed.content?.shortPost ?? null,
        generated_selling_points: parsed.content?.sellingPoints ?? [],
        generated_hashtags: parsed.content?.hashtags ?? [],
        suggested_pricing: parsed.content?.pricing ?? null,
        is_saved: false,
      };

      const { data: row, error: insertError } = await supabase
        .from("extracted_products")
        .insert(insert)
        .select("id")
        .maybeSingle();
      if (insertError) throw insertError;
      if (row?.id) setRowId(row.id);

      await supabase.from("usage_logs").insert({ user_id: userId, action: "extract" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
      setStage("idle");
    }
  };

  const regenerate = async (section: "description" | "short_post" | "selling_points" | "hashtags" | "pricing") => {
    if (!url.trim()) return;
    setLoading(true);
    setStage("generate");
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-product-content", {
        body: { url, tone, section },
      });
      if (fnError) throw fnError;
      const parsed = fnData as any;
      if (parsed?.error) throw new Error(parsed.error);

      setData((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev) as Generated;
        next.content = next.content ?? {};
        if (section === "description") next.content.description = parsed.content?.description ?? next.content.description;
        if (section === "short_post") next.content.shortPost = parsed.content?.shortPost ?? next.content.shortPost;
        if (section === "selling_points") next.content.sellingPoints = parsed.content?.sellingPoints ?? next.content.sellingPoints;
        if (section === "hashtags") next.content.hashtags = parsed.content?.hashtags ?? next.content.hashtags;
        if (section === "pricing") next.content.pricing = parsed.content?.pricing ?? next.content.pricing;
        return next;
      });

      toast({ title: "Updated" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setLoading(false);
      setStage("idle");
    }
  };

  const saveToLibrary = async () => {
    if (!rowId) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Unauthorized");

      // Plan limit enforcement (client-side MVP)
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan, extraction_limit")
        .eq("user_id", userId)
        .maybeSingle();

      const plan = profile?.subscription_plan ?? "free";
      const limit = plan === "pro" ? Infinity : plan === "basic" ? 50 : 10;

      const { count } = await supabase
        .from("extracted_products")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_saved", true);

      if ((count ?? 0) >= limit) {
        toast({
          title: "Limit reached",
          description: plan === "free" ? "Free: 10 saved products" : "Basic: 50 saved products",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("extracted_products").update({ is_saved: true }).eq("id", rowId);
      if (error) throw error;
      await supabase.from("usage_logs").insert({ user_id: userId, action: "save" });
      toast({ title: "Saved" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const copyAll = async () => {
    if (!allText) return;
    await copyToClipboard(allText);
    toast({ title: "Copied" });
  };

  const exportPdf = () => {
    if (!data) return;
    const title = data.productData?.title ?? "SellFast";
    const img = data.productData?.imageUrls?.[0];
    const esc = (s: string) => s.replace(/</g, "&lt;");
    exportAsPdf({
      title,
      html: `
        <h1>${title}</h1>
        ${img ? `<img src="${img}" alt="${title}" />` : ""}
        <div class="card"><h2>Description</h2><pre>${esc(data.content?.description ?? "")}</pre></div>
        <div class="card"><h2>Post</h2><pre>${esc(data.content?.shortPost ?? "")}</pre></div>
        <div class="card"><h2>Selling points</h2><pre>${esc((data.content?.sellingPoints ?? []).join("\n"))}</pre></div>
        <div class="card"><h2>Hashtags</h2><pre>${esc((data.content?.hashtags ?? []).join(" "))}</pre></div>
      `,
    });
  };

  const reset = () => {
    setUrl("");
    setTone("casual");
    setData(null);
    setRowId(null);
    setEditing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">{t("extractTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("pasteUrl")}</p>
        </div>

        <Card className="p-6">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="url">URL</Label>
              <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            </div>

            <div className="grid gap-2">
              <Label>{t("tone")}</Label>
              <div className="flex flex-wrap gap-2">
                {([
                  ["casual", t("casual")],
                  ["professional", t("professional")],
                  ["luxury", t("luxury")],
                  ["friendly", t("friendly")],
                ] as const).map(([k, label]) => (
                  <Button key={k} type="button" variant={tone === k ? "default" : "secondary"} onClick={() => setTone(k)}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <Button onClick={run} disabled={loading || !url.trim()} size="lg">
              {loading ? (stage === "extract" ? t("extracting") : t("generating")) : t("extractTitle")}
            </Button>
          </div>
        </Card>

        {data && (
          <div className="mt-6 grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveToLibrary}>{t("save")}</Button>
              <Button variant="secondary" onClick={copyAll}>
                {t("copyAll")}
              </Button>
              <Button variant="secondary" onClick={exportPdf}>
                {t("exportPdf")}
              </Button>
              <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
                {editing ? "Done" : "Edit"}
              </Button>
              <Button variant="outline" onClick={reset}>
                {t("extractAnother")}
              </Button>
            </div>

            <Card className="p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Description</h2>
                <Button variant="outline" size="sm" disabled={loading} onClick={() => regenerate("description")}>
                  Regenerate
                </Button>
              </div>
              {editing ? (
                <Textarea
                  className="mt-3"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                />
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{draft.description}</p>
              )}
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Post</h2>
                <Button variant="outline" size="sm" disabled={loading} onClick={() => regenerate("short_post")}>
                  Regenerate
                </Button>
              </div>
              {editing ? (
                <Textarea
                  className="mt-3"
                  value={draft.shortPost}
                  onChange={(e) => setDraft((d) => ({ ...d, shortPost: e.target.value }))}
                />
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{draft.shortPost}</p>
              )}
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Selling points</h2>
                <Button variant="outline" size="sm" disabled={loading} onClick={() => regenerate("selling_points")}>
                  Regenerate
                </Button>
              </div>
              {editing ? (
                <Textarea
                  className="mt-3"
                  value={draft.sellingPoints}
                  onChange={(e) => setDraft((d) => ({ ...d, sellingPoints: e.target.value }))}
                />
              ) : (
                <ul className="mt-2 list-disc space-y-1 ps-6 text-sm text-muted-foreground">
                  {draft.sellingPoints
                    .split("\n")
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                </ul>
              )}
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Hashtags</h2>
                <Button variant="outline" size="sm" disabled={loading} onClick={() => regenerate("hashtags")}>
                  Regenerate
                </Button>
              </div>
              {editing ? (
                <Textarea
                  className="mt-3"
                  value={draft.hashtags}
                  onChange={(e) => setDraft((d) => ({ ...d, hashtags: e.target.value }))}
                />
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{draft.hashtags}</p>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
