import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/language";
import { useSession } from "@/hooks/useSession";
import { Sparkles, Link2, Wand2, Copy } from "lucide-react";

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

      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="absolute -top-24 start-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-24 start-1/3 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        </div>

        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-14 pt-8 md:grid-cols-2 md:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="h-4 w-4" />
              <span>{lang === "ar" ? "محتوى عربي جاهز للنشر" : "Arabic content ready to post"}</span>
            </div>

            <h1 className="text-balance text-4xl font-semibold leading-tight md:text-6xl">
              {t("heroTitle")}
            </h1>
            <p className="max-w-prose text-lg text-muted-foreground">{t("heroSub")}</p>

            <div className="flex flex-wrap items-center gap-3">
              <Link to={primaryHref}>
                <Button size="lg">{t("ctaPrimary")}</Button>
              </Link>
              <Link to="/extract">
                <Button size="lg" variant="secondary">
                  {t("ctaSeeApp")}
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
              <span>{lang === "ar" ? "يدعم AliExpress / Amazon / 1688" : "Works with AliExpress / Amazon / 1688"}</span>
              <span>{lang === "ar" ? "تعديل قبل النسخ أو التصدير" : "Edit before copy or export"}</span>
            </div>
          </div>

          <Card className="p-6">
            <div className="grid gap-4">
              <div className="grid gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md border bg-background p-2 text-muted-foreground">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <div className="grid gap-1">
                    <div className="text-sm font-medium">1) {t("stepPaste")}</div>
                    <div className="text-sm text-muted-foreground">{t("stepPasteDesc")}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md border bg-background p-2 text-muted-foreground">
                    <Wand2 className="h-4 w-4" />
                  </div>
                  <div className="grid gap-1">
                    <div className="text-sm font-medium">2) {t("stepExtract")}</div>
                    <div className="text-sm text-muted-foreground">{t("stepExtractDesc")}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md border bg-background p-2 text-muted-foreground">
                    <Copy className="h-4 w-4" />
                  </div>
                  <div className="grid gap-1">
                    <div className="text-sm font-medium">3) {t("stepPost")}</div>
                    <div className="text-sm text-muted-foreground">{t("stepPostDesc")}</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 rounded-lg border bg-muted/30 p-4">
                <div className="text-sm font-medium">
                  {lang === "ar" ? "جاهز لفيسبوك/إنستجرام" : "Ready for Facebook/Instagram"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {lang === "ar" ? "بوست + وصف + هاشتاجات + تسعير مقترح" : "Post + description + hashtags + pricing suggestions"}
                </div>
              </div>
            </div>
          </Card>
        </div>
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
        <div className="mb-5">
          <h2 className="text-2xl font-semibold">{t("examplesTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("examplesSub")}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6">
            <div className="text-sm font-semibold">{lang === "ar" ? "بوست قصير" : "Short post"}</div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {lang === "ar"
                ? "✨ عرض خاص النهارده!\nمنتج عملي وخفيف… مناسب للبيت والسفر.\nاطلبه دلوقتي وسيبنا الباقي 🔥"
                : "✨ Limited offer today!\nPractical, lightweight, perfect for home & travel.\nOrder now and let us handle the rest 🔥"}
            </p>
          </Card>
          <Card className="p-6">
            <div className="text-sm font-semibold">{lang === "ar" ? "نقاط بيع" : "Selling points"}</div>
            <ul className="mt-3 list-disc space-y-1 ps-6 text-sm text-muted-foreground">
              <li>{lang === "ar" ? "سهل الاستخدام" : "Easy to use"}</li>
              <li>{lang === "ar" ? "خامة متينة" : "Durable quality"}</li>
              <li>{lang === "ar" ? "مناسب كهدية" : "Great as a gift"}</li>
              <li>{lang === "ar" ? "تسليم سريع" : "Fast delivery"}</li>
            </ul>
          </Card>
          <Card className="p-6">
            <div className="text-sm font-semibold">{lang === "ar" ? "هاشتاجات" : "Hashtags"}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {lang === "ar"
                ? "#تسوق #عروض #منتجات #مصر #السعودية #الامارات #اونلاين #جملة #خصومات #بيع"
                : "#shopping #deals #products #egypt #ksa #uae #online #wholesale #discount #sell"}
            </p>
          </Card>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <h2 className="mb-4 text-2xl font-semibold">{t("pricingTitle")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6">
            <div className="text-sm font-semibold">{lang === "ar" ? "مجاني" : "Free"}</div>
            <div className="mt-2 text-3xl font-semibold">0</div>
            <ul className="mt-4 list-disc space-y-1 ps-6 text-sm text-muted-foreground">
              <li>{lang === "ar" ? "10 منتجات / شهر" : "10 products / month"}</li>
              <li>{lang === "ar" ? "محتوى عربي" : "Arabic content"}</li>
              <li>{lang === "ar" ? "استخراج أساسي" : "Basic extraction"}</li>
            </ul>
            <Link to={primaryHref}>
              <Button className="mt-6 w-full">{lang === "ar" ? "ابدأ مجاناً" : "Start free"}</Button>
            </Link>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-semibold">{lang === "ar" ? "أساسي" : "Basic"}</div>
            <div className="mt-2 text-3xl font-semibold">199 EGP</div>
            <div className="text-sm text-muted-foreground">$15 (Gulf)</div>
            <ul className="mt-4 list-disc space-y-1 ps-6 text-sm text-muted-foreground">
              <li>{lang === "ar" ? "50 منتج / شهر" : "50 products / month"}</li>
              <li>{lang === "ar" ? "3 أساليب كتابة" : "3 writing styles"}</li>
              <li>{lang === "ar" ? "حفظ حتى 50 منتج" : "Save up to 50 products"}</li>
              <li>{lang === "ar" ? "تصدير PDF" : "PDF export"}</li>
            </ul>
            <Link to={primaryHref}>
              <Button className="mt-6 w-full">{lang === "ar" ? "ابدأ الآن" : "Start now"}</Button>
            </Link>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-semibold">{lang === "ar" ? "برو" : "Pro"}</div>
            <div className="mt-2 text-3xl font-semibold">399 EGP</div>
            <div className="text-sm text-muted-foreground">$30 (Gulf)</div>
            <ul className="mt-4 list-disc space-y-1 ps-6 text-sm text-muted-foreground">
              <li>{lang === "ar" ? "منتجات غير محدودة" : "Unlimited products"}</li>
              <li>{lang === "ar" ? "كل مزايا الباقة الأساسية" : "All Basic features"}</li>
              <li>{lang === "ar" ? "حفظ غير محدود" : "Unlimited saved products"}</li>
              <li>{lang === "ar" ? "دعم أولوية" : "Priority support"}</li>
            </ul>
            <Link to={primaryHref}>
              <Button className="mt-6 w-full" variant="secondary">{lang === "ar" ? "ترقية" : "Upgrade"}</Button>
            </Link>
          </Card>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-20">
        <h2 className="mb-4 text-2xl font-semibold">{t("faqTitle")}</h2>
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
