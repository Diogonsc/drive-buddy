import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao app
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Política de Privacidade
              </h1>
              <p className="text-muted-foreground">
                Última atualização: {new Date().toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Introdução</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                O SwiftwapdriveSync ("nós", "nosso" ou "Serviço") está comprometido em proteger
                sua privacidade. Esta Política de Privacidade explica como coletamos, usamos,
                divulgamos e protegemos suas informações quando você usa nosso serviço de
                sincronização de mídias entre WhatsApp e Google Drive.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Informações que Coletamos</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>Coletamos os seguintes tipos de informações:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Dados de conta:</strong> Endereço de e-mail e informações de
                  autenticação fornecidas durante o cadastro.
                </li>
                <li>
                  <strong>Tokens de acesso:</strong> Credenciais OAuth para conectar sua
                  conta do Google Drive (não armazenamos senhas).
                </li>
                <li>
                  <strong>Metadados de mídia:</strong> Nome de arquivo, tipo, tamanho e
                  timestamps das mídias processadas.
                </li>
                <li>
                  <strong>Logs de sincronização:</strong> Registros de ações realizadas
                  pelo sistema para fins de auditoria e suporte.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Como Usamos suas Informações</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>Utilizamos as informações coletadas para:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Processar e sincronizar suas mídias do WhatsApp para o Google Drive.</li>
                <li>Manter logs de atividade para suporte técnico e resolução de problemas.</li>
                <li>Melhorar e otimizar nosso serviço.</li>
                <li>Comunicar atualizações importantes sobre o serviço.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Compartilhamento de Dados</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Não vendemos, alugamos ou compartilhamos suas informações pessoais com
                terceiros, exceto:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Google:</strong> Para autenticação e upload de arquivos ao seu
                  Google Drive (usando OAuth 2.0).
                </li>
                <li>
                  <strong>Twilio/WhatsApp:</strong> Para receber webhooks de mensagens
                  (não armazenamos conteúdo de mensagens de texto).
                </li>
                <li>
                  <strong>Obrigações legais:</strong> Quando exigido por lei ou ordem judicial.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Segurança dos Dados</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Implementamos medidas de segurança técnicas e organizacionais para proteger
                suas informações, incluindo:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Criptografia de tokens de acesso em repouso.</li>
                <li>Comunicação via HTTPS/TLS.</li>
                <li>Row Level Security (RLS) no banco de dados para isolamento de dados.</li>
                <li>Verificação de assinatura em webhooks.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Retenção de Dados</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Mantemos seus dados enquanto sua conta estiver ativa. Os arquivos de mídia
                são processados e enviados diretamente ao seu Google Drive — não armazenamos
                cópias permanentes. Logs de sincronização são retidos por até 90 dias para
                fins de suporte.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Seus Direitos</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>Você tem o direito de:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Acessar os dados que mantemos sobre você.</li>
                <li>Solicitar correção de dados incorretos.</li>
                <li>Solicitar exclusão de sua conta e dados associados.</li>
                <li>Revogar acesso às suas contas conectadas a qualquer momento.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8. Alterações nesta Política</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos
                sobre alterações significativas por e-mail ou através de um aviso em nosso
                serviço. Recomendamos revisar esta página regularmente.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>9. Contato</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Se você tiver dúvidas sobre esta Política de Privacidade, entre em contato
                conosco através do e-mail de suporte disponível nas configurações do aplicativo.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <Link to="/terms">
            <Button variant="outline">Ver Termos de Serviço</Button>
          </Link>
          <Link to="/">
            <Button>Voltar ao App</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
