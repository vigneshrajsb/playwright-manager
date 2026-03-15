import { Suspense } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Loader2 } from "lucide-react";

function LoadingFallback() {
  return (
    <div className="flex h-[400px] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-1 flex-col p-6 min-w-0 overflow-hidden">
          <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
