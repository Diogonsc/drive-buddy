import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, Loader2, Search } from "lucide-react";

type UserRow = {
  user_id: string;
  roles: string[];
  created_at: string;
};

/** Lista usuários a partir de user_roles (admin ALL). Sem acesso a connections/subscriptions/auth.users. */
export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [detailUser, setDetailUser] = useState<UserRow | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<UserRow[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const byUser = new Map<string, { roles: string[]; created_at: string }>();
      for (const r of data ?? []) {
        const id = r.user_id;
        const existing = byUser.get(id);
        if (!existing) {
          byUser.set(id, {
            roles: [r.role as string],
            created_at: r.created_at,
          });
        } else {
          existing.roles.push(r.role as string);
          if (r.created_at < existing.created_at) existing.created_at = r.created_at;
        }
      }
      return Array.from(byUser.entries()).map(([user_id, v]) => ({
        user_id,
        roles: v.roles,
        created_at: v.created_at,
      }));
    },
  });

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.user_id.toLowerCase().includes(q) ||
        r.roles.some((role) => role.toLowerCase().includes(q))
    );
  }, [rows, search]);

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Gestão de Usuários
        </h1>
        <p className="text-muted-foreground">
          Contas e roles (user_roles). Email, plano e status de integrações requerem acesso a outras tabelas.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Buscar por user_id ou role.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="user_id ou role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>user_id</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Nenhum registro
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.user_id}>
                      <TableCell className="font-mono text-xs">
                        {r.user_id.slice(0, 8)}…
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.roles.map((role) => (
                            <Badge key={role} variant={role === "admin" ? "default" : "secondary"}>
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDetailUser(r)}
                          aria-label="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detailUser} onOpenChange={() => setDetailUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do usuário</DialogTitle>
            <DialogDescription>
              Dados disponíveis via user_roles. Email, plano e status WhatsApp/Drive não são expostos ao admin.
            </DialogDescription>
          </DialogHeader>
          {detailUser && (
            <div className="space-y-4 font-mono text-sm">
              <div>
                <p className="text-muted-foreground">user_id</p>
                <p className="break-all">{detailUser.user_id}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Criado em</p>
                <p>
                  {format(new Date(detailUser.created_at), "dd/MM/yyyy HH:mm:ss", {
                    locale: ptBR,
                  })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Roles</p>
                <div className="flex flex-wrap gap-1">
                  {detailUser.roles.map((role) => (
                    <Badge key={role} variant={role === "admin" ? "default" : "secondary"}>
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
                Suspender/reativar e resetar integração exigiriam campos ou tabelas adicionais; não alterados aqui.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
