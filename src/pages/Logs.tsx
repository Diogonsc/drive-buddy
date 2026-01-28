import { useState, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
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
} from "lucide-react";
import { LogEntry } from "@/components/ui/ActivityLog";

// Mock data - será substituído por dados reais do Supabase
const mockLogs: LogEntry[] = [
  {
    id: "1",
    mediaType: "image",
    fileName: "foto_produto_123.jpg",
    sender: "+55 11 99999-8888",
    timestamp: new Date(Date.now() - 2 * 60000),
    status: "success",
  },
  {
    id: "2",
    mediaType: "video",
    fileName: "video_apresentacao.mp4",
    sender: "+55 21 98888-7777",
    timestamp: new Date(Date.now() - 15 * 60000),
    status: "success",
  },
  {
    id: "3",
    mediaType: "document",
    fileName: "contrato_v2.pdf",
    sender: "+55 11 97777-6666",
    timestamp: new Date(Date.now() - 45 * 60000),
    status: "pending",
  },
  {
    id: "4",
    mediaType: "audio",
    fileName: "audio_mensagem.ogg",
    sender: "+55 31 96666-5555",
    timestamp: new Date(Date.now() - 2 * 3600000),
    status: "success",
  },
  {
    id: "5",
    mediaType: "image",
    fileName: "comprovante.png",
    sender: "+55 11 95555-4444",
    timestamp: new Date(Date.now() - 3 * 3600000),
    status: "error",
    errorMessage: "Falha no upload para o Drive",
  },
  {
    id: "6",
    mediaType: "video",
    fileName: "tutorial.mp4",
    sender: "+55 21 94444-3333",
    timestamp: new Date(Date.now() - 5 * 3600000),
    status: "success",
  },
  {
    id: "7",
    mediaType: "image",
    fileName: "screenshot_app.png",
    sender: "+55 11 93333-2222",
    timestamp: new Date(Date.now() - 24 * 3600000),
    status: "success",
  },
  {
    id: "8",
    mediaType: "document",
    fileName: "relatorio_mensal.xlsx",
    sender: "+55 31 92222-1111",
    timestamp: new Date(Date.now() - 48 * 3600000),
    status: "success",
  },
  {
    id: "9",
    mediaType: "audio",
    fileName: "nota_voz_001.ogg",
    sender: "+55 21 91111-0000",
    timestamp: new Date(Date.now() - 72 * 3600000),
    status: "error",
    errorMessage: "Arquivo corrompido",
  },
  {
    id: "10",
    mediaType: "video",
    fileName: "demo_produto.mp4",
    sender: "+55 11 90000-9999",
    timestamp: new Date(Date.now() - 96 * 3600000),
    status: "success",
  },
];

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

export default function Logs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const itemsPerPage = 10;

  const filteredLogs = useMemo(() => {
    return mockLogs.filter((log) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          log.fileName.toLowerCase().includes(query) ||
          log.sender.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Media type filter
      if (mediaTypeFilter !== "all" && log.mediaType !== mediaTypeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all" && log.status !== statusFilter) {
        return false;
      }

      // Date from filter
      if (dateFrom && log.timestamp < dateFrom) {
        return false;
      }

      // Date to filter
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (log.timestamp > endOfDay) {
          return false;
        }
      }

      return true;
    });
  }, [searchQuery, mediaTypeFilter, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setMediaTypeFilter("all");
    setStatusFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setCurrentPage(1);
  };

  const formatTimestamp = (date: Date) => {
    return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  // Stats
  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const success = filteredLogs.filter((l) => l.status === "success").length;
    const pending = filteredLogs.filter((l) => l.status === "pending").length;
    const error = filteredLogs.filter((l) => l.status === "error").length;
    return { total, success, pending, error };
  }, [filteredLogs]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar currentPath="/logs" />

      <main className="pl-16 lg:pl-64 pt-16 transition-all duration-300">
        <div className="container py-8">
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                Atualizar
              </Button>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                <p className="text-xs text-muted-foreground">Total de arquivos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-emerald-600">{stats.success}</div>
                <p className="text-xs text-muted-foreground">Sucesso</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-destructive">{stats.error}</div>
                <p className="text-xs text-muted-foreground">Erros</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {/* Search */}
                <div className="relative sm:col-span-2 lg:col-span-1">
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
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Tipo</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead className="hidden sm:table-cell">Remetente</TableHead>
                      <TableHead className="hidden md:table-cell">Data/Hora</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.length === 0 ? (
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
                            <Button variant="ghost" size="icon">
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
                <div className="flex items-center justify-between border-t px-4 py-3">
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
        </div>
      </main>
    </div>
  );
}
