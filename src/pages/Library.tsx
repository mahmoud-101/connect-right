import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language";
import { formatDistanceToNow } from "date-fns";
import { sanitizeErrorMessage } from "@/lib/errors";

type Filter = "all" | "7" | "30";

export default function Library() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  const since = useMemo(() => {
    if (filter === "7") return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    if (filter === "30") return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return null;
  }, [filter]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Unauthorized");

      let q = supabase
        .from("extracted_products")
        .select("id, product_title, product_image_urls, generated_image_urls, created_at, generated_short_post")
        .eq("user_id", userId)
        .eq("is_saved", true)
        .order("created_at", { ascending: false });
      if (since) q = q.gte("created_at", since);
      const { data, error } = await q;
      if (error) throw error;
      setItems(data ?? []);
    } catch (err) {
      toast({ title: "Error", description: sanitizeErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const del = async (id: string) => {
    try {
      const { error } = await supabase.from("extracted_products").delete().eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      toast({ title: "Error", description: sanitizeErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t("library")}</h1>
          <div className="flex gap-2">
            <Button variant={filter === "all" ? "default" : "secondary"} onClick={() => setFilter("all")}>
              All
            </Button>
            <Button variant={filter === "7" ? "default" : "secondary"} onClick={() => setFilter("7")}>
              7d
            </Button>
            <Button variant={filter === "30" ? "default" : "secondary"} onClick={() => setFilter("30")}>
              30d
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No saved products yet.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <Card key={it.id} className="p-4">
                {(it.generated_image_urls?.[0] || it.product_image_urls?.[0]) && (
                  <img
                    src={it.generated_image_urls?.[0] ?? it.product_image_urls?.[0]}
                    alt={it.product_title ?? "product"}
                    className="mb-3 h-40 w-full rounded-md object-cover"
                    loading="lazy"
                  />
                )}
                <div className="text-sm font-semibold">{it.product_title ?? "(No title)"}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={() => del(it.id)}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
