// src/components/whatsapp/WhatsAppConnectButton.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2, XCircle, Loader2, MessageSquare,
  MessageCircle, Link2, Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

type ProvisionStep = 'idle' | 'creating_account' | 'searching_number' | 'purchasing' | 'configuring' | 'success' | 'error'

const STEP_LABELS: Record<ProvisionStep, string> = {
  idle: 'Configurar WhatsApp',
  creating_account: 'Criando conta isolada...',
  searching_number: 'Buscando número disponível...',
  purchasing: 'Adquirindo número...',
  configuring: 'Configurando recebimento de mídias...',
  success: 'WhatsApp configurado!',
  error: 'Erro na configuração',
}

interface WhatsAppConnectButtonProps {
  onSuccess?: (data: { twilio_number?: string; status: string }) => void
  onError?: (error: string) => void
  className?: string
  currentStatus?: 'connected' | 'disconnected' | 'pending' | 'error'
  connectedNumber?: string
}

export function WhatsAppConnectButton({
  onSuccess,
  onError,
  className,
  currentStatus = 'disconnected',
  connectedNumber,
}: WhatsAppConnectButtonProps) {
  const [step, setStep] = useState<ProvisionStep>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [customerPhone, setCustomerPhone] = useState('')
  const [countryCode, setCountryCode] = useState('BR')
  const [assignedNumber, setAssignedNumber] = useState<string | null>(null)

  const handleConnect = async () => {
    setErrorMessage(null)

    if (!customerPhone.trim()) {
      setErrorMessage('Informe o número do seu WhatsApp Business.')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada. Faça login novamente.')

      // Simula os steps visuais enquanto a função roda
      setStep('creating_account')
      await new Promise(r => setTimeout(r, 800))
      setStep('searching_number')
      await new Promise(r => setTimeout(r, 600))
      setStep('purchasing')

      const { data, error } = await supabase.functions.invoke('twilio-provision-number', {
        body: {
          customerPhone: customerPhone.trim(),
          countryCode,
          label: `WhatsApp ${customerPhone.slice(-4)}`,
        },
      })

      if (error) throw new Error(error.message || 'Erro ao provisionar número')
      if (!data?.success) throw new Error(data?.error || 'Provisionamento falhou')

      setStep('configuring')
      await new Promise(r => setTimeout(r, 600))

      setStep('success')
      setAssignedNumber(data.twilio_number)
      toast.success(`Número ${data.twilio_number} configurado com sucesso!`)
      onSuccess?.({ twilio_number: data.twilio_number, status: 'connected' })
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Erro ao conectar. Tente novamente.'
      setStep('error')
      setErrorMessage(msg)
      toast.error(msg)
      onError?.(msg)
    }
  }

  // Já conectado
  if (currentStatus === 'connected' && step === 'idle') {
    return (
      <div className={cn('rounded-lg bg-primary/5 p-4 space-y-2', className)}>
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="font-medium text-sm">WhatsApp configurado</span>
          <Badge variant="default" className="ml-auto">Ativo</Badge>
        </div>
        {connectedNumber && (
          <p className="text-xs text-muted-foreground pl-7">
            Número atribuído: <span className="font-mono font-medium">{connectedNumber}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground pl-7">
          Mídias recebidas neste número serão salvas automaticamente no Google Drive.
        </p>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className={cn('rounded-lg bg-primary/5 p-4 space-y-2', className)}>
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="font-medium text-sm">WhatsApp configurado com sucesso!</span>
        </div>
        {assignedNumber && (
          <p className="text-xs text-muted-foreground pl-7">
            Número atribuído: <span className="font-mono font-medium">{assignedNumber}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground pl-7">
          Compartilhe este número com seus clientes para receber mídias automaticamente.
        </p>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className={cn('space-y-3', className)}>
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        <Button onClick={() => { setStep('idle'); setErrorMessage(null) }} variant="outline" className="w-full">
          Tentar novamente
        </Button>
      </div>
    )
  }

  const isProcessing = step !== 'idle'

  return (
    <div className={cn('space-y-4', className)}>
      {/* Explicação do fluxo */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
        <p className="font-medium">Como funciona:</p>
        <div className="space-y-2 text-muted-foreground">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary shrink-0" />
            <span>Informe seu número WhatsApp Business abaixo</span>
          </div>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary shrink-0" />
            <span>A plataforma configura um número dedicado para receber suas mídias</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary shrink-0" />
            <span>Tudo automático — sem configurações técnicas</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="customerPhone">Seu número WhatsApp Business</Label>
          <Input
            id="customerPhone"
            placeholder="+55 11 99999-9999"
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
            disabled={isProcessing}
          />
          <p className="text-xs text-muted-foreground">
            Formato internacional com código do país (ex: +55 para Brasil)
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="countryCode">País do número a ser atribuído</Label>
          <select
            id="countryCode"
            value={countryCode}
            onChange={e => setCountryCode(e.target.value)}
            disabled={isProcessing}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="BR">🇧🇷 Brasil</option>
            <option value="US">🇺🇸 Estados Unidos</option>
            <option value="PT">🇵🇹 Portugal</option>
            <option value="GB">🇬🇧 Reino Unido</option>
          </select>
        </div>
      </div>

      {/* Step progress visual */}
      {isProcessing && (
        <div className="rounded-lg bg-muted/50 p-3 space-y-2">
          {(['creating_account', 'searching_number', 'purchasing', 'configuring'] as ProvisionStep[]).map((s) => {
            const steps = ['creating_account', 'searching_number', 'purchasing', 'configuring']
            const currentIdx = steps.indexOf(step)
            const thisIdx = steps.indexOf(s)
            const isDone = thisIdx < currentIdx
            const isCurrent = s === step
            return (
              <div key={s} className={cn(
                'flex items-center gap-2 text-xs transition-colors',
                isDone ? 'text-primary' : isCurrent ? 'text-foreground' : 'text-muted-foreground',
              )}>
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border border-current shrink-0" />
                )}
                <span>{STEP_LABELS[s]}</span>
              </div>
            )
          })}
        </div>
      )}

      {errorMessage && !isProcessing && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleConnect}
        disabled={isProcessing}
        className="w-full gap-2"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageSquare className="h-4 w-4" />
        )}
        {STEP_LABELS[step]}
      </Button>
    </div>
  )
}
