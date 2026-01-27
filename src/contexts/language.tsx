import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "ar" | "en";

type Dictionary = Record<string, { ar: string; en: string }>;

const dict: Dictionary = {
  tryFree: { ar: "جرّب مجاناً", en: "Try Free" },
  heroTitle: { ar: "من أي لينك لبوست عربي جاهز في 30 ثانية ⚡", en: "From any link to an Arabic post in 30 seconds ⚡" },
  heroSub: {
    ar: "أداة AI للبائعين على فيسبوك وإنستجرام — استخرج أي منتج واحصل على محتوى عربي جاهز للنشر فوراً.",
    en: "AI tool for social sellers — extract any product and get Arabic content ready to post instantly.",
  },
  ctaPrimary: { ar: "ابدأ الآن", en: "Get started" },
  ctaSeeApp: { ar: "ادخل للتجربة", en: "Open app" },

  stepPaste: { ar: "الصق الرابط", en: "Paste the URL" },
  stepPasteDesc: { ar: "انسخ رابط أي منتج من أي موقع.", en: "Paste any product link from any website." },
  stepExtract: { ar: "اضغط استخراج", en: "Click extract" },
  stepExtractDesc: { ar: "سنستخرج البيانات ونولد المحتوى.", en: "We extract data and generate content." },
  stepPost: { ar: "انسخ وانشر", en: "Copy & post" },
  stepPostDesc: { ar: "محتوى جاهز للنشر على فيسبوك/إنستجرام.", en: "Ready to post on Facebook/Instagram." },

  stat1: { ar: "منتج يتم استخراجه يومياً", en: "Products extracted daily" },
  stat2: { ar: "متوسط وقت التوليد", en: "Avg generation time" },
  stat3: { ar: "معدل رضا المستخدمين", en: "User satisfaction" },

  email: { ar: "البريد الإلكتروني", en: "Email" },
  password: { ar: "كلمة المرور", en: "Password" },
  fullName: { ar: "الاسم", en: "Full name" },
  login: { ar: "تسجيل الدخول", en: "Log in" },
  signup: { ar: "إنشاء حساب", en: "Sign up" },
  logout: { ar: "تسجيل الخروج", en: "Log out" },

  extractTitle: { ar: "استخرج واكتب", en: "Extract & Generate" },
  pasteUrl: { ar: "الصق رابط المنتج هنا", en: "Paste product URL here" },
  tone: { ar: "الأسلوب", en: "Tone" },
  casual: { ar: "شبابي", en: "Casual" },
  professional: { ar: "احترافي", en: "Professional" },
  luxury: { ar: "فاخر", en: "Luxury" },
  friendly: { ar: "ودود", en: "Friendly" },
  extracting: { ar: "جاري استخراج بيانات المنتج...", en: "Extracting product data..." },
  generating: { ar: "جاري توليد المحتوى...", en: "Generating content..." },

  save: { ar: "حفظ", en: "Save" },
  copyAll: { ar: "نسخ الكل", en: "Copy all" },
  exportPdf: { ar: "تصدير PDF", en: "Export PDF" },
  extractAnother: { ar: "منتج آخر", en: "Another product" },

  library: { ar: "المكتبة", en: "Library" },
  settings: { ar: "الإعدادات", en: "Settings" },
};

type LanguageContextValue = {
  lang: AppLanguage;
  setLang: (l: AppLanguage) => void;
  t: (key: keyof typeof dict) => string;
  dir: "rtl" | "ltr";
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<AppLanguage>(() => {
    const stored = localStorage.getItem("app_lang") as AppLanguage | null;
    return stored === "en" || stored === "ar" ? stored : "ar";
  });

  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    localStorage.setItem("app_lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang,
      dir,
      t: (key) => dict[key][lang],
    }),
    [lang, dir],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
