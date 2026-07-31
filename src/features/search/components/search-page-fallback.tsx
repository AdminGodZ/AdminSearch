import { DashRing } from "@/components/loading-ui/dash-ring";

export function SearchPageFallback() {
  return (
    <main
      aria-busy="true"
      data-search-page-loading=""
      className="flex min-h-[50dvh] w-full flex-1 items-center justify-center bg-background px-6 py-8"
    >
      <DashRing className="size-6 text-muted-foreground" />
    </main>
  );
}
