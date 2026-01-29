import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FolderOpen, AlertCircle, Info } from "lucide-react";

/**
 * Arquivos processados (media_files).
 * RLS atual não expõe media_files para admin (apenas próprio user_id).
 * UI criada; consulta e reprocessamento ficam indisponíveis até policy/view.
 */
export default function AdminMedia() {
  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Arquivos Processados
        </h1>
        <p className="text-muted-foreground">
          Monitorar pipeline de mídia (media_files). Consulta e reprocessamento requerem acesso admin.
        </p>
      </div>

      <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Acesso indisponível</AlertTitle>
        <AlertDescription>
          Não existe policy RLS que permita ao admin SELECT (ou UPDATE) em media_files.
          As regras atuais limitam o acesso ao próprio user_id. Para habilitar esta página,
          seria necessário criar policy ou view liberada para admin, o que está fora do
          escopo &quot;sem alterar RLS&quot;.
        </AlertDescription>
      </Alert>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">O que seria exibido</CardTitle>
              <CardDescription>
                Quando houver acesso: file_name, user_id, tipo, status (pending | processing | completed | failed),
                retry_count, error_message, received_at, processed_at. Filtros por status, usuário e período.
                Ações: reprocessar (status → pending, retry_count → 0) e visualizar erro.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              Nenhuma alteração em domínio, enums, fluxos ou tabelas. Apenas a camada administrativa (UI + queries).
              Reprocessar e listagem ficam condicionados a permissões existentes ou futuras no backend.
            </span>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
