import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/language";
import { sanitizeErrorMessage } from "@/lib/errors";

export default function Settings() {
  const { lang, setLang } = useLanguage();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [plan, setPlan] = useState("free");
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Unauthorized");

      setEmailVerified(!!auth.user?.email_confirmed_at);

      const { data } = await supabase.from("profiles").select("full_name, subscription_plan, language").eq("user_id", userId).maybeSingle();
      setFullName(data?.full_name ?? "");
      setPlan(data?.subscription_plan ?? "free");
      if (data?.language === "en" || data?.language === "ar") setLang(data.language);
    } catch (err) {
      toast({ title: "Error", description: sanitizeErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Unauthorized");
      const { error } = await supabase.from("profiles").update({ full_name: fullName, language: lang }).eq("user_id", userId);
      if (error) throw error;
      toast({ title: "Saved" });
    } catch (err) {
      toast({ title: "Error", description: sanitizeErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

        <div className="grid gap-4">
          <Card className="p-6">
            <div className="grid gap-3">
              <div className="text-sm font-semibold">Account</div>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <div className="font-medium">Email verification</div>
                    <div className="mt-1 text-muted-foreground">
                      {emailVerified === null
                        ? "—"
                        : emailVerified
                          ? "Verified"
                          : "Not verified yet. Please check your inbox."}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Language</Label>
                    <div className="flex gap-2">
                      <Button variant={lang === "ar" ? "default" : "secondary"} onClick={() => setLang("ar")}>
                        العربية
                      </Button>
                      <Button variant={lang === "en" ? "default" : "secondary"} onClick={() => setLang("en")}>
                        English
                      </Button>
                    </div>
                  </div>
                  <Button onClick={save}>Save</Button>
                </>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-semibold">Plan</div>
            <div className="mt-2 text-sm text-muted-foreground">Current: {plan}</div>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" disabled>
                Upgrade (soon)
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
