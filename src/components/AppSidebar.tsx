import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Wand2, Image as ImageIcon, Sparkles, Eye, Upload, Settings as SettingsIcon } from "lucide-react";

const contentStudioItems = [
  { title: "كتابة إعلان", url: "/extract", icon: Wand2 },
  { title: "Spy", url: "/spy", icon: Eye },
  { title: "قوالب جاهزة", url: "/templates", icon: Sparkles },
  { title: "تحسين الصور", url: "/optimizer", icon: ImageIcon },
  { title: "Bulk", url: "/bulk", icon: Upload },
  // NOTE: Export is now intended to be used as an inline dialog from results.
  // Keep the /export route for backward compatibility, but don't surface it in nav.
];

const settingsItems = [{ title: "الإعدادات", url: "/settings", icon: SettingsIcon }];

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path;
  return (
    <Sidebar collapsible="icon" className={collapsed ? "w-14" : "w-64"}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Content Studio</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {contentStudioItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    onClick={() => navigate(item.url)}
                    className="rounded-md"
                  >
                    <item.icon />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    onClick={() => navigate(item.url)}
                    className="rounded-md"
                  >
                    <item.icon />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
