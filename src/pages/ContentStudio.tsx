import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { sanitizeErrorMessage } from "@/lib/errors";
import { copyToClipboard } from "@/lib/copy";
import { buildWhatsAppText, openWhatsAppShare } from "@/lib/whatsapp";
import { formatDistanceToNow } from "date-fns";

type ProductRow = Database["public"]["Tables"]["extracted_products"]["Row"];

function pickTopPoints(points: string[], max = 3) {
  return (points ?? []).filter(Boolean).slice(0, max);
}

function buildFacebookPost(p: ProductRow) {
  const title = p.product_title ?? "";
  const price = p.original_price ?? "";
  const desc = p.generated_description ?? "";
  const points = pickTopPoints(p.generated_selling_points ?? [], 4);
  const hashtags = (p.generated_hashtags ?? []).slice(0, 12).join(" ");

  const lines = [
    title ? `✨ ${title}` : "✨ منتج جديد",
    price ? `السعر: ${price}` : "",
    "",
    desc,
    points.length ? `\n✅ المميزات:\n- ${points.join("\n- ")}` : "",
    "\n📩 للطلب: ابعت رسالة / كومنت بكلمة (سعر)",
    hashtags ? `\n${hashtags}` : "",
  ].filter(Boolean);

  return lines.join("\n").trim();
}

function buildWhatsAppReply(p: ProductRow) {
  const title = p.product_title ?? "";
  const price = p.original_price ?? "";
  const points = pickTopPoints(p.generated_selling_points ?? [], 3);

  const lines = [
    "أهلاً! 🙌",
    title ? `بالنسبة لمنتج: ${title}` : "",
    price ? `السعر: ${price}` : "",
    points.length ? `\n✅ أهم المميزات:\n- ${points.join("\n- ")}` : "",
    "\nتحب/ي أبعتهولك بألوان/مقاسات معينة؟ وابعتلي منطقتك عشان أقولك التوصيل. ✅",
  ].filter(Boolean);

  return lines.join("\n").trim();
}

function buildShortVideoScript(p: ProductRow) {
  const title = p.product_title ?? "منتج";
  const points = pickTopPoints(p.generated_selling_points ?? [], 3);
  const hook = `Hook (0-2s): "محتاج/ة حل سريع لـ…؟ جرب/ي ${title}!"`;
  const demo = points.length
    ? `Demo (2-12s):\n- ${points.join("\n- ")}`
    : "Demo (2-12s): ورّينا المنتج في الاستخدام الحقيقي (قبل/بعد)";
  const cta = "CTA (آخر 2s): \"ابعت كلمة (سعر) في الخاص وهبعتلك التفاصيل\"";

  return [hook, "", demo, "", cta].join("\n");
}

export default function ContentStudio() {
  const { toast } = useToast();
  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("none");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        if (!userId) throw new Error("Unauthorized");

        const { data, error } = await supabase
          .from("extracted_products")
          .select(
            "id, product_title, original_price, generated_description, generated_short_post, generated_hashtags, generated_selling_points, created_at, source_url",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;

        setItems((data ?? []) as ProductRow[]);
      } catch (err) {
        toast({ title: "خطأ", description: sanitizeErrorMessage(err), variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  const outputs = useMemo(() => {
    if (!selected) return null;
    return {
      facebook: buildFacebookPost(selected),
      whatsapp: buildWhatsAppReply(selected),
      video: buildShortVideoScript(selected),
    };
  }, [selected]);

  const copy = async (text: string, label: string) => {
    try {
      await copyToClipboard(text);
      toast({ title: "تم النسخ", description: label });
    } catch {
      toast({ title: "خطأ", description: "تعذر النسخ", variant: "destructive" });
    }
  };

  const shareWhatsApp = () => {
    if (!selected || !outputs) return;
    // Reuse existing WhatsApp formatter if available, otherwise share our message
    const text =
      buildWhatsAppText?.({
        title: selected.product_title ?? "",
        price: selected.original_price ?? "",
        description: selected.generated_description ?? "",
        sellingPoints: selected.generated_selling_points ?? [],
        hashtags: selected.generated_hashtags ?? [],
      }) ?? outputs.whatsapp;

    openWhatsAppShare(text);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Content Studio</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              توليد بوست فيسبوك + رسالة واتساب + سكريبت فيديو من نفس بيانات المنتج (بدون استهلاك رصيد AI).
            </div>
          </div>
        </div>

        <Card className="p-6">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-sm font-medium">اختر منتج من المكتبة</div>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "جارٍ التحميل…" : "اختر منتج"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {items.map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.product_title ?? "(بدون عنوان)"} · {formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loading && items.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  المكتبة فاضية—روح لـ /extract واعمل استخراج أولاً.
                </div>
              ) : null}
            </div>

            {selected && outputs ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">بوست فيسبوك</div>
                    <Button size="sm" variant="secondary" onClick={() => copy(outputs.facebook, "بوست فيسبوك")}>نسخ</Button>
                  </div>
                  <Textarea value={outputs.facebook} readOnly className="min-h-[240px]" />
                </Card>

                <Card className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">رسالة واتساب</div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={shareWhatsApp}>فتح واتساب</Button>
                      <Button size="sm" variant="secondary" onClick={() => copy(outputs.whatsapp, "رسالة واتساب")}>نسخ</Button>
                    </div>
                  </div>
                  <Textarea value={outputs.whatsapp} readOnly className="min-h-[240px]" />
                </Card>

                <Card className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">سكريبت فيديو قصير</div>
                    <Button size="sm" variant="secondary" onClick={() => copy(outputs.video, "سكريبت فيديو")}>نسخ</Button>
                  </div>
                  <Textarea value={outputs.video} readOnly className="min-h-[240px]" />
                </Card>
              </div>
            ) : null}
          </div>
        </Card>
      </main>
    </div>
  );
}
