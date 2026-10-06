import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ArrowLeftRight, Pencil, Power } from "lucide-react";
import {
  acessoQuery,
  fmtBRL,
  fmtData,
  fmtNum,
  labelMov,
  movimentacoesQuery,
  produtoQuery,
  sinalMov,
  situacao,
  unidade,
} from "@/lib/estoque";
import { SituacaoBadge, StatusBadge } from "@/components/estoque/SituacaoBadge";
import { ProdutoFormDialog } from "@/components/estoque/ProdutoFormDialog";
import { MovimentarDialog } from "@/components/estoque/MovimentarDialog";
import { StatusConfirm } from "@/components/estoque/StatusConfirm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/estoque/$id")({
  head: () => ({
    meta: [
      { title: "Detalhes do produto — Estoque" },
      { name: "description", content: "Dados cadastrais e histórico de movimentações do produto." },
      { property: "og:title", content: "Detalhes do produto — Estoque" },
      { property: "og:description", content: "Dados cadastrais e histórico de movimentações." },
    ],
  }),
  component: DetalhePage,
});

function DetalhePage() {
  const { id } = Route.useParams();
  const { data: p, isLoading } = useQuery(produtoQuery(id));
  const { data: movs, isLoading: carregandoMovs } = useQuery(movimentacoesQuery(id));
  const { data: acesso } = useQuery(acessoQuery);
  const podeEditar = acesso?.nivelEstoque === "edicao";
  const [editar, setEditar] = useState(false);
  const [mov, setMov] = useState(false);
  const [status, setStatus] = useState(false);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!p)
    return (
      <div className="rounded-md border bg-card p-10 text-center">
        <p className="text-muted-foreground">Produto não encontrado.</p>
        <Link to="/estoque" className="mt-3 inline-block text-sm underline">Voltar ao estoque</Link>
      </div>
    );

  const un = unidade(p);
  const campos: [string, React.ReactNode][] = [
    ["Categoria", p.categoria?.nome],
    ["Tipo", p.tipo],
    ["Cor", p.cor],
    ...(p.categoria?.codigo === "tecido"
      ? [["Variação", p.atributos.variacao ?? "—"] as [string, React.ReactNode]]
      : [["Dimensão", p.atributos.dimensao ?? "—"] as [string, React.ReactNode]]),
    ["Preço", fmtBRL(p.preco)],
    ["Estoque mínimo", `${fmtNum(p.estoque_min)} ${p.estoque_min != null ? un : ""}`],
    ["Estoque máximo", `${fmtNum(p.estoque_max)} ${p.estoque_max != null ? un : ""}`],
    ["Status", <StatusBadge key="s" ativo={p.status === "ativo"} />],
    ["Criado em", fmtData(p.created_at)],
    ["Atualizado em", fmtData(p.updated_at)],
  ];

  return (
    <div className="space-y-6">
      <Link to="/estoque" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Estoque
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{p.categoria?.nome}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{p.nome}</h1>
          {p.descricao && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{p.descricao}</p>}
        </div>
        {podeEditar && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditar(true)}><Pencil className="h-4 w-4" /> Editar</Button>
            <Button variant="outline" onClick={() => setStatus(true)}>
              <Power className="h-4 w-4" /> {p.status === "ativo" ? "Inativar" : "Reativar"}
            </Button>
            <Button onClick={() => setMov(true)} className="bg-highlight text-highlight-foreground hover:bg-highlight/90">
              <ArrowLeftRight className="h-4 w-4" /> Movimentar estoque
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-md border bg-card p-5">
          <div className="text-xs text-muted-foreground">Quantidade atual</div>
          <div className="mt-1 font-mono text-4xl font-medium">
            {fmtNum(p.quantidade)} <span className="text-base text-muted-foreground">{un}</span>
          </div>
          <div className="mt-3"><SituacaoBadge s={situacao(p)} /></div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border bg-card p-5 sm:grid-cols-3 lg:grid-cols-5">
          {campos.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Histórico de movimentações</h2>
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Data</th>
                <th className="px-3 py-2.5 font-medium">Tipo</th>
                <th className="px-3 py-2.5 text-right font-medium">Qtd. movimentada</th>
                <th className="px-3 py-2.5 text-right font-medium">Saldo anterior</th>
                <th className="px-3 py-2.5 text-right font-medium">Saldo posterior</th>
                <th className="px-3 py-2.5 font-medium">Usuário</th>
                <th className="px-3 py-2.5 font-medium">Observação</th>
              </tr>
            </thead>
            <tbody>
              {carregandoMovs && (
                <tr><td colSpan={7} className="p-3"><Skeleton className="h-5 w-full" /></td></tr>
              )}
              {!carregandoMovs && movs?.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">Nenhuma movimentação registrada.</td></tr>
              )}
              {movs?.map((m) => {
                const s = sinalMov(m.tipo);
                return (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">{fmtData(m.created_at)}</td>
                    <td className="px-3 py-2.5">{labelMov(m.tipo)}</td>
                    <td className={cn("px-3 py-2.5 text-right font-mono", s > 0 ? "text-success" : "text-destructive")}>
                      {s > 0 ? "+" : "−"}{fmtNum(m.quantidade)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmtNum(m.saldo_anterior)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium">{fmtNum(m.saldo_posterior)}</td>
                    <td className="px-3 py-2.5">{m.usuario?.nome ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{m.observacao ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ProdutoFormDialog open={editar} onOpenChange={setEditar} produto={p} />
      <MovimentarDialog open={mov} onOpenChange={setMov} produtoId={p.id} />
      <StatusConfirm produto={status ? p : null} onClose={() => setStatus(false)} />
    </div>
  );
}
