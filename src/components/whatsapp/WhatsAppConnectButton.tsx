import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  MessageSquare,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useFacebookSDK } from '@/hooks/useFacebookSDK';
import { cn } from '@/lib/utils';

type ConnectStatus = 'idle' | 'loading_sdk' | 'connecting' | 'exchanging' | 'success' | 'error';

interface WhatsAppConnectButtonProps {
  onSuccess?: (data: {
    waba_id?: string;
    phone_number_id?: string;
    status: string;
  }) => void;
  onError?: (error: string) => void;
  className?: string;
  variant?: 'default' | 'compact';
  currentStatus?: 'connected' | 'disconnected' | 'pending' | 'error';
}

export function WhatsAppConnectButton({
  onSuccess,
  onError,
  className,
  variant = 'default',
  currentStatus = 'disconnected',
}: WhatsAppConnectButtonProps) {
  const [status, setStatus] = useState<ConnectStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { isLoaded, loadSDK, startEmbeddedSignup, error: sdkError } = useFacebookSDK();

  const handleConnect = async () => {
    setErrorMessage(null);

    try {
      // Step 1: Load SDK if needed
      if (!isLoaded) {
        setStatus('loading_sdk');
        await loadSDK();
        // Wait a bit for SDK to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Step 2: Start FB Login / Embedded Signup
      setStatus('connecting');
      const result = await startEmbeddedSignup();

      // Step 3: Exchange code for token via backend
      setStatus('exchanging');
      const { data, error } = await supabase.functions.invoke('whatsapp-embedded-signup', {
        body: {
          action: 'exchange_code',
          code: result.code,
          waba_id: result.waba_id,
          phone_number_id: result.phone_number_id,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao processar conexão');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Success!
      setStatus('success');
      toast.success('WhatsApp conectado com sucesso!');
      onSuccess?.(data);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao conectar. Tente novamente.';
      setStatus('error');
      setErrorMessage(msg);
      toast.error(msg);
      onError?.(msg);
    }
  };

  const handleRetry = () => {
    setStatus('idle');
    setErrorMessage(null);
    handleConnect();
  };

  // Already connected
  if (currentStatus === 'connected' && status === 'idle') {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2 text-sm text-primary rounded-lg bg-primary/5 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>WhatsApp conectado com sucesso!</span>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2 text-sm text-primary rounded-lg bg-primary/5 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>WhatsApp conectado com sucesso!</span>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className={cn('space-y-3', className)}>
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        <Button onClick={handleRetry} variant="outline" className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  // Loading states
  const isProcessing = status !== 'idle';
  const statusLabels: Record<ConnectStatus, string> = {
    idle: 'Conectar WhatsApp',
    loading_sdk: 'Carregando...',
    connecting: 'Conectando...',
    exchanging: 'Configurando...',
    success: 'Conectado!',
    error: 'Erro',
  };

  return (
    <div className={cn('space-y-3', className)}>
      {sdkError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{sdkError}</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleConnect}
        disabled={isProcessing}
        className={cn(
          'gap-2',
          variant === 'default' ? 'w-full' : ''
        )}
        size={variant === 'compact' ? 'sm' : 'default'}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageSquare className="h-4 w-4" />
        )}
        {statusLabels[status]}
      </Button>

      {variant === 'default' && status === 'idle' && (
        <p className="text-xs text-muted-foreground text-center">
          Conecte em 1 clique via Meta Business. Nenhuma configuração manual necessária.
        </p>
      )}
    </div>
  );
}
