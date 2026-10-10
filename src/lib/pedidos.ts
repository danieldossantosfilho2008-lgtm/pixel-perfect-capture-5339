import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type StatusPedido = Database["public"]["Enums"]["status_pedido"];
export type MetodoPagamento = Database["public"]["Enums"]["metodo_pagamento"];

export const STATUS_PEDIDO: { value: StatusPedido; label: string }[] = [
  { value: "orcamento", label: "Orçamento" },
  { value: "aprovado", label: "Aprovado" },
  { value: "preparacao", label: "Preparação" },
  { value: "finalizado", label: "Finalizado" },
  { value: "enviado", label: "Enviado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];
export const labelStatus = (s: string) => STATUS_PEDIDO.find((x) => x.value === s)?.label ?? s;

export const METODOS_PAGAMENTO: { value: MetodoPagamento; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
];
export const labelPagamento = (m: string | null) => METODOS_PAGAMENTO.find((x) => x.value === m)?.label ?? m;

const USA_VENDA: StatusPedido[] = ["aprovado", "preparacao", "finalizado", "enviado", "concluido"];
export const statusUsaPrecoVenda = (s: StatusPedido) => USA_VENDA.includes(s);

/** Consumo: Tecido = largura × altura × peças (m²); demais categorias = quantidade em unidades. */
export function calcularConsumo(
  categoria: string,
  quantidade: number,
  largura: number | null,
  altura: number | null,
): number | null {
  const ok = (n: number | null): n is number => n != null && Number.isFinite(n) && n > 0;
  if (!ok(quantidade)) return null;
  if (categoria === "tecido") {
    if (!ok(largura) || !ok(altura)) return null;
    return Math.round(largura * altura * quantidade * 1000) / 1000;
  }
  return quantidade;
}

/** Valor do pedido conforme o status. null = não calculado/não informado (nunca zero). */
export function valorPedido(p: {
  status: StatusPedido;
  preco_real: number | null;
  preco_venda: number | null;
  valor_cancelamento: number | null;
}): number | null {
  if (p.status === "orcamento") return p.preco_real;
  if (p.status === "cancelado") return p.valor_cancelamento;
  return p.preco_venda;
}

/** Retorna mensagem de bloqueio ou null se a transição é permitida. */
export function bloqueioTransicao(atual: StatusPedido, novo: StatusPedido, precoVenda: number | null): string | null {
  if (atual === "cancelado") return "Pedido cancelado não pode mudar de status.";
  if (statusUsaPrecoVenda(novo) && precoVenda == null)
    return "Registre o preço de venda (valor negociado) antes de mudar para este status.";
  return null;
}

/** Converte texto em reais ("1.250,50") para número; null se vazio; NaN se inválido. */
export function parseBRL(s: string): number | null {
  const t = s.trim().replace(/^R\$\s*/, "");
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}
export function parseNum(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export interface Material {
  id: string;
  nome: string;
  tipo: string;
  cor: string;
  categoria_codigo: string;
  categoria_nome: string;
  unidade: string;
  quantidade: number;
  preco: number;
  detalhe: string | null;
}
export interface PedidoItem {
  id: string;
  produto_id: string;
  produto_nome: string;
  categoria_codigo: string;
  unidade: string;
  preco_unitario: number;
  quantidade: number;
  largura: number | null;
  altura: number | null;
  consumo: number;
}
export interface Pedido {
  id: string;
  numero: number;
  cliente_nome: string;
  endereco: string | null;
  descricao: string | null;
  preco_real: number | null;
  preco_venda: number | null;
  preco_limite: number | null;
  valor_cancelamento: number | null;
  status: StatusPedido;
  metodo_pagamento: MetodoPagamento | null;
  vendedor_id: string | null;
  vendedor: { nome: string } | null;
  created_at: string;
  updated_at: string;
  itens: PedidoItem[];
}
export interface Historico {
  id: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  created_at: string;
  usuario: { nome: string } | null;
}

const n = (v: unknown) => (v == null ? null : Number(v));

export const materiaisQuery = queryOptions({
  queryKey: ["materiais"],
  queryFn: async (): Promise<Material[]> => {
    const { data, error } = await supabase.rpc("materiais_disponiveis");
    if (error) throw error;
    return (data ?? []).map((m) => ({ ...m, quantidade: Number(m.quantidade), preco: Number(m.preco) }));
  },
});

const SELECT =
  "id, numero, cliente_nome, endereco, descricao, preco_real, preco_venda, preco_limite, valor_cancelamento, status, metodo_pagamento, vendedor_id, created_at, updated_at, vendedor:profiles(nome), itens:pedido_itens(id, produto_id, produto_nome, categoria_codigo, unidade, preco_unitario, quantidade, largura, altura, consumo)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapPedido = (r: any): Pedido => ({
  ...r,
  numero: Number(r.numero),
  preco_real: n(r.preco_real),
  preco_venda: n(r.preco_venda),
  preco_limite: n(r.preco_limite),
  valor_cancelamento: n(r.valor_cancelamento),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  itens: (r.itens ?? []).map((i: any) => ({
    ...i,
    preco_unitario: Number(i.preco_unitario),
    quantidade: Number(i.quantidade),
    largura: n(i.largura),
    altura: n(i.altura),
    consumo: Number(i.consumo),
  })),
});

export const pedidosQuery = queryOptions({
  queryKey: ["pedidos"],
  queryFn: async (): Promise<Pedido[]> => {
    const { data, error } = await supabase.from("pedidos").select(SELECT).order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapPedido);
  },
});

export const pedidoQuery = (id: string) =>
  queryOptions({
    queryKey: ["pedidos", id],
    queryFn: async (): Promise<Pedido | null> => {
      const { data, error } = await supabase.from("pedidos").select(SELECT).eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? mapPedido(data) : null;
    },
  });

export const historicoQuery = (id: string) =>
  queryOptions({
    queryKey: ["pedido_historico", id],
    queryFn: async (): Promise<Historico[]> => {
      const { data, error } = await supabase
        .from("pedido_historico")
        .select("id, campo, valor_anterior, valor_novo, created_at, usuario:profiles(nome)")
        .eq("pedido_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as Historico[];
    },
  });

export const vendedoresQuery = queryOptions({
  queryKey: ["vendedores"],
  queryFn: async () => {
    const { data, error } = await supabase.from("profiles").select("id, nome").order("nome");
    if (error) throw error;
    return data;
  },
});

export const idCurto = (numero: number) => `#${String(numero).padStart(5, "0")}`;
