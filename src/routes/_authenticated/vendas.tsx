import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { materiaisQuery, METODOS_PAGAMENTO, parseBRL, type MetodoPagamento } from "@/lib/pedidos";
import { erroMsg } from "@/lib/estoque";
import { MateriaisEditor, validarItens, type ItemForm } from "@/components/pedidos/MateriaisEditor";
import { ICONE_PAGAMENTO, Valor } from "@/components/pedidos/PedidoBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas e Cadastros — Gestão de Persianas" },
      { name: "description", content: "Registre vendas de persianas com cliente, materiais e preços." },
      { property: "og:title", content: "Vendas e Cadastros — Gestão de Persianas" },
      { property: "og:description", content: "Registro de vendas que gera pedidos automaticamente." },
    ],
  }),
  component: VendasPage,
});

function VendasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: materiais = [] } = useQuery(materiaisQuery);
  const [cliente, setCliente] = useState("");
  const [endereco, setEndereco] = useState("");
  const [descricao, setDescricao] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [pagamento, setPagamento] = useState<MetodoPagamento | "">("");
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const chave = useRef(crypto.randomUUID());

  function limpar() {
    setCliente(""); setEndereco(""); setDescricao(""); setPrecoVenda(""); setPagamento(""); setItens([]); setErros({});
    chave.current = crypto.randomUUID();
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!cliente.trim()) er.cliente = "Informe o nome completo do cliente.";
    else if (cliente.trim().length > 200) er.cliente = "Nome muito longo.";
    const pv = parseBRL(precoVenda);
    if (Number.isNaN(pv)) er.preco = "Informe um valor válido, por exemplo 1.250,00.";
    if (itens.length === 0) er.itens = "Selecione ao menos um material.";
    else if (validarItens(itens, materiais).some((c) => c.erro)) er.itens = "Corrija os materiais destacados.";
    setErros(er);
    if (Object.keys(er).length) return;
    setSalvando(true);
    const { data, error } = await supabase.rpc("criar_pedido", {
      _dados: { cliente_nome: cliente, endereco, descricao, preco_venda: pv, metodo_pagamento: pagamento || null },
      _itens: itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade.replace(",", "."), largura: i.largura.replace(",", "."), altura: i.altura.replace(",", ".") })),
      _chave: chave.current,
    });
    setSalvando(false);
    if (error) return toast.error(erroMsg(error));
    toast.success("Venda registrada. Pedido criado em Orçamento.");
    qc.invalidateQueries({ queryKey: ["pedidos"] });
    qc.invalidateQueries({ queryKey: ["materiais"] });
    limpar();
    navigate({ to: "/pedidos/$id", params: { id: data } });
  }

  return (
    <form onSubmit={salvar} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Vendas e Cadastros</h1>
        <p className="text-sm text-muted-foreground">Ao salvar, o pedido é criado automaticamente com status Orçamento.</p>
      </div>

      <section className="grid gap-4 rounded border border-border p-4 md:grid-cols-2">
        <h2 className="font-medium md:col-span-2">Cliente</h2>
        <div className="space-y-1">
          <Label htmlFor="cliente">Nome completo *</Label>
          <Input id="cliente" value={cliente} maxLength={200} onChange={(e) => setCliente(e.target.value)} />
          {erros.cliente && <p className="text-xs text-destructive">{erros.cliente}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="endereco">Endereço de entrega / instalação</Label>
          <Textarea id="endereco" rows={2} maxLength={500} value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade, referência" />
        </div>
      </section>

      <section className="space-y-3 rounded border border-border p-4">
        <h2 className="font-medium">Materiais e dimensões</h2>
        <MateriaisEditor itens={itens} onChange={setItens} />
        {erros.itens && <p className="text-xs text-destructive">{erros.itens}</p>}
      </section>

      <section className="grid gap-4 rounded border border-border p-4 md:grid-cols-3">
        <h2 className="font-medium md:col-span-3">Valores</h2>
        <div className="space-y-1">
          <Label>Preço real</Label>
          <div className="flex h-9 items-center"><Valor v={null} /></div>
          <p className="text-xs text-muted-foreground">Depende do percentual de lucro, ainda não configurado.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="pv">Preço de venda (opcional)</Label>
          <Input id="pv" inputMode="decimal" placeholder="R$ 0,00" value={precoVenda} onChange={(e) => setPrecoVenda(e.target.value)} />
          {erros.preco && <p className="text-xs text-destructive">{erros.preco}</p>}
        </div>
        <div className="space-y-1">
          <Label>Preço limite</Label>
          <div className="flex h-9 items-center"><Valor v={null} /></div>
        </div>
        <div className="space-y-1">
          <Label>Método de pagamento</Label>
          <Select value={pagamento} onValueChange={(v) => setPagamento(v as MetodoPagamento)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {METODOS_PAGAMENTO.map((m) => {
                const I = ICONE_PAGAMENTO[m.value];
                return (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="flex items-center gap-2"><I className="h-4 w-4" /> {m.label}</span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="desc">Descrição</Label>
          <Textarea id="desc" rows={2} maxLength={2000} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={limpar} disabled={salvando}>Cancelar</Button>
        <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar venda"}</Button>
      </div>
    </form>
  );
}
