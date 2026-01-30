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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchAllLogs, type SyncLogRow } from "@/services/admin/adminQueries";
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
} from "lucide-react";
import { toast } from "sonner";

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

      <div className="space-y-6">
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="relative lg:col-span-2">
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
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
                    <div className="flex items-center justify-between border-t px-4 py-3">
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

      {/* Dialog de Detalhes */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhe do log</DialogTitle>
            <DialogDescription>metadata em JSON (somente leitura).</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 font-mono text-sm">
              <div>
                <p className="text-muted-foreground">id</p>
                <p className="break-all">{detail.id}</p>
              </div>
              <div>
                <p className="text-muted-foreground">created_at</p>
                <p>
                  {format(new Date(detail.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">user_id</p>
                <p className="break-all">{detail.user_id}</p>
              </div>
              <div>
                <p className="text-muted-foreground">action</p>
                <p>{detail.action}</p>
              </div>
              <div>
                <p className="text-muted-foreground">status</p>
                <p>{detail.status}</p>
              </div>
              <div>
                <p className="text-muted-foreground">message</p>
                <p className="break-words">{detail.message ?? "—"}</p>
              </div>
              {detail.metadata != null && Object.keys(detail.metadata).length > 0 && (
                <div>
                  <p className="text-muted-foreground">metadata</p>
                  <ScrollArea className="h-40 rounded-md border p-2">
                    <pre className="text-xs">
                      {JSON.stringify(detail.metadata, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
