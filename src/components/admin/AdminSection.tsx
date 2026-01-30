import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper visual simples para seções dentro de páginas admin.
 * Sem layout próprio — apenas organiza conteúdo com título opcional.
 */
export function AdminSection({
  title,
  description,
  children,
  className,
}: AdminSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
