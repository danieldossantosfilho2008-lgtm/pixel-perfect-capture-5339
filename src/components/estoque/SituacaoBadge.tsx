import { cn } from "@/lib/utils";
import { SITUACAO_LABEL, type Situacao } from "@/lib/estoque";

const estilos: Record<Situacao, string> = {
  normal: "bg-success-soft text-success",
  baixo: "bg-warning-soft text-warning",
  sem_estoque: "bg-destructive-soft text-destructive",
};
const ponto: Record<Situacao, string> = {
  normal: "bg-success",
  baixo: "bg-warning",
  sem_estoque: "bg-destructive",
};

export function SituacaoBadge({ s }: { s: Situacao }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium", estilos[s])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", ponto[s])} />
      {SITUACAO_LABEL[s]}
    </span>
  );
}

export function StatusBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded border px-2 py-0.5 text-xs",
        ativo ? "border-border text-foreground" : "border-dashed border-border text-muted-foreground",
      )}
    >
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}
