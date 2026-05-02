import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Search,
  Calendar as CalendarIcon,
  RefreshCw,
  Download,
  Image,
  Video,
  FileAudio,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  ExternalLink,
} from "@/lib/icons";
import { LogEntry, MediaType } from "@/components/ui/ActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const mediaTypeOptions = [
  { value: "all", label: "Todos os tipos" },
  { value: "image", label: "Imagens" },
  { value: "video", label: "Vídeos" },
  { value: "audio", label: "Áudios" },
  { value: "document", label: "Documentos" },
];

const statusOptions = [
  { value: "all", label: "Todos os status" },
  { value: "success", label: "Sucesso" },
  { value: "pending", label: "Pendente" },
  { value: "error", label: "Erro" },
];

const MediaIcon = ({ type }: { type: string }) => {
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

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "success":
      return (
        <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3" />
          Sucesso
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30">
          <Clock className="h-3 w-3" />
          Pendente
        </Badge>
      );
    case "error":
      return (
        <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/30">
          <XCircle className="h-3 w-3" />
          Erro
        </Badge>
      );
    default:
      return null;
  }
};

const mapMediaType = (fileType: string): MediaType => {
  if (fileType === "image" || fileType === "video" || fileType === "audio" || fileType === "document") {
    return fileType;
  }
  return "document";
};

interface MobileLogCardProps {
  log: LogEntry;
  formatTimestamp: (date: Date) => string;
  onViewDetail: (logId: string) => void;
}

interface LogDetail {
  id: string
  file_name: string
  file_type: string
  mime_type: string | null
  file_size_bytes: number | null
  sender_phone: string | null
  sender_name: string | null
  status: string
  error_message: string | null
  received_at: string
  processed_at: string | null
  google_drive_file_id: string | null
  google_drive_url: string | null
  google_drive_folder_id: string | null
  whatsapp_message_id: string | null
}

interface TableLogEntry extends LogEntry {
  senderName: string
}

function truncateFileNameForMobile(fileName: string, maxLength = 22): string {
  if (fileName.length <= maxLength) return fileName;
  return `${fileName.slice(0, maxLength)}...`;
}


const MobileLogCard = ({ log, formatTimestamp, onViewDetail }: MobileLogCardProps) => {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <MediaIcon type={log.mediaType} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{truncateFileNameForMobile(log.fileName)}</p>
            <p className="text-xs text-muted-foreground truncate">{log.sender}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onViewDetail(log.id)}>
          <Eye className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={log.status} />
        <span className="text-xs text-muted-foreground">{formatTimestamp(log.timestamp)}</span>
      </div>

      {log.errorMessage && (
        <p className="text-xs text-destructive">{log.errorMessage}</p>
      )}
    </div>
  );
};

