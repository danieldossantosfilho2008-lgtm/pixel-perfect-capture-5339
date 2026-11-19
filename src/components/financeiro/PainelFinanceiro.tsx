import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { acessoQuery, fmtBRL } from "@/lib/estoque";
import { dashboardFinanceiroQuery, diaBrasil, periodoFinanceiro, periodoValido, type FiltrosFinanceiros } from "@/lib/financeiro";
import { PeriodoFinanceiro } from "./PeriodoFinanceiro";
import { GraficoFinanceiro } from "./GraficoFinanceiro";
import { HistoricoFinanceiro } from "./HistoricoFinanceiro";
import { LancamentoDialog } from "./LancamentoDialog";

type Detalhe = { titulo: string; area: "caixa" | "pedidos"; filtros: FiltrosFinanceiros };
export function PainelFinanceiro({ controle = false }: { controle?: boolean }) {
  const { data: acesso, isLoading: carregando, error: erroAcesso } = useQuery(acessoQuery);
  const hoje = diaBrasil();
  const [modo, setModo] = useState(controle ? "todos" : "ano");
  const [mes, setMes] = useState(hoje.slice(5, 7));
  const [ano, setAno] = useState(hoje.slice(0, 4));
  const [detalhe, setDetalhe] = useState<Detalhe>();
  const [novo, setNovo] = useState(false);
  const filtros = periodoFinanceiro(modo, mes, ano, hoje);
  const valido = periodoValido(filtros.inicio, filtros.fim);
  const permitido = acesso?.niveis.financeiro === "edicao" || acesso?.niveis.financeiro === "visualizacao";
  const podeEditar = acesso?.niveis.financeiro === "edicao";
  // A complete historical range belongs to the ledger, never to an unbounded monthly series.
  const periodoGrafico = modo === "todos" ? periodoFinanceiro("ano", mes, ano, hoje) : filtros;
  const { data, isLoading, error, refetch } = useQuery({ ...dashboardFinanceiroQuery(periodoGrafico), enabled: permitido && valido });
  function abrir(titulo: string, area: "caixa" | "pedidos", extras: FiltrosFinanceiros = {}, mesSelecionado?: string) {
    const periodo = mesSelecionado ? periodoFinanceiro("especifico", mesSelecionado.slice(5, 7), mesSelecionado.slice(0, 4), hoje) : periodoGrafico;
    setDetalhe({ titulo, area, filtros: { ...periodo, ...extras } });
  }
  if (carregando) return <Skeleton className="h-40" />;
  if (erroAcesso) return <p role="alert" className="text-destructive">Não foi possível verificar seu acesso.</p>;
  if (!permitido) return <p className="border-y py-6 text-muted-foreground">Você não tem acesso ao Financeiro.</p>;
  return <div className="min-w-0 space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">{controle ? "Controle Financeiro" : "Dashboard Financeiro"}</h1>{podeEditar && <Button onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Nova movimentação</Button>}</div>
    <PeriodoFinanceiro modo={modo} mes={mes} ano={ano} onModo={setModo} onMes={setMes} onAno={setAno} todos={controle} />
    {!valido ? <p role="alert" className="text-destructive">Informe um mês e um ano válidos.</p> : <>
      {isLoading ? <Skeleton className="h-32" /> : error ? <div role="alert">Não foi possível consultar o Financeiro. <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button></div> : data && <>
        <div className="grid gap-4 sm:grid-cols-2">
          <Button variant="outline" className="h-auto min-w-0 items-start justify-between gap-2 p-5 text-left" onClick={() => setDetalhe({ titulo: "Total em caixa", area: "caixa", filtros: {} })}><span className="flex min-w-0 flex-col gap-2"><span className="text-sm text-muted-foreground">Total em caixa</span><span className="break-words font-mono text-2xl">{fmtBRL(data.caixa)}</span></span><ArrowUpRight className="h-4 w-4 shrink-0" /></Button>
          <Button variant="outline" className="h-auto min-w-0 items-start justify-between gap-2 p-5 text-left" onClick={() => setDetalhe({ titulo: "Total a receber", area: "pedidos", filtros: { status: "pendente" } })}><span className="flex min-w-0 flex-col gap-2"><span className="text-sm text-muted-foreground">Total a receber</span><span className="break-words font-mono text-2xl">{fmtBRL(data.receber)}</span></span><ArrowUpRight className="h-4 w-4 shrink-0" /></Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {controle ? <>
            <GraficoFinanceiro titulo="Pedidos por mês" pontos={data.meses} campos={["pedidos"]} dinheiro={false} onDetalhe={m => abrir("Pedidos por mês", "pedidos", {}, m)} />
            <ComparacaoPedidos filtros={periodoGrafico} onDetalhe={m => abrir("Comparação de pedidos", "pedidos", {}, m)} />
          </> : <>
            <GraficoFinanceiro titulo="Comparação mensal" pontos={data.meses} campos={["entradas", "saidas"]} onDetalhe={m => abrir("Comparação mensal", "caixa", {}, m)} />
            <GraficoFinanceiro titulo="Saídas do período" pontos={data.meses} campos={["saidas"]} onDetalhe={m => abrir("Saídas do período", "caixa", { tipo: "saida" }, m)} />
            <GraficoFinanceiro titulo="Entradas do período" pontos={data.meses} campos={["entradas"]} onDetalhe={m => abrir("Entradas do período", "caixa", { tipo: "entrada" }, m)} />
            <GraficoFinanceiro titulo="Resultado de caixa" pontos={data.meses} campos={["resultado"]} onDetalhe={m => abrir("Resultado de caixa", "caixa", {}, m)} />
          </>}
        </div>
      </>}
      {controle && <Tabs defaultValue="caixa"><TabsList className="flex w-full sm:w-fit"><TabsTrigger value="caixa" className="flex-1">Caixa</TabsTrigger><TabsTrigger value="pedidos" className="flex-1">Pedidos</TabsTrigger><TabsTrigger value="produtos" className="flex-1">Produtos</TabsTrigger></TabsList>{(["caixa", "pedidos", "produtos"] as const).map(area => <TabsContent key={area} value={area}><HistoricoFinanceiro key={`${area}-${filtros.inicio}-${filtros.fim}`} area={area} filtros={filtros} podeEditar={podeEditar} /></TabsContent>)}</Tabs>}
    </>}
    {detalhe && <Dialog open onOpenChange={v => !v && setDetalhe(undefined)}><DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto"><DialogHeader><DialogTitle>{detalhe.titulo}</DialogTitle><DialogDescription>{detalhe.filtros.inicio ? `${detalhe.filtros.inicio.split("-").reverse().join("/")} – ${detalhe.filtros.fim?.split("-").reverse().join("/")}` : "Todo o histórico"}</DialogDescription></DialogHeader><HistoricoFinanceiro area={detalhe.area} filtros={detalhe.filtros} podeEditar={podeEditar} /></DialogContent></Dialog>}
    {novo && <LancamentoDialog onClose={() => setNovo(false)} />}
  </div>;
}
function ComparacaoPedidos({ filtros, onDetalhe }: { filtros: { inicio: string; fim: string }; onDetalhe: (mes?: string) => void }) {
  const anterior = (dia: string) => {
    const d = new Date(dia + "T12:00:00Z");
    const mes = d.getUTCMonth();
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    if (d.getUTCMonth() !== mes) d.setUTCDate(0);
    return d.toISOString().slice(0, 10);
  };
  const atual = useQuery(dashboardFinanceiroQuery(filtros));
  const passado = useQuery(dashboardFinanceiroQuery({ inicio: anterior(filtros.inicio), fim: anterior(filtros.fim) }));
  if (passado.isLoading) return <Skeleton className="h-60" />;
  if (passado.error) return <p role="alert">Não foi possível consultar o ano anterior.</p>;
  const pontos = (atual.data?.meses ?? []).map(m => ({ ...m, anterior: passado.data?.meses.find(p => p.mes.slice(5) === m.mes.slice(5))?.pedidos ?? 0 }));
  return <GraficoFinanceiro titulo="Pedidos e ano anterior" pontos={pontos} campos={["pedidos", "anterior"]} dinheiro={false} onDetalhe={onDetalhe} />;
}