import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthBranding } from "@/components/auth/AuthBranding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Loader2, Eye, EyeOff, Check, ArrowLeft } from "@/lib/icons";
import logo from "@/assets/logo.png";

const PLAN_PRICE_IDS = {
  starter: "price_1TSQUV0sgLseC26AakPcHCSo",
  professional: "price_1TSQVY0sgLseC26ANk1YOutv",
  scale: "price_1TSQWQ0sgLseC26AFTt3xkRc",
} as const;

type PlanSlug = keyof typeof PLAN_PRICE_IDS;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PLANS: {
  slug: PlanSlug;
  name: string;
  priceLabel: string;
  features: string[];
}[] = [
  {
    slug: "starter",
    name: "Starter",
    priceLabel: "R$ 59/mês",
    features: ["Até 80 mídias/mês", "1 número WhatsApp", "1 conta Google Drive"],
  },
  {
    slug: "professional",
    name: "Profissional",
    priceLabel: "R$ 97/mês",
    features: ["Até 200 mídias/mês", "1 número WhatsApp", "1 conta Google Drive"],
  },
  {
    slug: "scale",
    name: "Scale",
    priceLabel: "R$ 247/mês",
    features: ["Até 600 mídias/mês", "1 número WhatsApp", "1 conta Google Drive"],
  },
];

function isPlanSlug(value: string | null): value is PlanSlug {
  return value === "starter" || value === "professional" || value === "scale";
}

