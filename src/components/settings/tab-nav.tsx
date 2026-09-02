import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TabNav<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  navWidth = "220px",
}: {
  tabs: ReadonlyArray<{ value: T; label: string; icon: ReactNode }>;
  activeTab: T;
  onTabChange: (v: T) => void;
  navWidth?: string;
}) {
  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: `minmax(0,${navWidth}) 1fr` }}>
      <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto lg:flex-col">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => onTabChange(t.value)}
            aria-current={activeTab === t.value ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
              activeTab === t.value
                ? "bg-primary text-primary-foreground shadow-lift"
                : "bg-card/60 text-muted-foreground backdrop-blur-sm hover:bg-muted hover:text-foreground",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
