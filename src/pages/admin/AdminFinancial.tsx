import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminSection } from "@/components/admin/AdminSection";
import { EmptyState } from "@/components/admin/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  fetchFinancialCustomers,
  toggleUserActive,
  type FinancialCustomer,
} from "@/services/admin/adminQueries";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Wallet,
} from "@/lib/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const ITEMS_PER_PAGE = 15;

function formatBrlCents(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function paymentBadgeVariant(
  status: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "outline";
  if (status === "active" || status === "trialing") return "default";
  if (status === "past_due" || status === "unpaid") return "destructive";
  if (status === "canceled") return "secondary";
  return "outline";
}

interface StripeLivePayload {
  status?: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  default_payment_method?: string | null;
  error?: string;
}

/**
 * Financeiro Admin — assinaturas, status de pagamento e override manual de acesso.
 * Mesmo padrão visual de AdminUsers (AppLayout, AdminSection, tabela paginada).
 */
export default function AdminFinancial() {
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [stripeDialogOpen, setStripeDialogOpen] = useState(false);
  const [stripePayload, setStripePayload] = useState<StripeLivePayload | null>(null);
  const [stripeLoadingId, setStripeLoadingId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<FinancialCustomer | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers, isLoading, refetch } = useQuery({
    queryKey: ["admin-financial-customers"],
    queryFn: fetchFinancialCustomers,
  });

  const paymentOptions = useMemo(() => {
    const set = new Set<string>();
    customers?.forEach((c) => {
      if (c.payment_status) set.add(c.payment_status);
    });
    return ["all", ...Array.from(set).sort()];
  }, [customers]);

  const filtered = useMemo(() => {
    let result = customers ?? [];

    if (paymentFilter !== "all") {
      result = result.filter((c) => (c.payment_status ?? "") === paymentFilter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          c.user_id.toLowerCase().includes(q) ||
          (c.account_email?.toLowerCase().includes(q) ?? false) ||
          c.plan.toLowerCase().includes(q) ||
          (c.plan_name?.toLowerCase().includes(q) ?? false),
      );
    }

    return result;
  }, [customers, paymentFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [search, paymentFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const hasFilters = paymentFilter !== "all" || !!search.trim();

  const clearFilters = () => {
    setPaymentFilter("all");
    setSearch("");
    setPage(1);
  };

  const toggleMutation = useMutation({
    mutationFn: ({ userId, next, reason }: { userId: string; next: boolean; reason?: string }) =>
      toggleUserActive(userId, next, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-financial-customers"] });
      toast({ title: "Assinatura atualizada", description: "O estado do cliente foi salvo." });
      setDeactivateTarget(null);
      setDeactivateReason("");
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const openStripeLive = async (row: FinancialCustomer) => {
    if (!row.stripe_subscription_id) return;
    setStripeLoadingId(row.user_id);
    setStripePayload(null);
    setStripeDialogOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-get-stripe-subscription", {
        body: { stripeSubscriptionId: row.stripe_subscription_id },
      });
      if (error) {
        setStripePayload({ error: error.message });
        return;
      }
      if (data && typeof data === "object" && "error" in data) {
        setStripePayload({ error: String((data as { error: unknown }).error) });
        return;
      }
      setStripePayload(data as StripeLivePayload);
    } catch (e) {
      setStripePayload({ error: e instanceof Error ? e.message : "Falha na requisição" });
    } finally {
      setStripeLoadingId(null);
    }
  };

  const confirmDeactivate = () => {
    if (!deactivateTarget) return;
    toggleMutation.mutate({
      userId: deactivateTarget.user_id,
      next: false,
      reason: deactivateReason.trim() || undefined,
    });
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Wallet className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Financeiro</h1>
        </div>
        <p className="text-muted-foreground">
          Visão das assinaturas (<span className="font-medium">subscriptions</span>), status de cobrança e
          bloqueio manual de acesso. Consulta ao Stripe para conferência em tempo real.
        </p>
      </div>

      <div className="space-y-6 min-w-0 overflow-x-hidden">
        <Alert variant="default" className="border-muted">
          <Info className="h-4 w-4" />
          <AlertDescription>
            O e-mail exibido vem de <span className="font-medium">google_drive_accounts</span> (conta Google
            conectada), não de auth.users. Usuários sem Drive vinculado aparecem sem e-mail.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por user_id, e-mail ou plano..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  {paymentOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt === "all" ? "Todos os status" : opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <AdminSection>
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : paginated.length === 0 ? (
                <EmptyState
                  icon={Wallet as never}
                  title="Nenhum registro"
                  description={hasFilters ? "Tente ajustar os filtros." : "Não há linhas em subscriptions."}
                />
              ) : (
                <>
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <Table className="w-full min-w-[960px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>E-mail</TableHead>
                          <TableHead>user_id</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Uso (mês)</TableHead>
                          <TableHead>Ativo</TableHead>
                          <TableHead>Manual</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginated.map((row) => (
                          <TableRow key={row.user_id}>
                            <TableCell
                              className="text-muted-foreground max-w-[180px] truncate"
                              title={row.account_email ?? undefined}
                            >
                              {row.account_email || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs max-w-[120px] truncate" title={row.user_id}>
                              {row.user_id}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="outline">{row.plan}</Badge>
                                <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={row.plan_name ?? ""}>
                                  {row.plan_name || "—"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{formatBrlCents(row.plan_price)}</TableCell>
                            <TableCell>
                              <Badge variant={paymentBadgeVariant(row.payment_status)}>
                                {row.payment_status || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                              {row.current_period_end
                                ? format(new Date(row.current_period_end), "dd/MM/yyyy", { locale: ptBR })
                                : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {row.files_used_current_month ?? 0}
                              {row.monthly_file_limit != null ? ` / ${row.monthly_file_limit}` : " / ∞"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.is_active ? "default" : "destructive"}>
                                {row.is_active ? "sim" : "não"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.manually_disabled ? "secondary" : "outline"}>
                                {row.manually_disabled ? "sim" : "não"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                {row.stripe_subscription_id && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    disabled={stripeLoadingId === row.user_id}
                                    onClick={() => openStripeLive(row)}
                                  >
                                    {stripeLoadingId === row.user_id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <>
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        Stripe
                                      </>
                                    )}
                                  </Button>
                                )}
                                {row.is_active ? (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-8"
                                    disabled={toggleMutation.isPending}
                                    onClick={() => {
                                      setDeactivateReason("");
                                      setDeactivateTarget(row);
                                    }}
                                  >
                                    Desativar
                                  </Button>
                                ) : (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-8"
                                    disabled={toggleMutation.isPending}
                                    onClick={() =>
                                      toggleMutation.mutate({ userId: row.user_id, next: true })
                                    }
                                  >
                                    Reativar
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} de{" "}
                        {filtered.length}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </AdminSection>
      </div>

      <Dialog
        open={stripeDialogOpen}
        onOpenChange={(open) => {
          setStripeDialogOpen(open);
          if (!open) {
            setStripePayload(null);
            setStripeLoadingId(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dados no Stripe</DialogTitle>
            <DialogDescription>Resposta de subscriptions.retrieve (somente leitura).</DialogDescription>
          </DialogHeader>
          {stripeLoadingId && !stripePayload ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : stripePayload?.error ? (
            <p className="text-sm text-destructive">{stripePayload.error}</p>
          ) : stripePayload ? (
            <ul className="space-y-2 text-sm">
              <li>
                <span className="text-muted-foreground">status:</span>{" "}
                <Badge variant={paymentBadgeVariant(stripePayload.status ?? null)}>{stripePayload.status}</Badge>
              </li>
              <li>
                <span className="text-muted-foreground">current_period_end (unix):</span>{" "}
                {stripePayload.current_period_end != null ? String(stripePayload.current_period_end) : "—"}
              </li>
              <li>
                <span className="text-muted-foreground">Data (UTC):</span>{" "}
                {stripePayload.current_period_end != null
                  ? format(new Date(stripePayload.current_period_end * 1000), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })
                  : "—"}
              </li>
              <li>
                <span className="text-muted-foreground">cancel_at_period_end:</span>{" "}
                {String(stripePayload.cancel_at_period_end)}
              </li>
              <li>
                <span className="text-muted-foreground">default_payment_method:</span>{" "}
                <span className="font-mono text-xs break-all">
                  {stripePayload.default_payment_method ?? "—"}
                </span>
              </li>
            </ul>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateTarget(null);
            setDeactivateReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar acesso do cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário ficará com is_active = false e manually_disabled = true em subscriptions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="disable-reason" className="text-sm font-medium text-foreground">
              Motivo (opcional)
            </label>
            <Input
              id="disable-reason"
              placeholder="Desativado pelo admin"
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={(e) => {
                e.preventDefault();
                confirmDeactivate();
              }}
              disabled={toggleMutation.isPending}
            >
              {toggleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
