import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { NivelAcesso } from "@/lib/estoque";

export type TipoCargo = Database["public"]["Enums"]["tipo_cargo"];

export interface Cargo { id: string; nome: string; cor: string; tipo: TipoCargo }
export interface Funcionario {
  id: string;
  nome: string;
  email: string | null;
  tipo_conta: "empresarial" | "profissional";
  cargo: Cargo | null;
  created_at: string;
}
export interface FuncionarioDados {
  salario: number | null;
  comissao_percentual: number | null;
  descricao: string | null;
}

/** Páginas reais do sistema que possuem controle de acesso. */
export const PAGINAS: { codigo: string; nome: string }[] = [
  { codigo: "estoque", nome: "Estoque" },
  { codigo: "vendas", nome: "Vendas" },
  { codigo: "pedidos", nome: "Pedidos" },
  { codigo: "administracao", nome: "Administração" },
];
export const NIVEIS: { value: NivelAcesso; label: string }[] = [
  { value: "sem_acesso", label: "Sem acesso" },
  { value: "visualizacao", label: "Visualização" },
  { value: "edicao", label: "Edição" },
];
export const labelNivel = (n: string | null) => NIVEIS.find((x) => x.value === n)?.label ?? n ?? "—";

export const ehVendedor = (c: Pick<Cargo, "tipo"> | null | undefined) => c?.tipo === "vendedor";

/** Cor do texto (clara/escura) com melhor contraste sobre a cor de fundo (luminância WCAG). */
export function corTexto(hex: string): "#ffffff" | "#111111" {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#111111";
  const n = parseInt(m[1], 16);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  const contraste = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return contraste(L, 1) >= contraste(L, 0) ? "#ffffff" : "#111111";
}

/** Comissão = % sobre o preço de venda. Sem preço de venda ou sem % definida → null (não calculado). */
export function calcularComissao(precoVenda: number | null, percentual: number | null): number | null {
  if (precoVenda == null || percentual == null) return null;
  return Math.round(precoVenda * percentual) / 100;
}

export interface VendaConcluida { pedido_id: string; concluido_em: string; preco_venda: number | null }
export interface PontoDesempenho { dia: string; quantidade: number; valor: number; comissao: number | null }

/** Agrupa vendas concluídas por dia (YYYY-MM-DD, horário local), preenchendo dias vazios do período. */
export function agruparPorDia(vendas: VendaConcluida[], inicio: string, fim: string, percentual: number | null) {
  const mapa = new Map<string, PontoDesempenho>();
  for (let d = new Date(inicio + "T00:00:00"); d <= new Date(fim + "T00:00:00"); d.setDate(d.getDate() + 1)) {
    const k = isoDia(d);
    mapa.set(k, { dia: k, quantidade: 0, valor: 0, comissao: percentual == null ? null : 0 });
  }
  let semPreco = 0;
  for (const v of vendas) {
    const p = mapa.get(isoDia(new Date(v.concluido_em)));
    if (!p) continue;
    p.quantidade += 1;
    if (v.preco_venda == null) { semPreco++; continue; }
    p.valor += Number(v.preco_venda);
    const c = calcularComissao(Number(v.preco_venda), percentual);
    if (c != null && p.comissao != null) p.comissao += c;
  }
  const pontos = [...mapa.values()];
  return {
    pontos,
    total: pontos.reduce((s, p) => s + p.quantidade, 0),
    valor: pontos.reduce((s, p) => s + p.valor, 0),
    comissao: percentual == null ? null : pontos.reduce((s, p) => s + (p.comissao ?? 0), 0),
    semPreco,
  };
}
export function isoDia(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const cargosQuery = queryOptions({
  queryKey: ["cargos"],
  queryFn: async (): Promise<Cargo[]> => {
    const { data, error } = await supabase.from("cargos").select("id, nome, cor, tipo").order("nome");
    if (error) throw error;
    return data;
  },
});

export const funcionariosQuery = queryOptions({
  queryKey: ["funcionarios"],
  queryFn: async (): Promise<Funcionario[]> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, email, tipo_conta, created_at, cargo:cargos(id, nome, cor, tipo)")
      .order("nome");
    if (error) throw error;
    return data as unknown as Funcionario[];
  },
});

export const funcionarioDadosQuery = (id: string) =>
  queryOptions({
    queryKey: ["funcionarios", id, "dados"],
    queryFn: async (): Promise<FuncionarioDados | null> => {
      const { data, error } = await supabase
        .from("funcionario_dados").select("salario, comissao_percentual, descricao").eq("user_id", id).maybeSingle();
      if (error) throw error;
      return data ? {
        salario: data.salario == null ? null : Number(data.salario),
        comissao_percentual: data.comissao_percentual == null ? null : Number(data.comissao_percentual),
        descricao: data.descricao,
      } : null;
    },
  });

export const permissoesQuery = (id: string) =>
  queryOptions({
    queryKey: ["funcionarios", id, "permissoes"],
    queryFn: async (): Promise<Record<string, NivelAcesso>> => {
      const res = await Promise.all(
        PAGINAS.map((p) => supabase.rpc("nivel_acesso_setor", { _user: id, _setor: p.codigo })),
      );
      const out: Record<string, NivelAcesso> = {};
      res.forEach((r, i) => {
        if (r.error) throw r.error;
        out[PAGINAS[i].codigo] = (r.data ?? "sem_acesso") as NivelAcesso;
      });
      return out;
    },
  });

export const historicoFuncionarioQuery = (id: string) =>
  queryOptions({
    queryKey: ["funcionarios", id, "historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionario_historico")
        .select("id, campo, valor_anterior, valor_novo, created_at, usuario:profiles!funcionario_historico_usuario_id_fkey(nome)")
        .eq("funcionario_id", id)
        .order("created_at");
      if (error) throw error;
      return data as unknown as { id: string; campo: string; valor_anterior: string | null; valor_novo: string | null; created_at: string; usuario: { nome: string } | null }[];
    },
  });

export const desempenhoQuery = (id: string, inicio: string, fim: string) =>
  queryOptions({
    queryKey: ["desempenho", id, inicio, fim],
    queryFn: async (): Promise<VendaConcluida[]> => {
      const { data, error } = await supabase.rpc("desempenho_vendedor", { _id: id, _inicio: inicio, _fim: fim });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, preco_venda: r.preco_venda == null ? null : Number(r.preco_venda) }));
    },
  });
