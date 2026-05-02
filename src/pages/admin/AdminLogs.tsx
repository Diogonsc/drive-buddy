import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminSection } from "@/components/admin/AdminSection";
import { EmptyState } from "@/components/admin/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchAllLogs, type SyncLogRow } from "@/services/admin/adminQueries";
import type { MediaType } from "@/components/ui/ActivityLog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Filter,
  RefreshCw,
  Download,
  Calendar as CalendarIcon,
  Search,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Shield,
  ScrollText,
  Image,
  Video,
  FileAudio,
  FileText,
} from "@/lib/icons";
import { toast } from "sonner";

const MediaIcon = ({ type }: { type: MediaType }) => {
  const iconClass = "h-4 w-4";
  switch (type) {
    case "image":
      return <Image className={cn(iconClass, "text-blue-500")} />;
    case "video":
      return <Video className={cn(iconClass, "text-purple-500")} />;
    case "audio":
      return <FileAudio className={cn(iconClass, "text-orange-500")} />;
    case "document":
      return <FileText className={cn(iconClass, "text-emerald-500")} />;
    default:
      return <FileText className={iconClass} />;
  }
};

const mapMediaType = (fileType: string): MediaType => {
  if (fileType === "image" || fileType === "video" || fileType === "audio" || fileType === "document") {
    return fileType;
  }
  return "document";
};

/** Tipo de mídia exibível como em /logs — inferido de metadata quando existir. */
function inferMediaTypeFromSyncLog(row: SyncLogRow): MediaType {
  const meta = row.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const ft = meta.file_type ?? meta.media_type;
    if (typeof ft === "string") return mapMediaType(ft);
    const fp = meta.folder_path;
    if (typeof fp === "string") {
      const folderToType: Record<string, MediaType> = {
        Imagens: "image",
        Videos: "video",
        Audios: "audio",
        Documentos: "document",
      };
      for (const seg of fp.split("/")) {
        if (folderToType[seg]) return folderToType[seg];
      }
    }
  }
  return "document";
};

const statusOptions = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendente" },
  { value: "processing", label: "Processando" },
  { value: "completed", label: "Concluído" },
  { value: "failed", label: "Erro" },
];

const ITEMS_PER_PAGE = 15;

/**
 * Logs do Sistema — sync_logs com filtros, paginação e export.
 * Usa AppLayout global. Apenas leitura.
 */
export default function AdminLogs() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<SyncLogRow | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [
      "admin-all-logs",
      statusFilter,
      actionFilter,
      userIdFilter,
      dateFrom?.toISOString(),
      dateTo?.toISOString(),
    ],
    queryFn: () =>
      fetchAllLogs({
        status: statusFilter,
        action: actionFilter,
        userId: userIdFilter,
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
      }),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (r) =>
        (r.action && r.action.toLowerCase().includes(q)) ||
        (r.message && r.message.toLowerCase().includes(q)) ||
        (r.user_id && r.user_id.toLowerCase().includes(q)) ||
        (r.source && r.source.toLowerCase().includes(q))
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const handleExport = () => {
    const headers = ["Data", "user_id", "action", "status", "message", "source"];
    const rows = filtered.map((r) => [
      format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
      r.user_id,
      r.action,
      r.status,
      (r.message ?? "").replace(/"/g, '""'),
      r.source ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((row) => row.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin_logs_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exportados");
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setActionFilter("");
    setUserIdFilter("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearch("");
    setPage(1);
  };

  const hasFilters =
    statusFilter !== "all" ||
    !!actionFilter ||
    !!userIdFilter ||
    !!dateFrom ||
    !!dateTo ||
    !!search.trim();

  const statusBadge = (s: string) => {
    const v = s === "failed" ? "destructive" : s === "completed" ? "default" : "secondary";
    return <Badge variant={v}>{s}</Badge>;
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Logs do Sistema
          </h1>
        </div>
        <p className="text-muted-foreground">
          sync_logs — auditoria e suporte. Apenas leitura.
        </p>
      </div>

      <div className="space-y-6 min-w-0 overflow-x-hidden">
        {/* Filtros */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
            <CardDescription>
              status, ação, user_id, período e busca em action/message/source.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 min-w-0">
              <div className="relative min-w-0 lg:col-span-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Ação (contém)"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
              <Input
                placeholder="user_id (exato)"
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "De"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={!filtered.length}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Logs */}
        <AdminSection>
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : paginated.length === 0 ? (
                <EmptyState
                  icon={ScrollText}
                  title="Nenhum registro"
                  description={hasFilters ? "Tente ajustar os filtros." : "Não há logs em sync_logs."}
                />
              ) : (
                <>
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <Table className="w-full min-w-[820px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Tipo</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>user_id</TableHead>
                          <TableHead>action</TableHead>
                          <TableHead>status</TableHead>
                          <TableHead className="max-w-[200px]">message</TableHead>
                          <TableHead className="w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginated.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                                <MediaIcon type={inferMediaTypeFromSyncLog(r)} />
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {r.user_id.slice(0, 8)}…
                            </TableCell>
                            <TableCell>{r.action}</TableCell>
                            <TableCell>{statusBadge(r.status)}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground">
                              {r.message ?? "—"}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDetail(r)}
                                aria-label="Ver detalhes"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} de{" "}
                        {filtered.length}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </AdminSection>
      </div>

      {/* Painel lateral de detalhes (mesmo padrão da tela /logs) */}
      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {detail && <MediaIcon type={inferMediaTypeFromSyncLog(detail)} />}
              Detalhe do log
            </SheetTitle>
            <SheetDescription>
              Registro em sync_logs — auditoria e suporte. Apenas leitura.
            </SheetDescription>
          </SheetHeader>

          {detail && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">status</span>
                {statusBadge(detail.status)}
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Tipo</span>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <MediaIcon type={inferMediaTypeFromSyncLog(detail)} />
                  </div>
                  <span className="text-sm font-medium capitalize">
                    {inferMediaTypeFromSyncLog(detail)}
                  </span>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Identificação
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">id</span>
                    <span className="font-mono text-xs text-right break-all">{detail.id}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">created_at</span>
                    <span className="text-right">
                      {format(new Date(detail.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">user_id</span>
                    <span className="font-mono text-xs text-right break-all">{detail.user_id}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">media_file_id</span>
                    <span className="font-mono text-xs text-right break-all">
                      {detail.media_file_id ?? "—"}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Evento
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">action</span>
                    <span className="font-medium text-right break-all">{detail.action}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">source</span>
                    <span className="font-mono text-xs text-right break-all">
                      {detail.source ?? "—"}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  message
                </p>
                <p className="text-sm break-words rounded-lg bg-muted/50 p-3">
                  {detail.message ?? "—"}
                </p>
              </div>

              {detail.metadata != null && Object.keys(detail.metadata).length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      metadata (JSON)
                    </p>
                    <ScrollArea className="h-48 rounded-md border p-3">
                      <pre className="font-mono text-xs whitespace-pre-wrap break-all">
                        {JSON.stringify(detail.metadata, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
