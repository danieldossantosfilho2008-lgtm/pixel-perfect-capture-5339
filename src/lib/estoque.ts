import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type NivelAcesso = Database["public"]["Enums"]["nivel_acesso"];
export type TipoMovimentacao = Database["public"]["Enums"]["tipo_movimentacao"];
export type StatusProduto = Database["public"]["Enums"]["status_produto"];

export interface CategoriaAtributo {
  atributo: string;
  rotulo: string;
  obrigatorio: boolean;
}
export interface Categoria {
  id: string;
  codigo: string;
  nome: string;
  unidade_medida: string;
  atributos: CategoriaAtributo[];
}
export interface Produto {
  id: string;
  categoria_id: string;
  nome: string;
  tipo: string;
  cor: string;
  descricao: string | null;
  quantidade: number;
  preco: number;
  estoque_min: number | null;
  estoque_max: number | null;
  status: StatusProduto;
  created_at: string;
  updated_at: string;
  categoria: { codigo: string; nome: string; unidade_medida: string } | null;
  atributos: Record<string, string>;
}
export interface Movimentacao {
  id: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  saldo_anterior: number;
  saldo_posterior: number;
  observacao: string | null;
  created_at: string;
  usuario: { nome: string } | null;
}

export const TIPOS_MOV: { value: TipoMovimentacao; label: string; sinal: 1 | -1 }[] = [
  { value: "entrada", label: "Entrada", sinal: 1 },
  { value: "saida", label: "Saída", sinal: -1 },
  { value: "ajuste_positivo", label: "Ajuste positivo", sinal: 1 },
  { value: "ajuste_negativo", label: "Ajuste negativo", sinal: -1 },
];
export const labelMov = (t: TipoMovimentacao) => TIPOS_MOV.find((x) => x.value === t)?.label ?? t;
export const sinalMov = (t: TipoMovimentacao) => TIPOS_MOV.find((x) => x.value === t)?.sinal ?? 1;

export type Situacao = "sem_estoque" | "baixo" | "normal";
/** Precedência: Sem estoque (qtd = 0) > Estoque baixo (qtd < mín) > Normal. */
export function situacao(p: Pick<Produto, "quantidade" | "estoque_min">): Situacao {
  if (Number(p.quantidade) === 0) return "sem_estoque";
  if (p.estoque_min != null && Number(p.quantidade) < Number(p.estoque_min)) return "baixo";
  return "normal";
}
export const SITUACAO_LABEL: Record<Situacao, string> = {
  sem_estoque: "Sem estoque",
  baixo: "Estoque baixo",
  normal: "Normal",
};

const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const fmtNum = (n: number | null | undefined) => (n == null ? "—" : num.format(Number(n)));
export const fmtBRL = (n: number) => brl.format(Number(n));
export const fmtData = (s: string) =>
  new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
export const unidade = (p: Pick<Produto, "categoria">) => p.categoria?.unidade_medida ?? "un";

export function erroMsg(e: unknown) {
  const m = (e as { message?: string })?.message ?? "Erro inesperado";
  if (m.includes("max_maior_min")) return "Estoque máximo não pode ser menor que o mínimo.";
  return m;
}

export const categoriasQuery = queryOptions({
  queryKey: ["categorias"],
  queryFn: async (): Promise<Categoria[]> => {
    const { data, error } = await supabase
      .from("categorias")
      .select("id, codigo, nome, unidade_medida, ordem, categoria_atributos(atributo, rotulo, obrigatorio)")
      .order("ordem");
    if (error) throw error;
    return data.map((c) => ({
      id: c.id,
      codigo: c.codigo,
      nome: c.nome,
      unidade_medida: c.unidade_medida,
      atributos: c.categoria_atributos,
    }));
  },
  staleTime: Infinity,
});

const PRODUTO_SELECT =
  "id, categoria_id, nome, tipo, cor, descricao, quantidade, preco, estoque_min, estoque_max, status, created_at, updated_at, categoria:categorias(codigo, nome, unidade_medida), produto_atributos(atributo, valor)";

type ProdutoRow = Omit<Produto, "atributos"> & { produto_atributos: { atributo: string; valor: string }[] };
const mapProduto = (r: ProdutoRow): Produto => {
  const { produto_atributos, ...rest } = r;
  return {
    ...rest,
    quantidade: Number(rest.quantidade),
    preco: Number(rest.preco),
    estoque_min: rest.estoque_min == null ? null : Number(rest.estoque_min),
    estoque_max: rest.estoque_max == null ? null : Number(rest.estoque_max),
    atributos: Object.fromEntries(produto_atributos.map((a) => [a.atributo, a.valor])),
  };
};

export const produtosQuery = queryOptions({
  queryKey: ["produtos"],
  queryFn: async (): Promise<Produto[]> => {
    const { data, error } = await supabase.from("produtos").select(PRODUTO_SELECT).order("nome");
    if (error) throw error;
    return (data as unknown as ProdutoRow[]).map(mapProduto);
  },
});

export const produtoQuery = (id: string) =>
  queryOptions({
    queryKey: ["produtos", id],
    queryFn: async (): Promise<Produto | null> => {
      const { data, error } = await supabase.from("produtos").select(PRODUTO_SELECT).eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? mapProduto(data as unknown as ProdutoRow) : null;
    },
  });

export const movimentacoesQuery = (id: string) =>
  queryOptions({
    queryKey: ["movimentacoes", id],
    queryFn: async (): Promise<Movimentacao[]> => {
      const { data, error } = await supabase
        .from("movimentacoes_estoque")
        .select("id, tipo, quantidade, saldo_anterior, saldo_posterior, observacao, created_at, usuario:profiles(nome)")
        .eq("produto_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Movimentacao[];
    },
  });

export const acessoQuery = queryOptions({
  queryKey: ["acesso"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [{ data: perfil }, { data: nivel }] = await Promise.all([
      supabase.from("profiles").select("nome, email, tipo_conta").eq("id", u.user.id).maybeSingle(),
      supabase.rpc("nivel_acesso_setor", { _user: u.user.id, _setor: "estoque" }),
    ]);
    return { perfil, nivelEstoque: (nivel ?? "sem_acesso") as NivelAcesso };
  },
});
