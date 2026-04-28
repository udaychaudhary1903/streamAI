"use client";

import { 
    Sidebar,
    SidebarContent, 
    SidebarGroup, 
    SidebarMenu, 
    SidebarMenuButton, 
    SidebarMenuItem 
} from "@/components/ui/sidebar";

import Link from "next/link";
import { LogOutIcon, RadioIcon, VideoIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { StudioSidebarHeader } from "./studio-sidebar-header";

export const StudioSidebar = () => {
    const pathname = usePathname();

    return (
        <Sidebar className="pt-16 z-40" collapsible="icon">
          <SidebarContent className="bg-background">
            <SidebarGroup>
              <SidebarMenu>
                <StudioSidebarHeader />

                {/* Content (Videos) */}
                <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={pathname === "/studio"} 
                      tooltip="Content" 
                      asChild
                    >
                        <Link prefetch href="/studio">
                            <VideoIcon className="size-5"/>
                            <span className="text-sm">Content</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Go Live */}
                <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={pathname.startsWith("/studio/livestreams")} 
                      tooltip="Go Live" 
                      asChild
                      className="hover:!bg-gray-100 hover:!text-red-600 transition-colors"
                    >
                        <Link prefetch href="/studio/livestreams/new">
                            <RadioIcon className="size-5 text-red-500"/>
                            <span className="text-sm">Go Live</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>

                <Separator />

                {/* Exit Studio */}
                <SidebarMenuItem>
                    <SidebarMenuButton 
                      tooltip="Exit Studio" 
                      asChild
                    >
                        <Link prefetch href="/">
                            <LogOutIcon className="size-5"/>
                            <span className="text-sm">Exit Studio</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>

              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
    );
};