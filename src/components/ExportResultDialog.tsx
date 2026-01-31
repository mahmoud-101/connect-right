import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { buildEasyOrdersRow, toEasyOrdersCsv } from "@/lib/easyOrders";
import { sanitizeErrorMessage } from "@/lib/errors";
import { track } from "@/lib/analytics";
import { createZipBundle, downloadBlob } from "@/lib/zipBundle";

type ProductRow = Pick<
  Database["public"]["Tables"]["extracted_products"]["Row"],
  | "id"
  | "product_title"
  | "original_price"
  | "generated_description"
  | "generated_short_post"
  | "generated_hashtags"
  | "generated_selling_points"
  | "product_image_urls"
  | "generated_image_urls"
  | "cover_image_url"
  | "created_at"
>;

function dedupe<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export function ExportResultDialog({ productId, disabled }: { productId: string | null; disabled?: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState<ProductRow | null>(null);
  const [category, setCategory] = useState("Electronics");
  const [stock, setStock] = useState("100");

  useEffect(() => {
    if (!open) return;
    if (!productId) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("extracted_products")
          .select(
            "id, product_title, original_price, generated_description, generated_short_post, generated_hashtags, generated_selling_points, product_image_urls, generated_image_urls, cover_image_url, created_at",
          )
          .eq("id", productId)
          .maybeSingle();
        if (error) throw error;
        setItem((data ?? null) as ProductRow | null);
      } catch (err) {
        toast({ title: "خطأ", description: sanitizeErrorMessage(err), variant: "destructive" });
        setItem(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, productId, toast]);

  const images = useMemo(() => {
    if (!item) return [] as string[];
    const all = [item.cover_image_url, ...(item.generated_image_urls ?? []), ...(item.product_image_urls ?? [])].filter(
      Boolean,
    ) as string[];
    return dedupe(all).slice(0, 10);
  }, [item]);

  const easyOrdersCsv = useMemo(() => {
    if (!item) return "";
    const row = buildEasyOrdersRow({
      name: item.product_title,
      description: item.generated_description ?? item.generated_short_post ?? "",
      price: item.original_price,
      imageUrls: images,
      category,
      stock,
    });
    return toEasyOrdersCsv([row]);
  }, [item, images, category, stock]);

  const bundleText = useMemo(() => {
    if (!item) return "";
    const hashtags = (item.generated_hashtags ?? []).join(" ");
    const points = (item.generated_selling_points ?? []).filter(Boolean).map((p) => `✓ ${p}`).join("\n");
    return [
      item.product_title ?? "",
      item.original_price ? `السعر: ${item.original_price}` : "",
      "",
      item.generated_short_post ?? "",
      "",
      item.generated_description ?? "",
      "",
      points,
      "",
      hashtags,
    ]
      .filter(Boolean)
      .join("\n")
      .trim();
  }, [item]);

  const downloadCsv = () => {
    if (!item) return;
    const blob = new Blob([easyOrdersCsv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, "easy-orders.csv");
    track("export_csv_downloaded", { source: "inline", id: item.id });
  };

  const downloadZip = async () => {
    if (!item) return;
    try {
      const zipBlob = await createZipBundle({
        files: [
          { path: "easy-orders.csv", data: easyOrdersCsv },
          { path: "copy.txt", data: bundleText },
          { path: "images/README.txt", data: images.length ? "Image URLs are in the CSV (images column)." : "No images." },
        ],
      });
      downloadBlob(zipBlob, "sellfast-bundle.zip");
      toast({ title: "تم تنزيل الباندل" });
      track("export_zip_downloaded", { source: "inline", id: item.id, images_count: images.length });
    } catch (err) {
      toast({ title: "خطأ", description: sanitizeErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={disabled || !productId}>
          تصدير
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>تصدير النتائج</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="text-sm text-muted-foreground">
            تنزيل CSV جاهز للرفع في Easy Orders أو تنزيل ZIP فيه CSV + نص جاهز للنسخ.
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <div className="text-sm font-medium">التصنيف (اختياري)</div>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <div className="text-sm font-medium">المخزون (اختياري)</div>
              <Input value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={downloadCsv} disabled={!item || !easyOrdersCsv || loading}>
              تنزيل CSV
            </Button>
            <Button variant="secondary" onClick={downloadZip} disabled={!item || !easyOrdersCsv || loading}>
              تنزيل ZIP
            </Button>
          </div>

          {item ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-4">
                <div className="text-sm font-semibold">معاينة CSV</div>
                <Textarea value={easyOrdersCsv} readOnly className="mt-2 min-h-[180px]" />
              </Card>
              <Card className="p-4">
                <div className="text-sm font-semibold">النص + الهاشتاجات</div>
                <Textarea value={bundleText} readOnly className="mt-2 min-h-[180px]" />
              </Card>
            </div>
          ) : (
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">{loading ? "جارٍ التحميل…" : "لا توجد بيانات."}</div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
