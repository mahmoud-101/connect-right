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
import { Wand2, Image as ImageIcon, Sparkles, Eye, Upload, Download, Settings as SettingsIcon } from "lucide-react";

const items = [
  { title: "Extraction", url: "/extract", icon: Wand2 },
  { title: "Image Optimizer", url: "/optimizer", icon: ImageIcon },
  { title: "Templates", url: "/templates", icon: Sparkles },
  { title: "Spy", url: "/spy", icon: Eye },
  { title: "Bulk", url: "/bulk", icon: Upload },
  { title: "Export", url: "/export", icon: Download },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
];

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
          <SidebarGroupLabel>SellFast</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
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
