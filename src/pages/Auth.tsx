import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { useLanguage } from "@/contexts/language";

export default function Auth() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({ title: "تم إنشاء الحساب", description: "تقدر تدخل الآن" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate("/extract");
    } catch (err) {
      const message = err instanceof Error ? err.message : "حدث خطأ";
      toast({ title: "خطأ", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto grid w-full max-w-md gap-4 px-4 py-10">
        <Card className="p-6">
          <div className="mb-5 flex items-center gap-2">
            <Button
              type="button"
              variant={mode === "signup" ? "default" : "secondary"}
              onClick={() => setMode("signup")}
            >
              {t("signup")}
            </Button>
            <Button
              type="button"
              variant={mode === "login" ? "default" : "secondary"}
              onClick={() => setMode("login")}
            >
              {t("login")}
            </Button>
          </div>

          <form onSubmit={submit} className="grid gap-4">
            {mode === "signup" && (
              <div className="grid gap-2">
                <Label htmlFor="fullName">{t("fullName")}</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "..." : mode === "signup" ? t("signup") : t("login")}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
