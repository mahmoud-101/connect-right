import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/language";
import { copyToClipboard } from "@/lib/copy";
import { exportAsPdf } from "@/lib/pdf";
import { sanitizeErrorMessage } from "@/lib/errors";
import type { Database } from "@/integrations/supabase/types";
import { buildWhatsAppText, openWhatsAppShare } from "@/lib/whatsapp";
import { track } from "@/lib/analytics";
import { POST_TEMPLATES, applyTemplate } from "@/lib/templates";
import { MessageCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tone = "casual" | "professional" | "luxury" | "friendly";
type Generated = {
  productData?: {
    title?: string;
    price?: string;
    specs?: string;
    imageUrls?: string[];
    generatedImageUrls?: string[];
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

  const isAbortError = (err: unknown) => {
    const anyErr = err as any;
    const name = typeof anyErr?.name === "string" ? anyErr.name : "";
    const msg = typeof anyErr?.message === "string" ? anyErr.message : "";
    const lower = msg.toLowerCase();
    return name === "AbortError" || lower.includes("signal is aborted") || lower.includes("aborted");
  };

  const parseFunctionError = (err: unknown): { message?: string; code?: string; finalUrl?: string } => {
    const anyErr = err as any;

    // supabase-js function errors usually have context.body, but shape can vary.
    const rawBody =
      anyErr?.context?.body ??
      anyErr?.context?.response?.body ??
      anyErr?.cause?.context?.body ??
      anyErr?.cause?.context?.response?.body;

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
    const finalUrl = body && typeof body === "object" ? body?.finalUrl : undefined;

    return {
      message: typeof message === "string" ? message : undefined,
      code: typeof code === "string" ? code : undefined,
      finalUrl: typeof finalUrl === "string" ? finalUrl : undefined,
    };
  };

  const getUserIdOrThrow = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) throw new Error("Unauthorized");
    return userId;
  };

  const invokeWithRefresh = async <T,>(
    fnName: string,
    body: Record<string, unknown>,
  ): Promise<{ data: T; refreshed: boolean }> => {
    let refreshed = false;

    const tryInvoke = async () => {
      const res = await supabase.functions.invoke(fnName, { body });
      if (res.error) throw res.error;
      return res.data as T;
    };

    try {
      const data = await tryInvoke();
      return { data, refreshed };
    } catch (err) {
      // If token is stale/invalid, refresh once and retry.
      const msg = (err as any)?.message ? String((err as any).message).toLowerCase() : "";
      const status = (err as any)?.context?.status ?? (err as any)?.status;
      const looksUnauthorized = status === 401 || msg.includes("jwt") || msg.includes("unauthorized");

      if (!looksUnauthorized) throw err;

      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw err;
      refreshed = true;

      const data = await tryInvoke();
      return { data, refreshed };
    }
  };

  const [lastUrlError, setLastUrlError] = useState<null | {
    code?: string;
    message: string;
    finalUrl?: string;
  }>(null);

  const [url, setUrl] = useState("");
  const [tone, setTone] = useState<Tone>("casual");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<"idle" | "extract" | "generate">("idle");
  const [data, setData] = useState<Generated | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [inputMode, setInputMode] = useState<"url" | "manual">("url");
  const [manualTitle, setManualTitle] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualSpecs, setManualSpecs] = useState("");
  const [manualFiles, setManualFiles] = useState<File[]>([]);

  // Radix Select disallows SelectItem value="". Use a sentinel.
  const [templateId, setTemplateId] = useState<string>("none");

  const [usageLoading, setUsageLoading] = useState(true);
  const [usageCount, setUsageCount] = useState<number>(0);
  const [usageLimit, setUsageLimit] = useState<number>(10);
  const [usagePlan, setUsagePlan] = useState<string>("free");
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

  const loadUsage = async () => {
    setUsageLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan")
        .eq("user_id", userId)
        .maybeSingle();

      const plan = profile?.subscription_plan ?? "free";
      const limit = plan === "pro" ? Number.POSITIVE_INFINITY : plan === "basic" ? 50 : 10;

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("usage_logs")
        // Avoid HEAD requests (can be aborted by some browsers/webviews)
        .select("id", { count: "exact" })
        .eq("user_id", userId)
        .eq("action", "extract")
        .gte("created_at", monthStart.toISOString());

      setUsagePlan(plan);
      setUsageLimit(limit);
      setUsageCount(count ?? 0);
    } catch {
      // silent; usage UI is best-effort
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    loadUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limitReached = useMemo(() => {
    if (usageLimit === Number.POSITIVE_INFINITY) return false;
    return usageCount >= usageLimit;
  }, [usageCount, usageLimit]);

  const usagePct = useMemo(() => {
    if (usageLimit === Number.POSITIVE_INFINITY) return 0;
    return Math.max(0, Math.min(100, Math.round((usageCount / Math.max(usageLimit, 1)) * 100)));
  }, [usageCount, usageLimit]);

  const run = async () => {
    if (limitReached) {
      toast({
        title: "تم الوصول للحد الشهري",
        description: "انضم/ي لقائمة الانتظار للترقية قريباً.",
        variant: "destructive",
      });
      return;
    }
    if (!url.trim()) return;
    setLoading(true);
    setStage("extract");
    setData(null);
    setRowId(null);
    setCoverUrl(null);
    setInputMode("url");
    setLastUrlError(null);

    try {
      const userId = await getUserIdOrThrow();

      setStage("generate");
      const { data: fnData } = await invokeWithRefresh<Generated & { error?: string }>("generate-product-content", {
        url,
        tone,
        section: "all",
      });

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

        if (templateId !== "none") {
         const templated = applyTemplate({
           templateId,
           title: parsed.productData?.title ?? null,
           price: parsed.productData?.price ?? null,
           description: parsed.content?.description ?? null,
           sellingPoints: parsed.content?.sellingPoints ?? [],
           hashtags: parsed.content?.hashtags ?? [],
         });
         setDraft((d) => ({ ...d, shortPost: templated || d.shortPost }));
       }

      const imageUrls = parsed.productData?.imageUrls ?? [];
      const generatedImageUrls = parsed.productData?.generatedImageUrls ?? [];
      const insert: Database["public"]["Tables"]["extracted_products"]["Insert"] = {
        user_id: userId,
        source_url: url,
        product_title: parsed.productData?.title ?? null,
        product_image_urls: imageUrls,
        generated_image_urls: generatedImageUrls,
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
      track("product_extracted", { has_images: (imageUrls?.length ?? 0) > 0, tone });
      loadUsage();
    } catch (err) {
      if (isAbortError(err)) {
        // Navigation/unmount or cancelled request — don't treat as a user-facing failure.
        return;
      }

      // Supabase functions errors may contain a JSON body (object OR string) with a user-friendly message.
      const parsedErr = parseFunctionError(err);
      const bodyMsg = parsedErr.message;
      const bodyCode = parsedErr.code;
      const bodyFinalUrl = parsedErr.finalUrl;

      if (
        bodyCode === "AUTH_REQUIRED_OR_NOT_PRODUCT" ||
        bodyCode === "AMAZON_CAPTCHA" ||
        bodyCode === "AMAZON_SIGNIN_OR_BLOCKED"
      ) {
        // Offer a no-scrape fallback that uses the internal webhook endpoint.
        setInputMode("manual");
      }

      // Track failures (best-effort)
      track("extract_failed", {
        code: bodyCode ?? "unknown",
        tone,
        mode: "url",
      });

      const msg = typeof bodyMsg === "string" && bodyMsg.trim() ? bodyMsg : sanitizeErrorMessage(err);
      setLastUrlError({
        code: typeof bodyCode === "string" ? bodyCode : undefined,
        message: msg,
        finalUrl: typeof bodyFinalUrl === "string" ? bodyFinalUrl : undefined,
      });
      toast({
        title: "خطأ",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setStage("idle");
    }
  };

  const generateFromManual = async () => {
    const title = manualTitle.trim();
    const specs = manualSpecs.trim();

    const uploadFiles = async (userId: string, files: File[]) => {
      if (!files.length) return [] as string[];
      const uploaded: string[] = [];
      for (const file of files) {
        const path = `${userId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        if (data?.publicUrl) uploaded.push(data.publicUrl);
      }
      return uploaded;
    };

    if (!title) {
      toast({
        title: "خطأ",
        description: "عنوان المنتج مطلوب.",
        variant: "destructive",
      });
      return;
    }

    if (!specs) {
      toast({
        title: "خطأ",
        description: "المواصفات مطلوبة.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setStage("generate");
    try {
      const userId = await getUserIdOrThrow();

       const imageUrls = Array.from(new Set(await uploadFiles(userId, manualFiles)));

      const { data: fnData, error: fnError } = await supabase.functions.invoke("affiliate-webhook", {
        body: {
          url: url.trim() || undefined,
          tone,
          product: {
            title: title || undefined,
            price: manualPrice.trim() || undefined,
            specs: specs || undefined,
            image_urls: imageUrls,
          },
        },
      });
      if (fnError) throw fnError;

      const id = (fnData as any)?.id as string | null;
      const content = (fnData as any)?.content as any;

      const next: Generated = {
        productData: {
          title: title || undefined,
          price: manualPrice.trim() || undefined,
          specs: specs || undefined,
          imageUrls,
          generatedImageUrls: [],
        },
        content: {
          description: content?.description ?? "",
          shortPost: content?.shortPost ?? "",
          sellingPoints: content?.sellingPoints ?? [],
          hashtags: content?.hashtags ?? [],
        },
      };

      setData(next);
      setEditing(false);
       setDraft({
        description: next.content?.description ?? "",
        shortPost: next.content?.shortPost ?? "",
        hashtags: (next.content?.hashtags ?? []).join(" "),
        sellingPoints: (next.content?.sellingPoints ?? []).join("\n"),
      });

        if (templateId !== "none") {
         const templated = applyTemplate({
           templateId,
           title: title || null,
           price: manualPrice.trim() || null,
           description: next.content?.description ?? null,
           sellingPoints: next.content?.sellingPoints ?? [],
           hashtags: next.content?.hashtags ?? [],
         });
         setDraft((d) => ({ ...d, shortPost: templated || d.shortPost }));
       }

      if (id) setRowId(id);
      setCoverUrl(imageUrls[0] ?? null);
       toast({ title: "تم توليد المحتوى" });
      track("product_extracted", { has_images: imageUrls.length > 0, tone, source: "manual" });
      loadUsage();
    } catch (err) {
      if (isAbortError(err)) return;
      const bodyMsg = parseFunctionError(err).message;
      track("extract_failed", { code: "manual_failed", tone, mode: "manual" });
      toast({
         title: "خطأ",
        description: typeof bodyMsg === "string" && bodyMsg.trim() ? bodyMsg : sanitizeErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setStage("idle");
    }
  };

  const generateImagesOnly = async () => {
    if (!url.trim()) return;
    if (!rowId) {
      toast({ title: "Error", description: "Generate once first, then you can add images.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setStage("generate");
    try {
      const { data: fnData } = await invokeWithRefresh<Generated & { error?: string }>("generate-product-content", {
        url,
        tone,
        section: "images",
      });
      const parsed = fnData as Generated & { error?: string };
      if ((parsed as any)?.error) throw new Error((parsed as any).error);

      const newImages = parsed.productData?.generatedImageUrls ?? [];
      setData((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev) as Generated;
        next.productData = next.productData ?? {};
        const existing = next.productData.generatedImageUrls ?? [];
        next.productData.generatedImageUrls = Array.from(new Set([...existing, ...newImages]));
        return next;
      });

      if (newImages.length) {
        const merged = Array.from(
          new Set([...(data?.productData?.generatedImageUrls ?? []), ...newImages]),
        );
        const { error } = await supabase
          .from("extracted_products")
          .update({ generated_image_urls: merged })
          .eq("id", rowId);
        if (error) throw error;
      }

      toast({ title: "Images generated" });
    } catch (err) {
      if (isAbortError(err)) return;
      const bodyMsg = parseFunctionError(err).message;
      toast({
        title: "Error",
        description: typeof bodyMsg === "string" && bodyMsg.trim() ? bodyMsg : sanitizeErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setStage("idle");
    }
  };

  const setAsCover = async (src: string) => {
    setCoverUrl(src);
    if (!rowId) return;
    try {
      const { error } = await supabase.from("extracted_products").update({ cover_image_url: src }).eq("id", rowId);
      if (error) throw error;
      toast({ title: "Cover updated" });
    } catch (err) {
      toast({ title: "Error", description: sanitizeErrorMessage(err), variant: "destructive" });
    }
  };

  const regenerate = async (section: "description" | "short_post" | "selling_points" | "hashtags" | "pricing") => {
    if (!url.trim()) return;
    setLoading(true);
    setStage("generate");
    try {
      const { data: fnData } = await invokeWithRefresh<any>("generate-product-content", {
        url,
        tone,
        section,
      });
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
      if (isAbortError(err)) return;
      const bodyMsg = parseFunctionError(err).message;
      toast({
        title: "Error",
        description: typeof bodyMsg === "string" && bodyMsg.trim() ? bodyMsg : sanitizeErrorMessage(err),
        variant: "destructive",
      });
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
        // Avoid HEAD requests (can be aborted by some browsers/webviews)
        .select("id", { count: "exact" })
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
      track("product_saved", {});
    } catch (err) {
      toast({ title: "Error", description: sanitizeErrorMessage(err), variant: "destructive" });
    }
  };

  const copyAll = async () => {
    if (!allText) return;
    await copyToClipboard(allText);
    toast({ title: "Copied" });
    track("content_copied", { source: "extract" });
  };

  const shareToWhatsApp = () => {
    if (!data) return;
    const selling = draft.sellingPoints
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    const hashtags = draft.hashtags
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean);

    const text = buildWhatsAppText({
      title: data.productData?.title ?? null,
      description: draft.description,
      sellingPoints: selling,
      price: data.productData?.price ?? null,
      hashtags,
    });
    openWhatsAppShare(text);
    track("whatsapp_share_clicked", { source: "extract" });
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
    setCoverUrl(null);
    setEditing(false);
    setInputMode("url");
    setManualTitle("");
    setManualPrice("");
    setManualSpecs("");
    setManualFiles([]);
    setTemplateId("none");
  };

  const applySelectedTemplate = async (nextTemplateId: string) => {
    setTemplateId(nextTemplateId);
    if (nextTemplateId === "none") return;

    const selling = draft.sellingPoints
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    const hashtags = draft.hashtags
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean);

    const templated = applyTemplate({
      templateId: nextTemplateId,
      title: data?.productData?.title ?? manualTitle.trim() ?? null,
      price: data?.productData?.price ?? manualPrice.trim() ?? null,
      description: draft.description,
      sellingPoints: selling,
      hashtags,
    });

    if (!templated) return;
    setDraft((d) => ({ ...d, shortPost: templated }));

    if (rowId) {
      try {
        await supabase.from("extracted_products").update({ generated_short_post: templated }).eq("id", rowId);
      } catch {
        // no-op
      }
    }
  };

  return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">{t("extractTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("pasteUrl")}</p>
        </div>

        <Card className="mb-6 p-4">
          {usageLoading ? (
            <div className="text-sm text-muted-foreground">Loading usage…</div>
          ) : (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">
                  {usageLimit === Number.POSITIVE_INFINITY
                    ? `Used ${usageCount} (Pro)`
                    : `Used ${usageCount} of ${usageLimit} this month`}
                </div>
                {limitReached ? (
                  <Button asChild variant="secondary" size="sm">
                    <a href="/" onClick={() => track("upgrade_waitlist_clicked", { source: "usage_limit" })}>
                      Join waitlist
                    </a>
                  </Button>
                ) : null}
              </div>
              {usageLimit === Number.POSITIVE_INFINITY ? null : <Progress value={usagePct} />}
              {usageLimit !== Number.POSITIVE_INFINITY && usagePct >= 80 ? (
                <div className="text-xs text-muted-foreground">
                  {usagePct >= 100
                    ? "تم الوصول للحد الشهري."
                    : "اقتربت من الحد الشهري—فكر/ي في الترقية قريباً."}
                </div>
              ) : null}
              <div className="text-xs text-muted-foreground">Plan: {usagePlan}</div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="grid gap-4">
            {lastUrlError && inputMode === "manual" ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="font-medium">{lastUrlError.message}</div>
                {lastUrlError.finalUrl ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="text-xs text-muted-foreground break-all">{lastUrlError.finalUrl}</div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => copyToClipboard(lastUrlError.finalUrl!)}
                    >
                      نسخ الرابط النهائي
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={inputMode === "url" ? "default" : "secondary"}
                onClick={() => setInputMode("url")}
              >
                استخراج من رابط
              </Button>
              <Button
                type="button"
                variant={inputMode === "manual" ? "default" : "secondary"}
                onClick={() => setInputMode("manual")}
              >
                إدخال يدوي
              </Button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url">URL</Label>
              <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." disabled={inputMode === "manual"} />
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

            {inputMode === "url" ? (
              <Button onClick={run} disabled={loading || !url.trim() || limitReached} size="lg">
                {loading ? (stage === "extract" ? t("extracting") : t("generating")) : t("extractTitle")}
              </Button>
            ) : (
              <Button
                onClick={generateFromManual}
                disabled={loading || limitReached || !manualTitle.trim() || !manualSpecs.trim()}
                size="lg"
              >
                {loading ? t("generating") : "توليد المحتوى من البيانات"}
              </Button>
            )}
          </div>
        </Card>

        {inputMode === "manual" && !data ? (
          <Card className="mt-6 p-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">إدخال يدوي (بدون استخراج من الرابط)</h2>
              <p className="text-sm text-muted-foreground">
                استخدم هذا الخيار لو الرابط لا يعمل أو المنصة تتطلب تسجيل دخول.
              </p>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="manualTitle">عنوان المنتج</Label>
                <Input id="manualTitle" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} required />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="manualPrice">السعر (اختياري)</Label>
                <Input id="manualPrice" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="manualSpecs">المواصفات</Label>
                <Textarea id="manualSpecs" value={manualSpecs} onChange={(e) => setManualSpecs(e.target.value)} required />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="manualFiles">صور المنتج (اختياري)</Label>
                <Input
                  id="manualFiles"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setManualFiles(Array.from(e.target.files ?? []))}
                />
                {manualFiles.length ? (
                  <div className="text-xs text-muted-foreground">تم اختيار {manualFiles.length} صورة.</div>
                ) : null}
                <div className="text-xs text-muted-foreground">سيتم رفع الصور للتخزين وحفظ الروابط فقط.</div>
              </div>
            </div>
          </Card>
        ) : null}

        {data && (
          <div className="mt-6 grid gap-4">
            {data.productData?.generatedImageUrls?.length ? (
              <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{t("suggestedImages")}</h2>
                  <Button variant="outline" size="sm" disabled={loading} onClick={generateImagesOnly}>
                    {t("generateImagesOnly")}
                  </Button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {data.productData.generatedImageUrls.slice(0, 4).map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAsCover(src)}
                      className="relative overflow-hidden rounded-md text-left"
                      aria-label={t("setAsCover")}
                    >
                      <img
                        src={src}
                        alt={data.productData?.title ?? "product"}
                        className="h-56 w-full object-cover"
                        loading="lazy"
                      />
                      <div className="pointer-events-none absolute inset-0 ring-2 ring-transparent data-[active=true]:ring-ring" data-active={coverUrl === src} />
                      {coverUrl === src ? (
                        <div className="absolute start-2 top-2 rounded-md bg-background/80 px-2 py-1 text-xs font-medium text-foreground backdrop-blur">
                          {t("cover")}
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{t("tapToSetCover")}</p>
              </Card>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveToLibrary}>{t("save")}</Button>
              <Button
                variant="secondary"
                className="bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90"
                onClick={shareToWhatsApp}
                disabled={!data}
              >
                <MessageCircle className="h-4 w-4" />
                مشاركة واتساب
              </Button>
              <Button variant="secondary" onClick={copyAll}>
                {t("copyAll")}
              </Button>
              <Button variant="secondary" onClick={exportPdf}>
                {t("exportPdf")}
              </Button>
              <Button variant="secondary" onClick={generateImagesOnly} disabled={loading || !rowId}>
                {t("generateImagesOnly")}
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
                <div className="grid gap-1">
                  <h2 className="text-lg font-semibold">البوست</h2>
                  <div className="text-xs text-muted-foreground">اختيار قالب ينسّق البوست تلقائياً بعد التوليد.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={templateId} onValueChange={applySelectedTemplate}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="اختر قالب" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون قالب</SelectItem>
                      {POST_TEMPLATES.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" disabled={loading} onClick={() => regenerate("short_post")}>
                    إعادة توليد
                  </Button>
                </div>
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
  );
}
