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
          <Link to={primaryHref}>
            <Button>{t("tryFree")}</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-14 pt-6 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <h1 className="text-balance text-4xl font-semibold leading-tight md:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="max-w-prose text-lg text-muted-foreground">{t("heroSub")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to={primaryHref}>
              <Button size="lg">{t("ctaPrimary")}</Button>
            </Link>
            <Link to="/extract">
              <Button size="lg" variant="secondary">{t("ctaSeeApp")}</Button>
            </Link>
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

      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <h2 className="mb-4 text-2xl font-semibold">Pricing</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6">
            <div className="text-sm font-semibold">Free</div>
            <div className="mt-2 text-3xl font-semibold">0</div>
            <ul className="mt-4 list-disc space-y-1 ps-6 text-sm text-muted-foreground">
              <li>10 products / month</li>
              <li>Arabic content only</li>
              <li>Basic extraction</li>
            </ul>
            <Link to={primaryHref}>
              <Button className="mt-6 w-full">Start free</Button>
            </Link>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-semibold">Basic</div>
            <div className="mt-2 text-3xl font-semibold">199 EGP</div>
            <div className="text-sm text-muted-foreground">$15 (Gulf)</div>
            <ul className="mt-4 list-disc space-y-1 ps-6 text-sm text-muted-foreground">
              <li>100 products / month</li>
              <li>3 writing styles</li>
              <li>Save up to 50 products</li>
              <li>PDF export</li>
            </ul>
            <Link to={primaryHref}>
              <Button className="mt-6 w-full">Start now</Button>
            </Link>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-semibold">Pro</div>
            <div className="mt-2 text-3xl font-semibold">399 EGP</div>
            <div className="text-sm text-muted-foreground">$30 (Gulf)</div>
            <ul className="mt-4 list-disc space-y-1 ps-6 text-sm text-muted-foreground">
              <li>Unlimited products</li>
              <li>All Basic features</li>
              <li>Unlimited saved products</li>
              <li>Priority support</li>
            </ul>
            <Link to={primaryHref}>
              <Button className="mt-6 w-full" variant="secondary">Upgrade</Button>
            </Link>
          </Card>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-20">
        <h2 className="mb-4 text-2xl font-semibold">FAQ</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <div className="text-sm font-semibold">هل الأداة تدعم العربية فقط؟</div>
            <div className="mt-2 text-sm text-muted-foreground">حالياً نركز على المحتوى العربي لأنه الأكثر طلباً. الإنجليزي قريباً.</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm font-semibold">ما هي المواقع المدعومة للاستخراج؟</div>
            <div className="mt-2 text-sm text-muted-foreground">AliExpress, Amazon, 1688 وأغلب مواقع التجارة الإلكترونية.</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm font-semibold">هل يمكنني تعديل المحتوى المولّد؟</div>
            <div className="mt-2 text-sm text-muted-foreground">نعم—يمكنك تعديل أي جزء قبل النسخ أو التصدير.</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm font-semibold">كيف أدفع من مصر؟</div>
            <div className="mt-2 text-sm text-muted-foreground">حاليًا الدفع قيد التجهيز (فوري/فودافون كاش/بطاقات) — قريباً.</div>
          </Card>
        </div>
      </section>
    </main>
  );
};

export default Index;
