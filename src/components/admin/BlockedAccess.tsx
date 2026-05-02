import { AlertCircle, Lock } from "@/lib/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface BlockedAccessProps {
  title?: string;
  description: string;
  variant?: "warning" | "info";
}

/**
 * Componente que exibe mensagem clara quando o admin não possui acesso
 * a determinados dados via RLS. Sem layout próprio, apenas conteúdo.
 */
export function BlockedAccess({
  title = "Acesso indisponível",
  description,
  variant = "warning",
}: BlockedAccessProps) {
  const Icon = variant === "warning" ? AlertCircle : Lock;
  const borderClass =
    variant === "warning"
      ? "border-amber-500/50 bg-amber-500/5"
      : "border-muted";

  return (
    <Alert variant="default" className={borderClass}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
