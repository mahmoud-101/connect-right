import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/language";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

export function AppHeader() {
  const { lang, setLang, t } = useLanguage();
  const { session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const isApp =
    location.pathname.startsWith("/extract") ||
    location.pathname.startsWith("/library") ||
    location.pathname.startsWith("/settings") ||
    location.pathname.startsWith("/studio");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link to={session ? "/extract" : "/"} className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary" aria-hidden="true" />
          <div className="text-sm font-semibold">SellFast</div>
        </Link>

        <nav className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          >
            {lang === "ar" ? "English" : "العربية"}
          </Button>

          {isApp && (
            <>
              <Button variant="ghost" asChild>
                <Link to="/extract">/extract</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/studio">Content Studio</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/library">{t("library")}</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/settings">{t("settings")}</Link>
              </Button>
            </>
          )}

          {session ? (
            <Button variant="outline" onClick={signOut}>
              {t("logout")}
            </Button>
          ) : (
            <Link to="/auth">
              <Button>{t("tryFree")}</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
