import { useMemo, useState } from "react";
import Papa from "papaparse";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeErrorMessage } from "@/lib/errors";

type ResultRow = {
  url: string;
  status: "queued" | "ok" | "error";
  message?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function Bulk() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [doneCount, setDoneCount] = useState(0);

  const progress = useMemo(() => {
    const total = results.length || 1;
    return Math.round((doneCount / total) * 100);
  }, [results.length, doneCount]);

  const parseCsvUrls = async (f: File) => {
    const text = await f.text();
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
    const rows = (parsed.data ?? []) as any[];
    const urls = rows
      .flatMap((r) => (Array.isArray(r) ? r : [r]))
      .map((x) => String(x ?? "").trim())
      .filter((x) => x.startsWith("http"));
    return Array.from(new Set(urls));
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setDoneCount(0);
    try {
      const urls = await parseCsvUrls(file);
      if (!urls.length) throw new Error("CSV must include URLs (http/https)");

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan")
        .eq("user_id", userId)
        .maybeSingle();
      const plan = profile?.subscription_plan ?? "free";
      const cap = plan === "pro" ? 100 : 20;
      const batch = urls.slice(0, cap);

      setResults(batch.map((u) => ({ url: u, status: "queued" })));

      for (let i = 0; i < batch.length; i++) {
        const url = batch[i];
        try {
          const { data, error } = await supabase.functions.invoke("generate-product-content", {
            body: { url, tone: "casual", section: "all" },
          });
          if (error) throw error;
          if ((data as any)?.error) throw new Error(String((data as any).error));
          setResults((prev) => prev.map((r) => (r.url === url ? { ...r, status: "ok" } : r)));
        } catch (err) {
          setResults((prev) =>
            prev.map((r) => (r.url === url ? { ...r, status: "error", message: sanitizeErrorMessage(err) } : r)),
          );
        } finally {
          setDoneCount((c) => c + 1);
        }
        await sleep(250);
      }

      toast({ title: "انتهت المعالجة" });
    } catch (err) {
      toast({ title: "خطأ", description: sanitizeErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Bulk CSV Upload</h1>
        <p className="mt-1 text-sm text-muted-foreground">ارفع CSV فيه روابط (عمود واحد). Free: 20 / Pro: 100</p>
      </div>

      <Card className="p-6">
        <div className="grid gap-4">
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex gap-2">
            <Button onClick={run} disabled={!file || busy}>
              {busy ? "جارٍ المعالجة…" : "Start batch"}
            </Button>
          </div>

          {results.length ? (
            <div className="grid gap-2">
              <Progress value={progress} />
              <div className="text-xs text-muted-foreground">{doneCount}/{results.length}</div>
              <div className="grid gap-2">
                {results.map((r) => (
                  <div key={r.url} className="rounded-md border p-3 text-sm">
                    <div className="truncate font-medium">{r.url}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.status === "queued" ? "Queued" : r.status === "ok" ? "OK" : `Error: ${r.message}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </main>
  );
}