export default function Signup() {
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<PlanSlug | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("plan");
    return isPlanSlug(p) ? p : null;
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("canceled") !== "true") return;
    params.delete("canceled");
    const q = params.toString();
    window.history.replaceState({}, "", q ? `/signup?${q}` : "/signup");
    toast({
      title: "Pagamento cancelado",
      description: "Você pode tentar novamente quando quiser.",
    });
  }, [toast]);

  const passwordOk = password.length >= 8;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const emailOk = EMAIL_REGEX.test(email.trim());

  const canAdvanceStep1 =
    fullName.trim().length > 0 && email.trim().length > 0 && passwordOk && passwordsMatch && emailOk;

  const goToStep2 = () => {
    if (!canAdvanceStep1) {
      if (!fullName.trim()) {
        toast({ title: "Nome obrigatório", description: "Informe seu nome completo.", variant: "destructive" });
        return;
      }
      if (!email.trim()) {
        toast({ title: "Email obrigatório", description: "Informe um email válido.", variant: "destructive" });
        return;
      }
      if (!emailOk) {
        toast({ title: "Email inválido", description: "Verifique o formato do email.", variant: "destructive" });
        return;
      }
      if (!passwordOk) {
        toast({
          title: "Senha muito curta",
          description: "A senha deve ter no mínimo 8 caracteres.",
          variant: "destructive",
        });
        return;
      }
      if (!passwordsMatch) {
        toast({ title: "Senhas não coincidem", description: "Confirme a mesma senha nos dois campos.", variant: "destructive" });
        return;
      }
      return;
    }
    setStep(2);
  };

  const handleCheckout = async () => {
    if (!selectedPlanSlug) return;

    const priceId = PLAN_PRICE_IDS[selectedPlanSlug];
    setLoading(true);

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (signUpError) {
        const msg = signUpError.message?.toLowerCase() ?? "";
        const likelyDuplicate =
          msg.includes("already") || msg.includes("registered") || msg.includes("exists") || signUpError.status === 422;

        if (likelyDuplicate) {
          toast({
            title: "Este email já está cadastrado",
            description: (
              <span>
                <Link to="/login" className="font-medium text-primary underline">
                  Fazer login
                </Link>{" "}
                ou use outro email.
              </span>
            ),
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro ao criar conta",
            description: signUpError.message,
            variant: "destructive",
          });
        }
        setLoading(false);
        return;
      }

      const newUser = signUpData.user;
      if (!newUser?.id) {
        toast({
          title: "Não foi possível continuar",
          description: "Crie a conta novamente ou verifique a confirmação por email nas configurações do projeto.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data: checkoutData, error: fnError } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          priceId,
          userId: newUser.id,
          email: email.trim(),
        },
      });

      if (fnError) {
        toast({
          title: "Erro ao iniciar pagamento",
          description: fnError.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const url = checkoutData && typeof checkoutData === "object" && "url" in checkoutData ? (checkoutData as { url?: string }).url : undefined;
      if (!url || typeof url !== "string") {
        toast({
          title: "Erro ao iniciar pagamento",
          description:
            checkoutData && typeof checkoutData === "object" && "error" in checkoutData
              ? String((checkoutData as { error?: unknown }).error)
              : "Resposta inválida do servidor.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      window.location.href = url;
    } catch (e) {
      toast({
        title: "Erro inesperado",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-primary">
        <AuthBranding />
      </div>

      <div className="w-full lg:w-1/2 xl:w-[45%] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className={cn("w-full", step === 1 ? "max-w-md" : "max-w-5xl")}>
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <div className="flex items-center justify-center rounded-lg">
              <img src={logo} alt="Swiftwapdrive" className="h-10 w-10 rounded-lg text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">Swiftwapdrive</h1>
            <p className="text-sm text-muted-foreground">WhatsApp → Google Drive</p>
          </div>

          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span className={cn("font-medium", step === 1 ? "text-foreground" : "")}>1. Conta</span>
            <span aria-hidden>→</span>
            <span className={cn("font-medium", step === 2 ? "text-foreground" : "")}>2. Plano</span>
          </div>

          <Card className="border-0 shadow-none lg:shadow-md lg:border">
            {step === 1 ? (
              <>
                <CardHeader className="space-y-1 pb-6">
                  <CardTitle className="text-2xl font-bold">Criar conta</CardTitle>
                  <CardDescription>Informe seus dados para continuar e escolher um plano.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome completo</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Seu nome"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={loading}
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 8 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        autoComplete="new-password"
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
                    <Label htmlFor="confirmPassword">Confirmar senha</Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Repita a senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2 pt-1">
                    {[
                      { label: "Email válido", valid: emailOk && email.trim().length > 0 },
                      { label: "Mínimo 8 caracteres", valid: passwordOk },
                      { label: "Senhas coincidem", valid: passwordsMatch },
                    ].map((req) => (
                      <div key={req.label} className="flex items-center gap-2 text-sm">
                        <Check className={cn("h-4 w-4 shrink-0", req.valid ? "text-primary" : "text-muted-foreground")} />
                        <span className={req.valid ? "text-foreground" : "text-muted-foreground"}>{req.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 pt-2">
                  <Button type="button" className="w-full" onClick={goToStep2} disabled={loading}>
                    Continuar
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">
                    Já tem uma conta?{" "}
                    <Link to="/login" className="text-primary font-medium hover:underline">
                      Fazer login
                    </Link>
                  </p>
                </CardFooter>
              </>
            ) : (
              <>
                <CardHeader className="space-y-1 pb-4">
                  <div className="flex items-start gap-2">
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={() => setStep(1)} disabled={loading}>
                      <ArrowLeft className="h-4 w-4" />
                      <span className="sr-only">Voltar</span>
                    </Button>
                    <div className="min-w-0">
                      <CardTitle className="text-2xl font-bold">Escolha seu plano</CardTitle>
                      <CardDescription>Selecione o plano e vá para o pagamento seguro com Stripe.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    {PLANS.map((plan) => {
                      const selected = selectedPlanSlug === plan.slug;
                      return (
                        <button
                          key={plan.slug}
                          type="button"
                          disabled={loading}
                          onClick={() => setSelectedPlanSlug(plan.slug)}
                          className={cn(
                            "rounded-lg border-2 p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                          )}
                        >
                          <div className="font-semibold text-lg">{plan.name}</div>
                          <div className="mt-1 text-primary font-medium">{plan.priceLabel}</div>
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            {plan.features.map((f) => (
                              <li key={f} className="flex gap-2">
                                <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 pt-2">
                  <Button type="button" className="w-full sm:w-auto sm:min-w-[200px]" disabled={loading || !selectedPlanSlug} onClick={handleCheckout}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Redirecionando...
                      </>
                    ) : (
                      "Ir para pagamento"
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground text-center sm:text-left">
                    Já tem uma conta?{" "}
                    <Link to="/login" className="text-primary font-medium hover:underline">
                      Fazer login
                    </Link>
                  </p>
                </CardFooter>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
