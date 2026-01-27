import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/language";
import { useSession } from "@/hooks/useSession";

const Index = () => {
  const { lang, t, setLang } = useLanguage();
  const { session } = useSession();

  const primaryHref = session ? "/extract" : "/auth";

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-6">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-primary" aria-hidden="true" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">SellFast</div>
            <div className="text-xs text-muted-foreground">بيع سريع</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          >
            {lang === "ar" ? "English" : "العربية"}
          </Button>
          <Button asChild>
            <Link to={primaryHref}>{t("tryFree")}</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-14 pt-6 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <h1 className="text-balance text-4xl font-semibold leading-tight md:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="max-w-prose text-lg text-muted-foreground">{t("heroSub")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <Link to={primaryHref}>{t("ctaPrimary")}</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/extract">{t("ctaSeeApp")}</Link>
            </Button>
          </div>
        </div>

        <Card className="p-6">
          <div className="grid gap-4">
            <div className="grid gap-1">
              <div className="text-sm font-medium">1) {t("stepPaste")}</div>
              <div className="text-sm text-muted-foreground">{t("stepPasteDesc")}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-sm font-medium">2) {t("stepExtract")}</div>
              <div className="text-sm text-muted-foreground">{t("stepExtractDesc")}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-sm font-medium">3) {t("stepPost")}</div>
              <div className="text-sm text-muted-foreground">{t("stepPostDesc")}</div>
            </div>
          </div>
        </Card>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <div className="text-sm text-muted-foreground">{t("stat1")}</div>
            <div className="mt-1 text-2xl font-semibold">+500</div>
          </Card>
          <Card className="p-5">
            <div className="text-sm text-muted-foreground">{t("stat2")}</div>
            <div className="mt-1 text-2xl font-semibold">30s</div>
          </Card>
          <Card className="p-5">
            <div className="text-sm text-muted-foreground">{t("stat3")}</div>
            <div className="mt-1 text-2xl font-semibold">95%</div>
          </Card>
        </div>
      </section>
    </main>
  );
};

export default Index;
