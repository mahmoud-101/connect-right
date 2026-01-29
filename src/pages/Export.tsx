import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { sanitizeErrorMessage } from "@/lib/errors";
import { buildEasyOrdersRow, toEasyOrdersCsv } from "@/lib/easyOrders";
import { createZipBundle, downloadBlob } from "@/lib/zipBundle";

type ProductRow = Database["public"]["Tables"]["extracted_products"]["Row"];

export default function Export() {
  const { toast } = useToast();
  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("none");
  const [category, setCategory] = useState("Electronics");
  const [stock, setStock] = useState("100");

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
            "id, product_title, original_price, generated_description, generated_short_post, generated_hashtags, generated_selling_points, product_image_urls, generated_image_urls, cover_image_url, created_at",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100);
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

  const images = useMemo(() => {
    if (!selected) return [] as string[];
    const all = [
      selected.cover_image_url,
      ...(selected.generated_image_urls ?? []),
      ...(selected.product_image_urls ?? []),
    ].filter(Boolean) as string[];
    return Array.from(new Set(all)).slice(0, 10);
  }, [selected]);

  const easyOrdersCsv = useMemo(() => {
    if (!selected) return "";
    const row = buildEasyOrdersRow({
      name: selected.product_title,
      description: selected.generated_description ?? selected.generated_short_post ?? "",
      price: selected.original_price,
      imageUrls: images,
      category,
      stock,
    });
    return toEasyOrdersCsv([row]);
  }, [selected, images, category, stock]);

  const bundleText = useMemo(() => {
    if (!selected) return "";
    const hashtags = (selected.generated_hashtags ?? []).join(" ");
    const points = (selected.generated_selling_points ?? []).filter(Boolean).map((p) => `✓ ${p}`).join("\n");
    return [
      selected.product_title ?? "",
      selected.original_price ? `السعر: ${selected.original_price}` : "",
      "",
      selected.generated_short_post ?? "",
      "",
      selected.generated_description ?? "",
      "",
      points,
      "",
      hashtags,
    ]
      .filter(Boolean)
      .join("\n")
      .trim();
  }, [selected]);

  const downloadCsv = () => {
    const blob = new Blob([easyOrdersCsv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, "easy-orders.csv");
  };

  const downloadZip = async () => {
    if (!selected) return;
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
    } catch (err) {
      toast({ title: "خطأ", description: sanitizeErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Easy Orders Export</h1>
        <p className="mt-1 text-sm text-muted-foreground">1) Download Easy Orders CSV → 2) Easy Orders → Products → Import CSV</p>
      </div>

      <Card className="p-6">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="text-sm font-medium">اختر منتج</div>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "جارٍ التحميل…" : "اختر منتج"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {items.map((it) => (
                  <SelectItem key={it.id} value={it.id}>
                    {it.product_title ?? "(بدون عنوان)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <div className="text-sm font-medium">Category</div>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <div className="text-sm font-medium">Stock</div>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={downloadCsv} disabled={!selected || !easyOrdersCsv}>
              Download Easy Orders CSV
            </Button>
            <Button variant="secondary" onClick={downloadZip} disabled={!selected || !easyOrdersCsv}>
              Download ZIP bundle
            </Button>
          </div>

          {selected ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-4">
                <div className="text-sm font-semibold">CSV Preview</div>
                <Textarea value={easyOrdersCsv} readOnly className="mt-2 min-h-[180px]" />
              </Card>
              <Card className="p-4">
                <div className="text-sm font-semibold">Copy + Hashtags</div>
                <Textarea value={bundleText} readOnly className="mt-2 min-h-[180px]" />
              </Card>
            </div>
          ) : null}
        </div>
      </Card>
    </main>
  );
}