export default function Logs() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<TableLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<LogDetail | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const itemsPerPage = 10;

  // Função para mapear status do banco para o tipo LogStatus
  const mapStatus = (status: string): "success" | "error" | "pending" => {
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'error';
    return 'pending';
  };

  // Carregar logs do banco
  const loadLogs = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('media_files')
        .select('id, file_name, file_type, sender_phone, sender_name, status, error_message, received_at', { count: 'exact' })
        .eq('user_id', user.id)
        .order('received_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      // Aplicar filtros no backend
      if (mediaTypeFilter !== "all") {
        query = query.eq('file_type', mediaTypeFilter);
      }

      if (statusFilter !== "all") {
        const statusMap: Record<string, string> = {
          success: 'completed',
          error: 'failed',
          pending: 'pending',
        };
        if (statusFilter === 'pending') {
          query = query.in('status', ['pending', 'processing']);
        } else {
          query = query.eq('status', statusMap[statusFilter]);
        }
      }

      if (dateFrom) {
        query = query.gte('received_at', dateFrom.toISOString());
      }

      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('received_at', endOfDay.toISOString());
      }

      const { data, error, count } = await query;

      if (error) throw error;

      const logEntries: TableLogEntry[] = (data || []).map(file => ({
        id: file.id,
        mediaType: mapMediaType(file.file_type),
        fileName: file.file_name,
        senderName: file.sender_name || '—',
        sender: file.sender_phone || file.sender_name || 'Desconhecido',
        timestamp: new Date(file.received_at),
        status: mapStatus(file.status),
        errorMessage: file.error_message || undefined,
      }));

      setLogs(logEntries);
      setTotalCount(count ?? 0);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error("Erro ao carregar logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [user, mediaTypeFilter, statusFilter, dateFrom, dateTo]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    const query = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.fileName.toLowerCase().includes(query) ||
        log.sender.toLowerCase().includes(query)
    );
  }, [logs, searchQuery]);

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const paginatedLogs = filteredLogs;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLogs();
    setIsRefreshing(false);
    toast.success("Logs atualizados!");
  };

  const handleExport = () => {
    // Criar CSV dos logs filtrados
    const headers = ['Arquivo', 'Tipo', 'Remetente', 'Status', 'Data/Hora', 'Erro'];
    const rows = filteredLogs.map(log => [
      log.fileName,
      log.mediaType,
      log.sender,
      log.status,
      format(log.timestamp, "dd/MM/yyyy HH:mm", { locale: ptBR }),
      log.errorMessage || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Logs exportados!");
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setMediaTypeFilter("all");
    setStatusFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setCurrentPage(1);
    // loadLogs será chamado automaticamente pelo useEffect
  };

  const handleViewDetail = async (logId: string) => {
    setIsLoadingDetail(true)
    setIsDetailOpen(true)
    try {
      const { data, error } = await supabase
        .from('media_files')
        .select(`
          id, file_name, file_type, mime_type, file_size_bytes,
          sender_phone, sender_name, status, error_message,
          received_at, processed_at, google_drive_file_id,
          google_drive_url, google_drive_folder_id, whatsapp_message_id
        `)
        .eq('id', logId)
        .single()

      if (error) throw error
      setSelectedLog(data as LogDetail)
    } catch (err) {
      toast.error('Erro ao carregar detalhes')
      setIsDetailOpen(false)
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const formatBytes = (bytes: number | null): string => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatTimestamp = (date: Date) => {
    return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const stats = useMemo(() => {
    const total = totalCount;
    const success = logs.filter((l) => l.status === "success").length;
    const pending = logs.filter((l) => l.status === "pending").length;
    const error = logs.filter((l) => l.status === "error").length;
    return { total, success, pending, error };
  }, [logs, totalCount]);

  return (
    <AppLayout>
      <div className="min-w-0 overflow-x-hidden">
        {/* Page Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Logs de Atividade
            </h1>
            <p className="text-muted-foreground">
              Histórico de arquivos processados
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="min-w-0 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total de arquivos</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 animate-fade-in" style={{ animationDelay: "200ms" }}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-emerald-600">{stats.success}</div>
              <p className="text-xs text-muted-foreground">Sucesso</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 animate-fade-in" style={{ animationDelay: "300ms" }}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 animate-fade-in" style={{ animationDelay: "400ms" }}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-destructive">{stats.error}</div>
              <p className="text-xs text-muted-foreground">Erros</p>
            </CardContent>
          </Card>
        </div>

      {/* Filters */}
      <Card className="mb-6 min-w-0 animate-fade-in" style={{ animationDelay: "500ms" }}>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {/* Search */}
                <div className="relative min-w-0 sm:col-span-2 lg:col-span-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar arquivo ou remetente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Media Type */}
                <Select value={mediaTypeFilter} onValueChange={setMediaTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de mídia" />
                  </SelectTrigger>
                  <SelectContent>
                    {mediaTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Date From */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data inicial"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>

                {/* Date To */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data final"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Clear filters */}
              {(searchQuery || mediaTypeFilter !== "all" || statusFilter !== "all" || dateFrom || dateTo) && (
                <div className="mt-4">
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                    Limpar filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

      {/* Table */}
      <Card className="min-w-0 animate-fade-in" style={{ animationDelay: "600ms" }}>
            <CardContent className="p-0">
              <div className="space-y-3 p-4 sm:hidden">
                {isLoading ? (
                  <div className="flex h-24 items-center justify-center gap-2 rounded-lg border">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-muted-foreground">Carregando...</span>
                  </div>
                ) : paginatedLogs.length === 0 ? (
                  <div className="flex h-24 items-center justify-center rounded-lg border text-sm text-muted-foreground">
                    Nenhum registro encontrado
                  </div>
                ) : (
                  paginatedLogs.map((log) => (
                    <MobileLogCard key={log.id} log={log} formatTimestamp={formatTimestamp} onViewDetail={handleViewDetail} />
                  ))
                )}
              </div>

              <div className="hidden overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:block">
                <Table className="w-full min-w-[680px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Tipo</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead className="hidden sm:table-cell">Nome</TableHead>
                      <TableHead className="hidden sm:table-cell">Remetente</TableHead>
                      <TableHead className="hidden md:table-cell">Data/Hora</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-muted-foreground">Carregando...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paginatedLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          Nenhum registro encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                              <MediaIcon type={log.mediaType} />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground truncate max-w-[200px]">
                                {log.fileName}
                              </p>
                              <p className="text-xs text-muted-foreground sm:hidden">
                                {log.sender}
                              </p>
                              {log.errorMessage && (
                                <p className="text-xs text-destructive mt-0.5">
                                  {log.errorMessage}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="text-muted-foreground">{log.senderName}</span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="text-muted-foreground">{log.sender}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-muted-foreground">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={log.status} />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleViewDetail(log.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
                    {Math.min(currentPage * itemsPerPage, filteredLogs.length)} de{" "}
                    {filteredLogs.length} registros
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          {/* Sheet de Detalhes do Arquivo */}
          <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedLog && <MediaIcon type={selectedLog.file_type} />}
                  Detalhes do Arquivo
                </SheetTitle>
                <SheetDescription>
                  Informações completas sobre o processamento
                </SheetDescription>
              </SheetHeader>

              {isLoadingDetail ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : selectedLog ? (
                <div className="mt-6 space-y-6">

                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <StatusBadge status={
                      selectedLog.status === 'completed' ? 'success' :
                      selectedLog.status === 'failed' ? 'error' : 'pending'
                    } />
                  </div>

                  <Separator />

                  {/* Arquivo */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Arquivo
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-4">
                        <span className="text-sm text-muted-foreground shrink-0">Nome</span>
                        <span className="text-sm font-medium text-right break-all">
                          {selectedLog.file_name}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-sm text-muted-foreground shrink-0">Tipo</span>
                        <span className="text-sm font-medium capitalize">{selectedLog.file_type}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-sm text-muted-foreground shrink-0">MIME</span>
                        <span className="text-sm font-mono text-right">{selectedLog.mime_type || '—'}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-sm text-muted-foreground shrink-0">Tamanho</span>
                        <span className="text-sm font-medium">{formatBytes(selectedLog.file_size_bytes)}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Remetente */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Remetente
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-4">
                        <span className="text-sm text-muted-foreground shrink-0">Nome</span>
                        <span className="text-sm font-medium">{selectedLog.sender_name || '—'}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-sm text-muted-foreground shrink-0">Telefone</span>
                        <span className="text-sm font-medium">{selectedLog.sender_phone || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Datas */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Datas
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-4">
                        <span className="text-sm text-muted-foreground shrink-0">Recebido em</span>
                        <span className="text-sm font-medium">
                          {format(new Date(selectedLog.received_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-sm text-muted-foreground shrink-0">Processado em</span>
                        <span className="text-sm font-medium">
                          {selectedLog.processed_at
                            ? format(new Date(selectedLog.processed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Google Drive */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Google Drive
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-4">
                        <span className="text-sm text-muted-foreground shrink-0">File ID</span>
                        <span className="text-sm font-mono text-right break-all">
                          {selectedLog.google_drive_file_id || '—'}
                        </span>
                      </div>
                      {selectedLog.google_drive_url && (
                        <div className="pt-1">
                          <a
                            href={selectedLog.google_drive_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Abrir arquivo no Drive
                          </a>
                        </div>
                      )}
                      {selectedLog.google_drive_folder_id && (
                        <div>
                          <a
                            href={`https://drive.google.com/drive/folders/${selectedLog.google_drive_folder_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Abrir pasta no Drive
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Erro (se houver) */}
                  {selectedLog.error_message && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
                          Erro
                        </p>
                        <p className="text-sm text-destructive bg-destructive/5 rounded-lg p-3">
                          {selectedLog.error_message}
                        </p>
                      </div>
                    </>
                  )}

                  {/* WhatsApp Message ID */}
                  {selectedLog.whatsapp_message_id && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          WhatsApp
                        </p>
                        <div className="flex justify-between gap-4">
                          <span className="text-sm text-muted-foreground shrink-0">Message ID</span>
                          <span className="text-xs font-mono text-right break-all text-muted-foreground">
                            {selectedLog.whatsapp_message_id}
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                </div>
              ) : null}
            </SheetContent>
          </Sheet>
      </div>
    </AppLayout>
  );
}
