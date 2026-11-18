import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Escolha } from "./PeriodoFinanceiro";
import { diaBrasil, lancarFinanceiro, type MovimentoFinanceiro, type PedidoFinanceiro } from "@/lib/financeiro";
import { METODOS_PAGAMENTO, parseBRL, idCurto } from "@/lib/pedidos";
import { fmtBRL, erroMsg } from "@/lib/estoque";
import { toast } from "sonner";
export function LancamentoDialog({ pedido, estorno, onClose }: { pedido?:PedidoFinanceiro; estorno?:MovimentoFinanceiro; onClose:()=>void }) {
  const qc = useQueryClient();
  const [tipo,setTipo] = useState("saida"), [valor,setValor] = useState(""), [descricao,setDescricao] = useState(""), [categoria,setCategoria] = useState(estorno?.categoria ?? ""), [metodo,setMetodo] = useState(estorno?.metodo_pagamento ?? "pix"), [data,setData] = useState(diaBrasil());
  const [chave] = useState(() => crypto.randomUUID());
  const [salvando,setSalvando] = useState(false), [erro,setErro] = useState("");
  async function salvar(e:React.FormEvent) {
    e.preventDefault(); const n = parseBRL(valor); if (n == null || !Number.isFinite(n) || n<=0) { setErro("Informe um valor positivo."); return; }
    setSalvando(true);setErro("");
    try { await lancarFinanceiro({ tipo:pedido ? "entrada" : tipo, valor:n, descricao, categoria:pedido ? "Recebimento de pedido" : categoria, metodo_pagamento:metodo, data_movimento:data, pedido_id:pedido?.id ?? null, estorno_de:estorno?.id ?? null },chave); await Promise.all([qc.invalidateQueries({queryKey:["financeiro"]}),qc.invalidateQueries({queryKey:["pedido_historico"]})]); toast.success("Movimentação registrada.");onClose(); } catch(e) { setErro(erroMsg(e)); } finally { setSalvando(false); }
  }
  return <Dialog open onOpenChange={v => !v && !salvando && onClose()}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{estorno ? "Registrar estorno" : pedido ? "Registrar recebimento" : "Nova movimentação"}</DialogTitle><DialogDescription>{estorno ? `${estorno.descricao} · ${fmtBRL(estorno.valor)}` : pedido ? `${idCurto(pedido.numero)} · ${pedido.cliente_nome} · Pendente ${fmtBRL(pedido.pendente)}` : "Entrada ou saída efetiva de caixa"}</DialogDescription></DialogHeader><form onSubmit={salvar} className="space-y-4">{!pedido && !estorno && <Escolha label="Tipo" value={tipo} onChange={setTipo} options={[{value:"entrada",label:"Entrada"},{value:"saida",label:"Saída"}]}/>}<div><Label htmlFor="fin-valor">Valor (R$)</Label><Input id="fin-valor" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" required/></div><div><Label htmlFor="fin-descricao">{estorno ? "Motivo do estorno" : "Descrição"}</Label><Input id="fin-descricao" value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={500} required/></div>{!pedido && !estorno && <div><Label htmlFor="fin-categoria">Categoria</Label><Input id="fin-categoria" value={categoria} onChange={e => setCategoria(e.target.value)} maxLength={120} required/></div>}<div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="fin-data">Data da movimentação</Label><Input id="fin-data" type="date" value={data} max={diaBrasil()} onChange={e => setData(e.target.value)} required/></div><div><Label>Forma de pagamento</Label>{estorno ? <p className="py-2 text-sm">{METODOS_PAGAMENTO.find(m => m.value===metodo)?.label}</p> : <Escolha label="Forma de pagamento" value={metodo} onChange={s => { const m = METODOS_PAGAMENTO.find(m => m.value===s); if(m) setMetodo(m.value); }} options={METODOS_PAGAMENTO}/>}</div></div>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={salvando} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={salvando}>{salvando ? "Registrando…" : "Registrar"}</Button></div></form></DialogContent></Dialog>;
}