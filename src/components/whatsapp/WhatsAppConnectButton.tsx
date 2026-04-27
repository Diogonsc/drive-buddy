import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle, Loader2, MessageSquare, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

type ConnectStatus = 'idle' | 'testing' | 'saving' | 'success' | 'error'

interface WhatsAppConnectButtonProps {
  onSuccess?: (data: { status: string; whatsapp_number?: string }) => void
  onError?: (error: string) => void
  className?: string
  currentStatus?: 'connected' | 'disconnected' | 'pending' | 'error'
}

export function WhatsAppConnectButton({
  onSuccess,
  onError,
  className,
  currentStatus = 'disconnected',
}: WhatsAppConnectButtonProps) {
  const [status, setStatus] = useState<ConnectStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('') // ex: +14155238886

  const handleConnect = async () => {
    setErrorMessage(null)

    if (!accountSid.trim() || !authToken.trim() || !whatsappNumber.trim()) {
      setErrorMessage('Preencha todos os campos.')
      return
    }

    try {
      // 1. Testar credenciais
      setStatus('testing')
      const { data: testData, error: testError } = await supabase.functions.invoke(
        'whatsapp-test-connection',
        { body: { accountSid, authToken, whatsappNumber } },
      )

      if (testError || !testData?.success) {
        throw new Error(testData?.error || testError?.message || 'Credenciais inválidas.')
      }

      // 2. Salvar conexão
      setStatus('saving')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada. Faça login novamente.')

      const formattedNumber = whatsappNumber.startsWith('whatsapp:')
        ? whatsappNumber
        : `whatsapp:${whatsappNumber.startsWith('+') ? whatsappNumber : '+' + whatsappNumber}`

      const { error: upsertError } = await supabase
        .from('whatsapp_connections')
        .upsert({
          user_id: user.id,
          label: `WhatsApp ${whatsappNumber.slice(-4)}`,
          phone_number_id: whatsappNumber,
          twilio_account_sid: accountSid.trim(),
          twilio_auth_token: authToken.trim(),
          twilio_whatsapp_number: formattedNumber,
          provider: 'twilio',
          status: 'connected',
          connected_at: new Date().toISOString(),
        }, { onConflict: 'user_id,phone_number_id' })

      if (upsertError) throw new Error(upsertError.message)

      setStatus('success')
      toast.success('WhatsApp conectado com sucesso!')
      onSuccess?.({ status: 'connected', whatsapp_number: formattedNumber })
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Erro ao conectar. Tente novamente.'
      setStatus('error')
      setErrorMessage(msg)
      toast.error(msg)
      onError?.(msg)
    }
  }

  if (currentStatus === 'connected' && status === 'idle') {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-primary rounded-lg bg-primary/5 p-4', className)}>
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <span>WhatsApp conectado via Twilio.</span>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-primary rounded-lg bg-primary/5 p-4', className)}>
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <span>WhatsApp conectado com sucesso!</span>
      </div>
    )
  }

  const isProcessing = status === 'testing' || status === 'saving'

  return (
    <div className={cn('space-y-4', className)}>
      {errorMessage && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="accountSid">Account SID</Label>
          <Input
            id="accountSid"
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={accountSid}
            onChange={e => setAccountSid(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="authToken">Auth Token</Label>
          <Input
            id="authToken"
            type="password"
            placeholder="Seu Auth Token da Twilio"
            value={authToken}
            onChange={e => setAuthToken(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="whatsappNumber">Número WhatsApp Twilio</Label>
          <Input
            id="whatsappNumber"
            placeholder="+14155238886"
            value={whatsappNumber}
            onChange={e => setWhatsappNumber(e.target.value)}
            disabled={isProcessing}
          />
          <p className="text-xs text-muted-foreground">
            Número no formato internacional. Sandbox: +14155238886
          </p>
        </div>
      </div>

      <Button onClick={handleConnect} disabled={isProcessing} className="w-full gap-2">
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageSquare className="h-4 w-4" />
        )}
        {status === 'testing' ? 'Validando credenciais...' : status === 'saving' ? 'Salvando...' : 'Conectar WhatsApp'}
      </Button>

      <a
        href="https://console.twilio.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        Obter credenciais no Twilio Console
      </a>
    </div>
  )
}
