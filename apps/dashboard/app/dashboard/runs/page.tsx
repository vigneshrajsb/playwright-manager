import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RunsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Test Runs</h1>
        <p className="text-muted-foreground">
          View history of all test runs and their results.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">
              Test runs history coming soon
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
