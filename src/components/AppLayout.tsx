import { Link, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { useLanguage } from "@/contexts/language";

export function AppLayout() {
  const { t } = useLanguage();
  return (
    <SidebarProvider>
      <div className="min-h-svh w-full">
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <Outlet />

          <footer className="border-t bg-background">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-3">
                <span>Ready for Easy Orders ✓ FB ✓ WhatsApp</span>
                <Link to="/help" className="underline underline-offset-4">
                  {t("helpTitle")}
                </Link>
              </div>
              <div>SellFast</div>
            </div>
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
