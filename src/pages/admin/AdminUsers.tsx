import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminSection } from "@/components/admin/AdminSection";
import { EmptyState } from "@/components/admin/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { fetchUserRoles, type UserRoleRow } from "@/services/admin/adminQueries";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Shield, Users, Search, RefreshCw, ChevronLeft, ChevronRight, Loader2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ITEMS_PER_PAGE = 15;

/**
 * Gestão de Usuários — lista user_roles (sem dados sensíveis).
 * Usa AppLayout global. Sem ações destrutivas.
 */
export default function AdminUsers() {
  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: userRoles, isLoading, refetch } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: fetchUserRoles,
  });

  // Agrupar por user_id para exibir usuários únicos com suas roles
  const usersWithRoles = useMemo(() => {
    if (!userRoles) return [];

    const userMap = new Map<string, { user_id: string; roles: string[]; created_at: string }>();
    userRoles.forEach((row) => {
      const existing = userMap.get(row.user_id);
      if (existing) {
        existing.roles.push(row.role);
      } else {
        userMap.set(row.user_id, {
          user_id: row.user_id,
          roles: [row.role],
          created_at: row.created_at,
        });
      }
    });

    return Array.from(userMap.values());
  }, [userRoles]);

  const filtered = useMemo(() => {
    let result = usersWithRoles;

    if (roleFilter !== "all") {
      result = result.filter((u) => u.roles.includes(roleFilter));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((u) => u.user_id.toLowerCase().includes(q));
    }

    return result;
  }, [usersWithRoles, roleFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    userRoles?.forEach((r) => roles.add(r.role));
    return ["all", ...Array.from(roles)];
  }, [userRoles]);

  const hasFilters = roleFilter !== "all" || !!search.trim();

  const clearFilters = () => {
    setRoleFilter("all");
    setSearch("");
    setPage(1);
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Gestão de Usuários
          </h1>
        </div>
        <p className="text-muted-foreground">
          Visualização de user_roles. Sem dados sensíveis (email, tokens). Apenas leitura.
        </p>
      </div>

      <div className="space-y-6 min-w-0 overflow-x-hidden">
        {/* Aviso sobre limitações */}
        <Alert variant="default" className="border-muted">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Nomes e emails não estão disponíveis — auth.users não é acessível via RLS.
            Apenas user_id e roles são exibidos.
          </AlertDescription>
        </Alert>

        {/* Filtros */}
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
                  placeholder="Buscar por user_id..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role === "all" ? "Todas as roles" : role}
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

        {/* Tabela de Usuários */}
        <AdminSection>
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : paginated.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Nenhum usuário encontrado"
                  description={hasFilters ? "Tente ajustar os filtros." : "Não há registros em user_roles."}
                />
              ) : (
                <>
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <Table className="w-full min-w-[640px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>user_id</TableHead>
                          <TableHead>Roles</TableHead>
                          <TableHead>Criado em</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginated.map((user) => (
                          <TableRow key={user.user_id}>
                            <TableCell className="font-mono text-sm">
                              {user.user_id}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {user.roles.map((role) => (
                                  <Badge
                                    key={role}
                                    variant={role === "admin" ? "default" : "secondary"}
                                  >
                                    {role}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(user.created_at), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        {(page - 1) * ITEMS_PER_PAGE + 1}–
                        {Math.min(page * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
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
    </AppLayout>
  );
}
