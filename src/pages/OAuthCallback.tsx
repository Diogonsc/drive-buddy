import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, XCircle, Cloud } from 'lucide-react'

type CallbackStatus = 'processing' | 'success' | 'error'

export default function OAuthCallback() {
  const [status, setStatus] = useState<CallbackStatus>('processing')
  const [errorMessage, setErrorMessage] = useState('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      const state = searchParams.get('state')

      if (error) {
        setStatus('error')
        setErrorMessage(searchParams.get('error_description') || 'Autorização negada')
        return
      }

      if (!code) {
        setStatus('error')
        setErrorMessage('Código de autorização não encontrado')
        return
      }

      if (!session) {
        setStatus('error')
        setErrorMessage('Você precisa estar logado para conectar o Google Drive')
        return
      }

      try {
        const accountLabel = localStorage.getItem('google_oauth_account_label') || undefined
        localStorage.removeItem('google_oauth_account_label')

        // Call the edge function to exchange code for tokens
        const { data, error: fnError } = await supabase.functions.invoke('google-oauth', {
          body: {
            action: 'callback',
            code,
            redirectUri: `${window.location.origin}/oauth/callback`,
            accountLabel,
          },
        })

        if (fnError) {
          throw new Error(fnError.message)
        }

        if (data?.error) {
          throw new Error(data.error)
        }

        setStatus('success')
        toast({
          title: 'Google Drive conectado!',
          description: 'Suas mídias serão sincronizadas automaticamente.',
        })

        // Redirect after success
        setTimeout(() => {
          navigate('/connections')
        }, 2000)
      } catch (err) {
        console.error('OAuth callback error:', err)
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Erro ao processar autorização')
      }
    }

    handleCallback()
  }, [searchParams, session, navigate, toast])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg">
              <Cloud className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === 'processing' && 'Conectando Google Drive...'}
            {status === 'success' && 'Conectado com Sucesso!'}
            {status === 'error' && 'Erro na Conexão'}
          </CardTitle>
          <CardDescription>
            {status === 'processing' && 'Aguarde enquanto processamos a autorização'}
            {status === 'success' && 'Você será redirecionado em instantes'}
            {status === 'error' && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === 'processing' && (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}
          {status === 'success' && (
            <CheckCircle className="h-12 w-12 text-primary" />
          )}
          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/connections')}>
                  Voltar para Conexões
                </Button>
                <Button onClick={() => navigate('/settings')}>
                  Verificar Configurações
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
