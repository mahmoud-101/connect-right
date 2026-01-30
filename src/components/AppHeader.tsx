import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/language";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  const { lang, setLang, t } = useLanguage();
  const { session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const isApp =
    location.pathname.startsWith("/extract") ||
    location.pathname.startsWith("/library") ||
    location.pathname.startsWith("/settings") ||
    location.pathname.startsWith("/studio") ||
    location.pathname.startsWith("/optimizer") ||
    location.pathname.startsWith("/templates") ||
    location.pathname.startsWith("/spy") ||
    location.pathname.startsWith("/bulk") ||
    location.pathname.startsWith("/export");

  const signOut = async () => {
    // Make logout deterministic even if react-router navigation is interrupted.
    // (Some embedded browsers / stale sessions can behave oddly.)
    try {
      await supabase.auth.signOut();
    } finally {
      // Use a hard redirect to ensure ProtectedRoute/session state cannot keep the user on app routes.
      window.location.assign("/auth");
    }
  };

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-3">
          {isApp ? <SidebarTrigger aria-label="Toggle sidebar" /> : null}
          <Link to={session ? "/extract" : "/"} className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary" aria-hidden="true" />
          <div className="text-sm font-semibold">SellFast</div>
          </Link>
        </div>

        <nav className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          >
            {lang === "ar" ? "English" : "العربية"}
          </Button>

          {isApp ? (
            <Button variant="ghost" asChild>
              <Link to="/extract">Open app</Link>
            </Button>
          ) : null}

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
