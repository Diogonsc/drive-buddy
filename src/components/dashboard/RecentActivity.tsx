import { ActivityLog, LogEntry } from "@/components/ui/ActivityLog";
import { Button } from "@/components/ui/button";
import { ArrowRight, RefreshCw } from "lucide-react";

interface RecentActivityProps {
  entries: LogEntry[];
  onRefresh: () => void;
  onViewAll: () => void;
  isLoading?: boolean;
}

export function RecentActivity({ entries, onRefresh, onViewAll, isLoading }: RecentActivityProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-soft">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="font-semibold text-foreground">Atividade Recente</h2>
          <p className="text-sm text-muted-foreground">Últimos arquivos processados</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={onViewAll}>
            Ver tudo
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-2">
        <ActivityLog entries={entries.slice(0, 8)} />
      </div>
    </div>
  );
}
