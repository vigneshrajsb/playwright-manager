"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromptSettingsTab } from "@/components/settings/prompt-settings-tab";

export default function SettingsPage() {
  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your Playwright Manager instance
        </p>
      </div>

      <Tabs defaultValue="prompt" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="general" disabled>
            General
          </TabsTrigger>
          <TabsTrigger value="integrations" disabled>
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prompt" className="space-y-4">
          <PromptSettingsTab />
        </TabsContent>

        <TabsContent value="general">
          <p className="text-muted-foreground">Coming soon</p>
        </TabsContent>

        <TabsContent value="integrations">
          <p className="text-muted-foreground">Coming soon</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
