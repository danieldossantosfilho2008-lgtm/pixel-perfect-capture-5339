import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  TIPOS_MOV,
  erroMsg,
  fmtNum,
  produtosQuery,
  sinalMov,
  unidade,
  type TipoMovimentacao,
} from "@/lib/estoque";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  produtoId?: string | null;
}

export function MovimentarDialog({ open, onOpenChange, produtoId }: Props) {
  const { data: produtos = [] } = useQuery(produtosQuery);
  const qc = useQueryClient();
  const [selecionado, setSelecionado] = useState("");
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [tipo, setTipo] = useState<TipoMovimentacao>("entrada");
  const [qtd, setQtd] = useState("");
  const [obs, setObs] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelecionado(produtoId ?? "");
    setIncluirInativos(false);
    setTipo("entrada");
    setQtd("");
    setObs("");
    setConfirmando(false);
  }, [open, produtoId]);

  const produto = produtos.find((p) => p.id === selecionado);
  const opcoes = produtos.filter((p) => p.status === "ativo" || incluirInativos || p.id === selecionado);
  const q = Number(qtd.replace(",", "."));
  const novo = produto ? produto.quantidade + sinalMov(tipo) * (isNaN(q) ? 0 : q) : 0;

  const erro = useMemo(() => {
    if (!produto) return "Selecione um produto.";
    if (qtd.trim() === "" || isNaN(q) || q <= 0) return "A quantidade deve ser maior que zero.";
    if (novo < 0) return `Quantidade superior ao estoque disponível (${fmtNum(produto.quantidade)}).`;
    return null;
  }, [produto, qtd, q, novo]);

  async function confirmar() {
    if (erro || !produto) return;
    setSalvando(true);
    const { error } = await supabase.rpc("movimentar_estoque", {
      _produto: produto.id,
      _tipo: tipo,
      _quantidade: q,
      _observacao: obs,
    });
    setSalvando(false);
    if (error) {
      toast.error(erroMsg(error));
      setConfirmando(false);
      return;
    }
    toast.success("Movimentação registrada.");
    await qc.invalidateQueries({ queryKey: ["produtos"] });
    await qc.invalidateQueries({ queryKey: ["movimentacoes", produto.id] });
    onOpenChange(false);
  }

  const un = produto ? unidade(produto) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{confirmando ? "Confirmar movimentação" : "Movimentar estoque"}</DialogTitle>
          <DialogDescription>
            {confirmando ? "Revise os valores antes de confirmar." : "Registre entradas, saídas ou ajustes."}
          </DialogDescription>
        </DialogHeader>

        {!confirmando ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Produto</Label>
              <Select value={selecionado} onValueChange={setSelecionado} disabled={!!produtoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {opcoes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} · {p.categoria?.nome}
                      {p.status === "inativo" ? " (inativo)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!produtoId && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={incluirInativos} onCheckedChange={(v) => setIncluirInativos(!!v)} />
                  Mostrar produtos inativos
                </label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_MOV.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    tipo === t.value ? "border-highlight bg-accent font-medium text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  <span className={cn("mr-1 font-mono", t.sinal > 0 ? "text-success" : "text-destructive")}>
                    {t.sinal > 0 ? "+" : "−"}
                  </span>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qtd">Quantidade {un && `(${un})`}</Label>
              <Input id="qtd" type="number" min={0} step="any" value={qtd} onChange={(e) => setQtd(e.target.value)} />
              {qtd !== "" && erro && produto && <p className="text-xs text-destructive">{erro}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs">Observação / motivo</Label>
              <Textarea id="obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
            {produto && (
              <Resumo atual={produto.quantidade} mov={sinalMov(tipo) * (isNaN(q) ? 0 : q)} novo={novo} un={un} />
            )}
          </div>
        ) : (
          produto && (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="font-medium">{produto.nome}</span> ·{" "}
                {TIPOS_MOV.find((t) => t.value === tipo)?.label}
              </p>
              <Resumo atual={produto.quantidade} mov={sinalMov(tipo) * q} novo={novo} un={un} grande />
              {obs.trim() && <p className="text-sm text-muted-foreground">Motivo: {obs}</p>}
            </div>
          )
        )}

        <DialogFooter>
          {confirmando ? (
            <>
              <Button variant="outline" onClick={() => setConfirmando(false)}>
                Voltar
              </Button>
              <Button onClick={confirmar} disabled={salvando}>
                {salvando ? "Registrando..." : "Confirmar"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setConfirmando(true)} disabled={!!erro}>
                Continuar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Resumo({ atual, mov, novo, un, grande }: { atual: number; mov: number; novo: number; un: string; grande?: boolean }) {
  const cls = grande ? "text-2xl" : "text-lg";
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-4 py-3">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Atual</div>
        <div className={cn("font-mono font-medium", cls)}>{fmtNum(atual)}</div>
      </div>
      <div className="text-center">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Movimentação</div>
        <div className={cn("font-mono font-medium", cls, mov >= 0 ? "text-success" : "text-destructive")}>
          {mov >= 0 ? "+" : "−"}
          {fmtNum(Math.abs(mov))}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
      <div className="text-right">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Novo estoque</div>
        <div className={cn("font-mono font-semibold", cls, novo < 0 && "text-destructive")}>
          {fmtNum(novo)} <span className="text-xs text-muted-foreground">{un}</span>
        </div>
      </div>
    </div>
  );
}
