import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { sanitizeErrorMessage } from "@/lib/errors";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";

export default function Spy() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"url" | "paste">("url");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [raw, setRaw] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [improved, setImproved] = useState("");

  const looksLikeBlockedScrape = (err: unknown) => {
    const msg = sanitizeErrorMessage(err).toLowerCase();
    return msg.includes("blocklisted") || msg.includes("403") || msg.includes("failed to scrape");
  };

  const run = async () => {
    if (mode === "url" && !url.trim()) return;
    if (mode === "paste" && !pastedText.trim()) return;
    setLoading(true);
    setRaw("");
    setImproved("");
    try {
      track("spy_run", { mode });
      const { data, error } = await supabase.functions.invoke("fb-spy-improve", {
        body: mode === "url" ? { url } : { rawText: pastedText },
      });
      if (error) throw error;
      setRaw((data as any)?.rawText ?? "");
      setImproved((data as any)?.improved ?? "");
      toast({ title: "تم" });
      track("spy_success", { mode });
    } catch (err) {
      if (mode === "url" && looksLikeBlockedScrape(err)) {
        setMode("paste");
        toast({
          title: "الرابط محجوب",
          description: "المصدر يمنع الاستخراج من الرابط. الصق نص البوست يدويًا وسنحسّنه فورًا.",
          variant: "destructive",
        });
        track("spy_blocked_switched_to_paste", {});
        return;
      }
      track("spy_failed", { mode });
      toast({ title: "خطأ", description: sanitizeErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Competitor Spy (Public Post)</h1>
        <p className="mt-1 text-sm text-muted-foreground">حط رابط بوست عام (Public) وسنستخرج النص ونحسّنه.</p>
      </div>

      <Card className="p-6">
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={mode === "url" ? "default" : "secondary"}
              onClick={() => setMode("url")}
              disabled={loading}
            >
              رابط البوست
            </Button>
            <Button
              type="button"
              variant={mode === "paste" ? "default" : "secondary"}
              onClick={() => setMode("paste")}
              disabled={loading}
            >
              لصق النص
            </Button>
          </div>

          {mode === "url" ? (
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.facebook.com/..." />
          ) : (
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="الصق نص البوست هنا (بدون الرابط)…"
              className="min-h-[140px]"
            />
          )}
          <div className="flex gap-2">
            <Button onClick={run} disabled={loading}>
              {loading ? "جارٍ…" : "Analyze & Improve"}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <div className="text-sm font-semibold">Extracted Text</div>
              <Textarea value={raw} readOnly className="mt-2 min-h-[240px]" />
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold">AI Improved (Egypt FB)</div>
              <Textarea value={improved} readOnly className="mt-2 min-h-[240px]" />
            </Card>
          </div>
        </div>
      </Card>
    </main>
  );
}
