import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Regra existente do cadastro (minLength do campo). Única regra obrigatória. */
export const SENHA_MIN = 6;

const recomendacoes = [
  { label: "Letra maiúscula", test: (s: string) => /[A-Z]/.test(s) },
  { label: "Letra minúscula", test: (s: string) => /[a-z]/.test(s) },
  { label: "Número", test: (s: string) => /\d/.test(s) },
  { label: "Caractere especial", test: (s: string) => /[^A-Za-z0-9]/.test(s) },
];

function Item({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-center gap-1.5", ok ? "text-highlight" : "text-muted-foreground/60")}>
      {ok ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
      <span>{children}</span>
      <span className="sr-only">{ok ? "(atendido)" : "(não atendido)"}</span>
    </li>
  );
}

export function PasswordStrength({ senha }: { senha: string }) {
  if (!senha) return null;
  const minOk = senha.length >= SENHA_MIN;
  const extras = recomendacoes.filter((r) => r.test(senha)).length;
  const pontos = (minOk ? 1 : 0) + extras;
  const pct = (pontos / (recomendacoes.length + 1)) * 100;
  const nivel = !minOk || pontos <= 2 ? "Fraca" : pontos <= 4 ? "Média" : "Forte";
  const barra = nivel === "Fraca" ? "bg-destructive" : nivel === "Média" ? "bg-highlight/60" : "bg-highlight";

  return (
    <div className="space-y-2 text-xs" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Força da senha">
          <div className={cn("h-full transition-all", barra)} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-12 text-right font-medium">{nivel}</span>
      </div>
      <ul className="space-y-1">
        <Item ok={minOk}>Mínimo de {SENHA_MIN} caracteres (obrigatório)</Item>
      </ul>
      <p className="text-muted-foreground">Para uma senha mais forte:</p>
      <ul className="grid grid-cols-2 gap-1">
        {recomendacoes.map((r) => (
          <Item key={r.label} ok={r.test(senha)}>{r.label}</Item>
        ))}
      </ul>
    </div>
  );
}
