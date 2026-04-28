import { Sidebar, SidebarContent } from "@/components/ui/sidebar"
import { MainSection } from "./main-section";
import { Separator } from "@/components/ui/separator";
import { PersonalSection } from "./personal-section";
import { Show } from "@clerk/nextjs";
import { SubscriptionsSection } from "./subscriptions-section";

export const HomeSidebar = () => {
    return (
        <Sidebar className="pt-16 z-40 border-none" collapsible="icon">
            <SidebarContent className="bg-background">
                <MainSection />
                <Separator className=" bg-blue-500"/>
                <PersonalSection />
                <Show when="signed-in">
                    <>
                      <Separator />
                      <SubscriptionsSection />
                    </>
                </Show>
            </SidebarContent>
        </Sidebar>
    );
};