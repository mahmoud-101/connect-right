import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language";
import { formatDistanceToNow } from "date-fns";
import { sanitizeErrorMessage } from "@/lib/errors";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchX } from "lucide-react";

type Filter = "all" | "7" | "30";
type SortBy = "recent" | "oldest" | "title";

export default function Library() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
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
        .select(
          "id, product_title, cover_image_url, product_image_urls, generated_image_urls, created_at, generated_short_post, generated_description",
        )
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

  const filteredItems = useMemo(() => {
    let res = [...items];

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      res = res.filter((it) => {
        const title = String(it.product_title ?? "").toLowerCase();
        const desc = String(it.generated_description ?? "").toLowerCase();
        const post = String(it.generated_short_post ?? "").toLowerCase();
        return title.includes(q) || desc.includes(q) || post.includes(q);
      });
    }

    if (sortBy === "title") {
      res.sort((a, b) => (a.product_title ?? "").localeCompare(b.product_title ?? ""));
    } else if (sortBy === "oldest") {
      res.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else {
      res.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return res;
  }, [items, searchQuery, sortBy]);

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

        <div className="mb-6 grid gap-3 md:grid-cols-[1fr_220px]">
          <Input
            placeholder={t("search") ?? "ابحث في المكتبة..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger>
              <SelectValue placeholder={t("sort") ?? "فرز"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">{t("sortRecent") ?? "الأحدث"}</SelectItem>
              <SelectItem value="oldest">{t("sortOldest") ?? "الأقدم"}</SelectItem>
              <SelectItem value="title">{t("sortTitle") ?? "حسب العنوان"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="mb-3 h-40 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/2" />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md border bg-muted/30 p-2">
                <SearchX className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">لا توجد نتائج</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  جرّب/ي كلمات مختلفة، أو احفظ/ي منتجات من صفحة الاستخراج أولاً.
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3">
            <div className="text-sm text-muted-foreground">عدد النتائج: {filteredItems.length}</div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((it) => (
                <Card key={it.id} className="p-4">
                {(it.cover_image_url || it.generated_image_urls?.[0] || it.product_image_urls?.[0]) && (
                  <img
                    src={it.cover_image_url ?? it.generated_image_urls?.[0] ?? it.product_image_urls?.[0]}
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
                  <Link to={`/library/${it.id}`} className="flex-1">
                    <Button className="w-full" size="sm">
                      {t("open") ?? "Open"}
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={() => del(it.id)}>
                    Delete
                  </Button>
                </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
