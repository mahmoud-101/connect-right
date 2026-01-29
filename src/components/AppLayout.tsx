import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-svh w-full">
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <Outlet />

          <footer className="border-t bg-background">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
              <div>Ready for Easy Orders ✓ FB ✓ WhatsApp</div>
              <div>SellFast</div>
            </div>
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
