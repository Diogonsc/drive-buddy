import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsOfService() {
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
              <FileText className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Termos de Serviço
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
              <CardTitle>1. Aceitação dos Termos</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Ao acessar ou usar o SwiftwapdriveSync ("Serviço"), você concorda em estar
                vinculado a estes Termos de Serviço. Se você não concordar com qualquer
                parte destes termos, não poderá acessar ou usar o Serviço.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Descrição do Serviço</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                O SwiftwapdriveSync é um serviço que automatiza a sincronização de arquivos
                de mídia (imagens, vídeos, áudios e documentos) recebidos via WhatsApp
                Business para o Google Drive do usuário. O serviço:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Recebe webhooks de mídias do WhatsApp Business (via Twilio).</li>
                <li>Processa e faz upload dos arquivos para o Google Drive conectado.</li>
                <li>Mantém logs de sincronização para auditoria.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Requisitos de Conta</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>Para usar o Serviço, você deve:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Ter pelo menos 18 anos de idade.</li>
                <li>Possuir uma conta Google válida para conexão do Google Drive.</li>
                <li>Ter acesso a uma conta WhatsApp Business (via Twilio ou similar).</li>
                <li>Fornecer informações precisas e completas durante o cadastro.</li>
                <li>Manter a segurança de suas credenciais de acesso.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Uso Aceitável</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>Você concorda em não usar o Serviço para:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Violar qualquer lei ou regulamento aplicável.</li>
                <li>Transmitir conteúdo ilegal, difamatório ou prejudicial.</li>
                <li>Tentar acessar dados de outros usuários.</li>
                <li>Interferir ou interromper o funcionamento do Serviço.</li>
                <li>Fazer engenharia reversa ou descompilar o software.</li>
                <li>Usar o Serviço para spam ou distribuição de malware.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Integrações de Terceiros</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                O Serviço integra-se com plataformas de terceiros (Google, Twilio/WhatsApp).
                O uso dessas integrações está sujeito aos termos de serviço dessas plataformas:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Google:</strong> Termos de Serviço do Google e Política de APIs.
                </li>
                <li>
                  <strong>Twilio:</strong> Termos de Serviço da Twilio.
                </li>
                <li>
                  <strong>WhatsApp:</strong> Política de Negócios do WhatsApp.
                </li>
              </ul>
              <p className="mt-4">
                Não somos responsáveis por alterações, interrupções ou políticas dessas
                plataformas de terceiros.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Propriedade Intelectual</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                O Serviço e seu conteúdo original, recursos e funcionalidades são de
                propriedade do SwiftwapdriveSync e estão protegidos por direitos autorais,
                marcas registradas e outras leis de propriedade intelectual.
              </p>
              <p className="mt-4">
                Você mantém todos os direitos sobre os arquivos que sincroniza através
                do Serviço. Concedemos a você uma licença limitada, não exclusiva e
                revogável para usar o Serviço conforme estes Termos.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Limitação de Responsabilidade</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                O Serviço é fornecido "como está" e "conforme disponível". Não garantimos
                que o Serviço será ininterrupto, seguro ou livre de erros. Na extensão
                máxima permitida por lei:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Não seremos responsáveis por danos indiretos, incidentais, especiais
                  ou consequenciais.
                </li>
                <li>
                  Não seremos responsáveis por perda de dados, lucros ou oportunidades
                  de negócio.
                </li>
                <li>
                  Nossa responsabilidade total não excederá o valor pago pelo Serviço
                  nos últimos 12 meses.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8. Indenização</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Você concorda em indenizar e isentar o SwiftwapdriveSync de quaisquer
                reivindicações, danos, perdas ou despesas decorrentes de:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Seu uso do Serviço.</li>
                <li>Violação destes Termos.</li>
                <li>Violação de direitos de terceiros.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>9. Encerramento</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Podemos suspender ou encerrar seu acesso ao Serviço imediatamente,
                sem aviso prévio, por qualquer motivo, incluindo violação destes Termos.
                Você pode encerrar sua conta a qualquer momento através das configurações.
              </p>
              <p className="mt-4">
                Após o encerramento, seu direito de usar o Serviço cessará imediatamente.
                As seções que por sua natureza devem sobreviver ao encerramento
                permanecerão em vigor.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>10. Alterações nos Termos</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Reservamo-nos o direito de modificar estes Termos a qualquer momento.
                Notificaremos sobre alterações significativas por e-mail ou através
                de um aviso no Serviço. O uso continuado do Serviço após alterações
                constitui aceitação dos novos Termos.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>11. Lei Aplicável</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Estes Termos serão regidos e interpretados de acordo com as leis do
                Brasil, sem considerar conflitos de disposições legais. Qualquer
                disputa será resolvida nos tribunais competentes do Brasil.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>12. Contato</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Se você tiver dúvidas sobre estes Termos de Serviço, entre em contato
                conosco através do e-mail de suporte disponível nas configurações do
                aplicativo.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <Link to="/privacy">
            <Button variant="outline">Ver Política de Privacidade</Button>
          </Link>
          <Link to="/">
            <Button>Voltar ao App</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
