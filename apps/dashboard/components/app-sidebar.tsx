"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Spotlight,
  LayoutDashboard,
  FlaskConical,
  PanelLeft,
  PanelLeftClose,
  Workflow,
  ListChecks,
  ShieldBan,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useTimeRangeUrl } from "@/hooks";

const overviewItem = {
  title: "Overview",
  path: "/",
  icon: LayoutDashboard,
};

const manageItems = [
  {
    title: "Tests",
    path: "/tests",
    icon: FlaskConical,
  },
  {
    title: "Quarantined",
    path: "/quarantined",
    icon: ShieldBan,
  },
];

const reportItems = [
  {
    title: "Pipelines",
    path: "/pipelines",
    icon: Workflow,
  },
  {
    title: "Results",
    path: "/results",
    icon: ListChecks,
  },
];

const settingsItem = {
  title: "Settings",
  path: "/settings",
  icon: Settings,
};

function AppSidebarContent() {
  const pathname = usePathname();
  const { toggleSidebar, open } = useSidebar();
  const { buildUrl } = useTimeRangeUrl();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-2 hover:opacity-80 transition-opacity"
        >
          <Spotlight className="h-5 w-5 text-primary shrink-0" />
          <span className="text-base font-semibold group-data-[collapsible=icon]:hidden">
            Playwright Manager
          </span>
        </Link>
        <Separator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleSidebar}
              tooltip={open ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {open ? (
                <>
                  <PanelLeftClose />
                  <span>Collapse Sidebar</span>
                  <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    <span className="text-xs">⌘</span>B
                  </kbd>
                </>
              ) : (
                <PanelLeft />
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="py-2">
        {/* Overview */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === overviewItem.path}
                  tooltip={overviewItem.title}
                >
                  <Link href={buildUrl(overviewItem.path)}>
                    <overviewItem.icon />
                    <span>{overviewItem.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="mx-2" />

        {/* Manage */}
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {manageItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.path}
                    tooltip={item.title}
                  >
                    <Link href={buildUrl(item.path)}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="mx-2" />

        {/* Reports */}
        <SidebarGroup>
          <SidebarGroupLabel>Reports</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {reportItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.path}
                    tooltip={item.title}
                  >
                    <Link href={buildUrl(item.path)}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="flex-1" />

        <Separator className="mx-2" />

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === settingsItem.path}
                  tooltip={settingsItem.title}
                >
                  <Link href={buildUrl(settingsItem.path)}>
                    <settingsItem.icon />
                    <span>{settingsItem.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          Self-hosted test management
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppSidebar() {
  return (
    <Suspense fallback={null}>
      <AppSidebarContent />
    </Suspense>
  );
}
