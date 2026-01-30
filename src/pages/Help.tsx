import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/language";
import { openWhatsAppShare } from "@/lib/whatsapp";
import { track } from "@/lib/analytics";

export default function Help() {
  const { lang, t } = useLanguage();

  const contactWhatsApp = () => {
    const msg =
      lang === "ar"
        ? "مرحبا فريق SellFast، عندي مشكلة/سؤال:"
        : "Hi SellFast team, I have an issue/question:";
    track("support_whatsapp_clicked", { page: "help" });
    openWhatsAppShare(msg);
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{t("helpTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("helpSub")}</p>
      </div>

      <div className="grid gap-4">
        <Card className="p-6">
          <div className="text-sm font-semibold">{t("helpHowItWorksTitle")}</div>
          <div className="mt-2 text-sm text-muted-foreground">{t("helpHowItWorksBody")}</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-semibold">{t("helpBlockedTitle")}</div>
          <div className="mt-2 text-sm text-muted-foreground">{t("helpBlockedBody")}</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-semibold">{t("helpSupportTitle")}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button onClick={contactWhatsApp}>{t("helpWhatsapp")}</Button>
            <div className="text-xs text-muted-foreground">{t("helpWhatsappHint")}</div>
          </div>
        </Card>
      </div>
    </main>
  );
}
