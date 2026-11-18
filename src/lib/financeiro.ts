import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { MetodoPagamento, StatusPedido } from "@/lib/pedidos";

export interface FiltrosFinanceiros { inicio?: string; fim?: string; busca?: string; pagamento?: string; tipo?: string; status?: string; offset?: number; pedido_id?: string }
export interface MesFinanceiro { mes: string; entradas: number; saidas: number; resultado: number; pedidos: number }
export interface DashboardFinanceiro { caixa: number; receber: number; meses: MesFinanceiro[] }
export interface MovimentoFinanceiro { id: string; tipo: "entrada" | "saida"; valor: number; descricao: string; categoria: string; metodo_pagamento: MetodoPagamento; data_movimento: string; saldo: number; responsavel: string; pedido_id: string | null; estorno_de: string | null }
export interface PedidoFinanceiro { id: string; numero: number; cliente_nome: string; created_at: string; status: StatusPedido; valor_total: number | null; pago: number; pendente: number; status_pagamento: string; metodos: MetodoPagamento[] }
export interface ProdutoFinanceiro { produto_id: string; produto_nome: string; unidade: string; quantidade: number; valor: number; pedidos: number; primeira: string; ultima: string }
export interface PaginaFinanceira<T> { total: number; itens: T[] }
export const STATUS_FINANCEIROS = [{ value: "nao_pago", label: "Não pago" }, { value: "parcial", label: "Parcial" }, { value: "pago", label: "Pago" }, { value: "orcamento", label: "Orçamento" }, { value: "cancelado", label: "Cancelado" }];
export const labelFinanceiro = (s: string) => STATUS_FINANCEIROS.find(x => x.value === s)?.label ?? "Não calculado";
export function pendenciaFinanceira(status: StatusPedido, total: number | null, pago: number): number | null {
  if (status === "cancelado" || status === "orcamento") return 0;
  return total == null ? null : Math.max(0, Math.round((total - pago) * 100) / 100);
}
export const resultadoCaixa = (entradas: number, saidas: number) => Math.round((entradas - saidas) * 100) / 100;
export const valorMaterial = (preco: number, consumo: number) => preco * consumo;
export const aceitaRecebimento = (status: StatusPedido) => !["orcamento", "cancelado"].includes(status);
export function diaBrasil(d = new Date()) { return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(d); }
export function periodoFinanceiro(modo: string, mes: string, ano: string, hoje = diaBrasil()) {
  const y = Number(ano), m = Number(mes);
  if (modo === "todos") return { inicio: "1900-01-01", fim: hoje };
  if (modo === "30") { const d = new Date(hoje + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 29); return { inicio: d.toISOString().slice(0, 10), fim: hoje }; }
  if (modo === "ano") return { inicio: `${hoje.slice(0,4)}-01-01`, fim: hoje };
  if (modo === "especifico") return { inicio: `${y}-${String(m).padStart(2,"0")}-01`, fim: new Date(Date.UTC(y,m,0)).toISOString().slice(0,10) };
  return { inicio: hoje.slice(0,7) + "-01", fim: hoje };
}
export async function consultarFinanceiro<T>(area: string, filtros: FiltrosFinanceiros): Promise<T> {
  const { data, error } = await supabase.rpc("financeiro_consultar", { _area: area, _filtros: { ...filtros } as Json });
  if (error) throw error;
  return data as unknown as T;
}
export const dashboardFinanceiroQuery = (f: FiltrosFinanceiros) => queryOptions({ queryKey: ["financeiro", "dashboard", f], queryFn: () => consultarFinanceiro<DashboardFinanceiro>("dashboard", f) });
export const listaFinanceiraQuery = <T,>(area: string, f: FiltrosFinanceiros) => queryOptions({ queryKey: ["financeiro", area, f], queryFn: () => consultarFinanceiro<PaginaFinanceira<T>>(area, f) });
export async function lancarFinanceiro(dados: Record<string, Json | undefined>, chave: string) {
  const { data, error } = await supabase.rpc("financeiro_lancar", { _dados: dados, _chave: chave });
  if (error) throw error;
  return data;
}