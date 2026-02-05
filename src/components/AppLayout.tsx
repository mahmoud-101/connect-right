import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import { SidebarProvider } from "./ui/sidebar";
import { useLanguage } from "@/contexts/language";
import { useEffect } from "react";

const AppLayout = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  // تحديث اتجاه الصفحة في الـ DOM
  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [isRtl, language]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background" dir={isRtl ? 'rtl' : 'ltr'}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-7xl mx-auto w-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;