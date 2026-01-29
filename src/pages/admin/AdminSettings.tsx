import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Settings, Info } from "lucide-react";

/**
 * Configurações globais (limites, flags de manutenção, feature flags).
 * Só exibir se já existir suporte no backend. Não criar regras novas no frontend.
 */
export default function AdminSettings() {
  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Configurações Globais
        </h1>
        <p className="text-muted-foreground">
          Ajustes operacionais (limites, manutenção, feature flags). Dependem de backend.
        </p>
      </div>

      <Alert variant="default" className="border-muted">
        <Info className="h-4 w-4" />
        <AlertTitle>Indisponível</AlertTitle>
        <AlertDescription>
          O backend não expõe endpoints ou tabelas para limites globais, flags de manutenção
          ou feature flags. Esta página fica como placeholder até existir suporte.
          Nenhuma regra nova foi criada no frontend.
        </AlertDescription>
      </Alert>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Settings className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">O que seria configurável</CardTitle>
              <CardDescription>
                Ex.: tamanho máximo de arquivo, modo manutenção, feature flags.
                Tudo condicionado a suporte existente no backend.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </AppLayout>
  );
}
