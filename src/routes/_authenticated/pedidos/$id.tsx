import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { idCurto, METODOS_PAGAMENTO, parseBRL, pedidoQuery, statusUsaPrecoVenda, valorPedido, type MetodoPagamento, type Pedido } from "@/lib/pedidos";
import { erroMsg, fmtData, fmtNum } from "@/lib/estoque";
import { ICONE_PAGAMENTO, StatusPedidoBadge, Valor } from "@/components/pedidos/PedidoBadges";
import { StatusControl } from "@/components/pedidos/StatusControl";
import { HistoricoLista } from "@/components/pedidos/HistoricoDialog";
import { MateriaisEditor, validarItens, type ItemForm } from "@/components/pedidos/MateriaisEditor";
import { materiaisQuery } from "@/lib/pedidos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pedidos/$id")({
  head: () => ({
    meta: [
      { title: "Detalhes do pedido — Gestão de Persianas" },
      { name: "description", content: "Detalhes, edição e histórico de um pedido." },
      { property: "og:title", content: "Detalhes do pedido — Gestão de Persianas" },
      { property: "og:description", content: "Detalhes, edição e histórico de um pedido." },
    ],
  }),
  component: PedidoPage,
});

const brl = (v: number | null) => (v == null ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));

function PedidoPage() {
  const { id } = Route.useParams();
  const { data: p, isLoading, error } = useQuery(pedidoQuery(id));
  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <p className="text-destructive">Não foi possível carregar o pedido.</p>;
  if (!p) return <p>Pedido não encontrado. <Link to="/pedidos" className="underline">Voltar</Link></p>;
  return <Detalhe key={p.updated_at} p={p} />;
}

