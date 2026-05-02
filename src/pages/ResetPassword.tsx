import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthBranding } from '@/components/auth/AuthBranding'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { Loader2, Eye, EyeOff, CheckCircle, Lock } from '@/lib/icons'
import logo from "@/assets/logo.png"

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isRecovery, setIsRecovery] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    // Check for recovery event from URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const type = hashParams.get('type')
    if (type === 'recovery') {
      setIsRecovery(true)
    }

    // Also listen for auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const passwordRequirements = [
    { label: 'Mínimo 6 caracteres', valid: password.length >= 6 },
    { label: 'Senhas coincidem', valid: password === confirmPassword && confirmPassword.length > 0 },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast({
        title: 'Senhas não coincidem',
        description: 'Verifique se as senhas são iguais.',
        variant: 'destructive',
      })
      return
    }

    if (password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      toast({
        title: 'Erro ao redefinir senha',
        description: error.message,
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    toast({
      title: 'Senha atualizada!',
      description: 'Sua senha foi redefinida com sucesso.',
    })

    setTimeout(() => navigate('/', { replace: true }), 2000)
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
            {success ? (
              <CardHeader className="text-center py-12">
                <div className="flex justify-center mb-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle className="h-7 w-7 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold">Senha atualizada!</CardTitle>
                <CardDescription>
                  Você será redirecionado em instantes...
                </CardDescription>
              </CardHeader>
            ) : (
              <>
                <CardHeader className="space-y-1 pb-6">
                  <div className="flex justify-center mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Lock className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold text-center">
                    Redefinir senha
                  </CardTitle>
                  <CardDescription className="text-center">
                    Escolha uma nova senha para sua conta.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">Nova senha</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={loading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                      <Input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      {passwordRequirements.map((req, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <CheckCircle
                            className={`h-4 w-4 shrink-0 ${
                              req.valid ? 'text-primary' : 'text-muted-foreground'
                            }`}
                          />
                          <span className={req.valid ? 'text-foreground' : 'text-muted-foreground'}>
                            {req.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading || !passwordRequirements.every((r) => r.valid)}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Atualizando...
                        </>
                      ) : (
                        'Redefinir senha'
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
