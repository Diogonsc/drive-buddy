import { AppLayout } from "@/components/layout/AppLayout";
import { AdminSection } from "@/components/admin/AdminSection";
import { BlockedAccess } from "@/components/admin/BlockedAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderOpen, Shield, Search, RefreshCw, RotateCcw, Eye, Info } from "lucide-react";

/**
 * Arquivos Processados — página preparada para quando houver acesso a media_files.
 * Atualmente exibe apenas aviso de acesso indisponível.
 * Usa AppLayout global.
 */
export default function AdminMedia() {
  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Arquivos Processados
          </h1>
        </div>
        <p className="text-muted-foreground">
          Monitorar pipeline de mídia (media_files). Consulta e reprocessamento requerem acesso admin.
        </p>
      </div>

      <div className="space-y-6">
        {/* Aviso de Acesso Bloqueado */}
        <BlockedAccess
          title="Acesso indisponível"
          description="O admin não possui permissão via RLS para consultar ou atualizar media_files. Esta página depende de permissões futuras no backend."
          variant="warning"
        />

        {/* Estrutura Futura (UI preparada, queries desativadas) */}
        <AdminSection
          title="Estrutura preparada"
          description="Código contém tabela e filtros, mas queries desativadas até haver acesso."
        >
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Campos previstos</CardTitle>
                  <CardDescription>
                    file_name, user_id, type, status, retry_count, error_message, received_at, processed_at
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtros (desativados) */}
              <div className="flex flex-wrap gap-4 opacity-50 pointer-events-none">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar..." className="pl-9" disabled />
                </div>
                <Select disabled>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                </Select>
                <Select disabled>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Usuário" />
                  </SelectTrigger>
                </Select>
                <Button variant="outline" size="sm" disabled>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
              </div>

              {/* Tabela (desativada) */}
              <div className="opacity-50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>user_id</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead>Recebido</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-muted-foreground">exemplo.jpg</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        abc123...
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">image</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">completed</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">0</TableCell>
                      <TableCell className="text-muted-foreground">01/01/24 10:00</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" disabled>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" disabled>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                <span>
                  Ações previstas: Reprocessar (status → pending, retry_count → 0) e Visualizar erro.
                  Condicionadas a permissões existentes ou futuras no backend.
                </span>
              </div>
            </CardContent>
          </Card>
        </AdminSection>
      </div>
    </AppLayout>
  );
}