function Detalhe({ p }: { p: Pedido }) {
  const qc = useQueryClient();
  const { data: materiais = [] } = useQuery(materiaisQuery);
  const editavel = p.status !== "cancelado";
  const [cliente, setCliente] = useState(p.cliente_nome);
  const [endereco, setEndereco] = useState(p.endereco ?? "");
  const [descricao, setDescricao] = useState(p.descricao ?? "");
  const [precoVenda, setPrecoVenda] = useState(brl(p.preco_venda));
  const [pagamento, setPagamento] = useState<MetodoPagamento | "">(p.metodo_pagamento ?? "");
  const [editandoItens, setEditandoItens] = useState(false);
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [baixado, setBaixado] = useState<Record<string, number>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!editandoItens) return;
    // Em pedidos já baixados, o consumo atual do próprio pedido conta como disponível.
    const b: Record<string, number> = {};
    if (["preparacao", "finalizado", "enviado"].includes(p.status)) p.itens.forEach((i) => (b[i.produto_id] = (b[i.produto_id] ?? 0) + i.consumo));
    setBaixado(b);
  }, [editandoItens, p]);

  const invalidar = () => ["pedidos", "pedido_historico", "materiais", "produtos"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  async function salvarDados() {
    if (!cliente.trim()) return toast.error("Informe o nome do cliente.");
    const pv = parseBRL(precoVenda);
    if (Number.isNaN(pv)) return toast.error("Preço de venda inválido.");
    if (pv == null && statusUsaPrecoVenda(p.status)) return toast.error("O preço de venda é obrigatório no status atual.");
    setSalvando(true);
    const { error } = await supabase.rpc("atualizar_pedido", {
      _id: p.id,
      _dados: { cliente_nome: cliente, endereco, descricao, preco_venda: pv, metodo_pagamento: pagamento || null },
    });
    setSalvando(false);
    if (error) return toast.error(erroMsg(error));
    toast.success("Pedido atualizado.");
    invalidar();
  }

  async function salvarItens() {
    if (!itens.length) return toast.error("Selecione ao menos um material.");
    if (validarItens(itens, materiais, baixado).some((c) => c.erro)) return toast.error("Corrija os materiais destacados.");
    setSalvando(true);
    const { error } = await supabase.rpc("atualizar_itens_pedido", {
      _id: p.id,
      _itens: itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade.replace(",", "."), largura: i.largura.replace(",", "."), altura: i.altura.replace(",", ".") })),
    });
    setSalvando(false);
    if (error) return toast.error(erroMsg(error));
    toast.success("Materiais atualizados.");
    invalidar();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/pedidos"><ArrowLeft className="h-4 w-4" /> Pedidos</Link></Button>
        <h1 className="font-mono text-2xl font-semibold">{idCurto(p.numero)}</h1>
        <StatusPedidoBadge s={p.status} />
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status</span>
          <StatusControl pedido={p} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="grid gap-3 rounded border border-border p-4 sm:grid-cols-4 text-sm">
            <div><div className="text-xs text-muted-foreground">Valor atual</div><Valor v={valorPedido(p)} /></div>
            <div><div className="text-xs text-muted-foreground">Preço real</div><Valor v={p.preco_real} /></div>
            <div><div className="text-xs text-muted-foreground">Preço limite</div><Valor v={p.preco_limite} /></div>
            <div><div className="text-xs text-muted-foreground">Vendedor</div>{p.vendedor?.nome ?? "—"}</div>
            <div className="sm:col-span-2"><div className="text-xs text-muted-foreground">Criado em</div><span className="font-mono">{fmtData(p.created_at)}</span></div>
            <div className="sm:col-span-2"><div className="text-xs text-muted-foreground">Última atualização</div><span className="font-mono">{fmtData(p.updated_at)}</span></div>
          </section>

          <section className="grid gap-4 rounded border border-border p-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Cliente *</Label>
              <Input value={cliente} maxLength={200} disabled={!editavel} onChange={(e) => setCliente(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Endereço</Label>
              <Textarea rows={2} value={endereco} maxLength={500} disabled={!editavel} onChange={(e) => setEndereco(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Preço de venda</Label>
              <Input inputMode="decimal" placeholder="R$ 0,00" value={precoVenda} disabled={!editavel} onChange={(e) => setPrecoVenda(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Método de pagamento</Label>
              <Select value={pagamento} disabled={!editavel} onValueChange={(v) => setPagamento(v as MetodoPagamento)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {METODOS_PAGAMENTO.map((m) => {
                    const I = ICONE_PAGAMENTO[m.value];
                    return <SelectItem key={m.value} value={m.value}><span className="flex items-center gap-2"><I className="h-4 w-4" /> {m.label}</span></SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea rows={2} value={descricao} maxLength={2000} disabled={!editavel} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            {editavel && (
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={salvarDados} disabled={salvando}>Salvar alterações</Button>
              </div>
            )}
          </section>

          <section className="space-y-3 rounded border border-border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Materiais</h2>
              {editavel && p.status !== "concluido" && !editandoItens && (
                <Button size="sm" variant="outline" onClick={() => {
                  setItens(p.itens.map((i) => ({ produto_id: i.produto_id, quantidade: String(i.quantidade), largura: i.largura == null ? "" : String(i.largura), altura: i.altura == null ? "" : String(i.altura) })));
                  setEditandoItens(true);
                }}>Editar materiais</Button>
              )}
            </div>
            {editandoItens ? (
              <>
                <MateriaisEditor itens={itens} onChange={setItens} baixado={baixado} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditandoItens(false)} disabled={salvando}>Cancelar</Button>
                  <Button onClick={salvarItens} disabled={salvando}>Salvar materiais</Button>
                </div>
              </>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-1">Material</th><th>Peças/Qtd</th><th>Dimensões</th><th className="text-right">Consumo</th></tr>
                </thead>
                <tbody>
                  {p.itens.map((i) => (
                    <tr key={i.id} className="border-t border-border">
                      <td className="py-1.5">{i.produto_nome}</td>
                      <td className="font-mono">{fmtNum(i.quantidade)}</td>
                      <td className="font-mono">{i.largura != null ? `${fmtNum(i.largura)} × ${fmtNum(i.altura)} m` : "—"}</td>
                      <td className="text-right font-mono">{fmtNum(i.consumo)} {i.unidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside className="rounded border border-border p-4">
          <h2 className="mb-3 font-medium">Histórico de edição</h2>
          <HistoricoLista pedidoId={p.id} />
        </aside>
      </div>
    </div>
  );
}
