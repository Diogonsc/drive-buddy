import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthBranding } from '@/components/auth/AuthBranding'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { Cloud, Loader2, Mail, ArrowLeft } from 'lucide-react'
import logo from "@/assets/logo.png"

function getResetRedirectUrl() {
  const configuredUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim()
  if (configuredUrl) return `${configuredUrl.replace(/\/$/, '')}/reset-password`
  return `${window.location.origin}/reset-password`
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getResetRedirectUrl(),
    })

    if (error) {
      toast({
        title: 'Erro ao enviar email',
        description: error.message,
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  const handleResend = async () => {
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getResetRedirectUrl(),
    })
    toast({
      title: 'Email reenviado',
      description: 'Verifique sua caixa de entrada.',
    })
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-primary">
        <AuthBranding />
      </div>

      <div className="w-full lg:w-1/2 xl:w-[45%] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
          <div className="flex items-center justify-center rounded-lg">
                  <img src={logo} alt="Swiftwapdrive" className="h-10 w-10 rounded-lg text-primary-foreground" />
              </div>
            <h1 className="text-xl font-bold">Swiftwapdrive</h1>
            <p className="text-sm text-muted-foreground">WhatsApp → Google Drive</p>
          </div>

          <Card className="border-0 shadow-none lg:shadow-md lg:border">
            {!sent ? (
              <>
                <CardHeader className="space-y-1 pb-6">
                  <CardTitle className="text-2xl font-bold">Esqueci minha senha</CardTitle>
                  <CardDescription>
                    Insira seu email e enviaremos um link para redefinir sua senha.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-4 pt-2">
                    <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Enviar link de redefinição
                        </>
                      )}
                    </Button>
                    <Link
                      to="/login"
                      className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Voltar para o login
                    </Link>
                  </CardFooter>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="space-y-1 pb-6 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                      <Mail className="h-7 w-7 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold">Verifique seu email</CardTitle>
                  <CardDescription>
                    Enviamos um link de redefinição para <strong>{email}</strong>
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Não recebeu? Verifique a pasta de spam ou clique abaixo para reenviar.
                  </p>
                  <Button variant="outline" onClick={handleResend} disabled={loading} className="w-full">
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Reenviar email
                  </Button>
                </CardContent>
                <CardFooter className="justify-center">
                  <Link
                    to="/login"
                    className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Voltar para o login
                  </Link>
                </CardFooter>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
