import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { sanitizeErrorMessage } from "@/lib/errors";
import { supabase } from "@/integrations/supabase/client";

export default function Spy() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [raw, setRaw] = useState("");
  const [improved, setImproved] = useState("");

  const run = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setRaw("");
    setImproved("");
    try {
      const { data, error } = await supabase.functions.invoke("fb-spy-improve", {
        body: { url },
      });
      if (error) throw error;
      setRaw((data as any)?.rawText ?? "");
      setImproved((data as any)?.improved ?? "");
      toast({ title: "تم" });
    } catch (err) {
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
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.facebook.com/..." />
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
