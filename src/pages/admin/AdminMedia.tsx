import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminSection } from "@/components/admin/AdminSection";
import { EmptyState } from "@/components/admin/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  FolderOpen, Shield, Search, RefreshCw, RotateCcw, Eye, Loader2,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock,
  Image, Video, FileAudio, FileText,
} from "lucide-react";

const PAGE_SIZE = 20;

interface MediaFile {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  status: string;
  error_message: string | null;
  retry_count: number;
  is_permanent_failure: boolean;
  sender_phone: string | null;
  sender_name: string | null;
  whatsapp_media_id: string;
  google_drive_url: string | null;
  received_at: string;
  processed_at: string | null;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MediaIcon = ({ type }: { type: string }) => {
  const cls = "h-4 w-4";
  if (type === "image") return <Image className={`${cls} text-blue-500`} />;
  if (type === "video") return <Video className={`${cls} text-purple-500`} />;
  if (type === "audio") return <FileAudio className={`${cls} text-orange-500`} />;
  return <FileText className={`${cls} text-emerald-500`} />;
};

const StatusBadge = ({ status, isPermanent }: { status: string; isPermanent?: boolean }) => {
  if (status === "completed")
    return <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30"><CheckCircle2 className="h-3 w-3" />Concluído</Badge>;
  if (status === "failed")
    return <Badge variant="outline" className={`gap-1 ${isPermanent ? "bg-red-900/10 text-red-700 border-red-700/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}><XCircle className="h-3 w-3" />{isPermanent ? "Falha definitiva" : "Erro"}</Badge>;
  if (status === "processing")
    return <Badge variant="outline" className="gap-1 bg-blue-500/10 text-blue-600 border-blue-500/30"><Loader2 className="h-3 w-3 animate-spin" />Processando</Badge>;
  return <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30"><Clock className="h-3 w-3" />Pendente</Badge>;
};

async function fetchAdminMedia(page: number, statusFilter: string, typeFilter: string, search: string) {
  let query = supabase
    .from("media_files")
    .select("*", { count: "exact" })
    .order("received_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (statusFilter !== "all") {
    if (statusFilter === "pending") query = query.in("status", ["pending", "processing"]);
    else query = query.eq("status", statusFilter);
  }
  if (typeFilter !== "all") query = query.eq("file_type", typeFilter);
  if (search.trim()) {
    query = query.or(`file_name.ilike.%${search.trim()}%,sender_phone.ilike.%${search.trim()}%,user_id.ilike.%${search.trim()}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as MediaFile[], count: count ?? 0 };
}

export default function AdminMedia() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout((window as any)._searchTimer);
    (window as any)._searchTimer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  };

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-media", page, statusFilter, typeFilter, debouncedSearch],
    queryFn: () => fetchAdminMedia(page, statusFilter, typeFilter, debouncedSearch),
  });

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));
  const files = data?.data ?? [];

  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const handleReprocess = async (file: MediaFile) => {
    if (file.status === "processing") { toast.info("Arquivo já está em processamento."); return; }
    setReprocessingId(file.id);
    try {
      const { data: result, error } = await supabase.functions.invoke("reprocess-media", { body: { mediaFileId: file.id } });
      if (error) throw error;
      if (!result?.success) throw new Error(result?.message || "Erro ao reprocessar");
      toast.success("Reprocessamento iniciado.");
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao reprocessar");
    } finally {
      setReprocessingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Arquivos Processados</h1>
        </div>
        <p className="text-muted-foreground">
          Pipeline de mídia — {data?.count ?? "..."} arquivos no total
        </p>
      </div>

      <div className="space-y-6 min-w-0 overflow-x-hidden">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Arquivo, remetente ou user_id..." value={search} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
                <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="failed">Erro</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)}>
                <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="image">Imagens</SelectItem>
                  <SelectItem value="video">Vídeos</SelectItem>
                  <SelectItem value="audio">Áudios</SelectItem>
                  <SelectItem value="document">Documentos</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        <AdminSection>
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : files.length === 0 ? (
                <EmptyState icon={FolderOpen} title="Nenhum arquivo encontrado" description="Tente ajustar os filtros." />
              ) : (
                <>
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <Table className="w-full min-w-[840px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">Tipo</TableHead>
                          <TableHead>Arquivo</TableHead>
                          <TableHead className="hidden md:table-cell">Remetente</TableHead>
                          <TableHead className="hidden lg:table-cell">Tamanho</TableHead>
                          <TableHead className="hidden lg:table-cell">Tent.</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden md:table-cell">Recebido</TableHead>
                          <TableHead className="w-20">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {files.map((file) => (
                          <TableRow key={file.id}>
                            <TableCell>
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                                <MediaIcon type={file.file_type} />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground truncate max-w-[180px] text-sm">{file.file_name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{file.user_id.slice(0, 8)}…</p>
                                {file.error_message && (
                                  <p className="text-xs text-destructive mt-0.5 truncate max-w-[180px]">{file.error_message}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-sm text-muted-foreground">{file.sender_name || file.sender_phone || "—"}</span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <span className="text-sm text-muted-foreground">{formatBytes(file.file_size_bytes)}</span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <span className="text-sm text-muted-foreground">{file.retry_count}</span>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={file.status} isPermanent={file.is_permanent_failure} />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(file.received_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setSelectedFile(file)} title="Ver detalhes">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {(file.status === "failed" || file.status === "pending") && (
                                  <Button variant="ghost" size="icon" onClick={() => handleReprocess(file)} disabled={reprocessingId === file.id} title="Reprocessar">
                                    {reprocessingId === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data?.count ?? 0)} de {data?.count ?? 0}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
                      <span className="px-2 text-sm text-muted-foreground">{page} / {totalPages}</span>
                      <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </AdminSection>
      </div>

      <Dialog open={!!selectedFile} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="truncate">{selectedFile?.file_name}</DialogTitle>
            <DialogDescription>Detalhes do arquivo processado</DialogDescription>
          </DialogHeader>
          {selectedFile && (
            <ScrollArea className="max-h-96">
              <div className="space-y-3 text-sm pr-2">
                {([
                  ["ID", selectedFile.id],
                  ["user_id", selectedFile.user_id],
                  ["Tipo", selectedFile.file_type],
                  ["MIME", selectedFile.mime_type ?? "—"],
                  ["Tamanho", formatBytes(selectedFile.file_size_bytes)],
                  ["Status", selectedFile.status],
                  ["Tentativas", String(selectedFile.retry_count)],
                  ["Falha definitiva", selectedFile.is_permanent_failure ? "Sim" : "Não"],
                  ["Remetente", selectedFile.sender_name || selectedFile.sender_phone || "—"],
                  ["WhatsApp Media ID", selectedFile.whatsapp_media_id],
                  ["Recebido em", format(new Date(selectedFile.received_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })],
                  ["Processado em", selectedFile.processed_at ? format(new Date(selectedFile.processed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : "—"],
                  ["Google Drive URL", selectedFile.google_drive_url ?? "—"],
                  ["Erro", selectedFile.error_message ?? "—"],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex gap-3">
                    <span className="text-muted-foreground min-w-[120px] shrink-0">{label}</span>
                    <span className="font-mono text-xs break-all">{value}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          <div className="flex justify-end gap-2 pt-2">
            {selectedFile && (selectedFile.status === "failed" || selectedFile.status === "pending") && (
              <Button variant="outline" onClick={() => { handleReprocess(selectedFile); setSelectedFile(null); }}>
                <RotateCcw className="h-4 w-4 mr-2" />Reprocessar
              </Button>
            )}
            {selectedFile?.google_drive_url && (
              <Button variant="outline" onClick={() => window.open(selectedFile.google_drive_url!, "_blank")}>
                Abrir no Drive
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
