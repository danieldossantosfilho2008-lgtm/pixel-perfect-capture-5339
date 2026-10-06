import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDownUp, ArrowLeftRight, Eye, MoreHorizontal, Pencil, Plus, Power, Search } from "lucide-react";
import {
  acessoQuery,
  categoriasQuery,
  fmtBRL,
  fmtNum,
  produtosQuery,
  situacao,
  unidade,
  type Produto,
  type Situacao,
} from "@/lib/estoque";
import { SituacaoBadge, StatusBadge } from "@/components/estoque/SituacaoBadge";
import { ProdutoFormDialog } from "@/components/estoque/ProdutoFormDialog";
import { MovimentarDialog } from "@/components/estoque/MovimentarDialog";
import { StatusConfirm } from "@/components/estoque/StatusConfirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/estoque/")({
  head: () => ({
    meta: [
      { title: "Estoque — Gestão de Persianas" },
      { name: "description", content: "Controle de tecidos, trilhos e bandôs com indicadores e movimentações." },
      { property: "og:title", content: "Estoque — Gestão de Persianas" },
      { property: "og:description", content: "Controle de tecidos, trilhos e bandôs." },
    ],
  }),
  component: EstoquePage,
});

type Ordem = "nome" | "quantidade" | "preco" | "categoria" | "atualizado";
const POR_PAGINA = 20;

function EstoquePage() {
  const navigate = useNavigate();
  const { data: produtos, isLoading, error, refetch } = useQuery(produtosQuery);
  const { data: categorias = [] } = useQuery(categoriasQuery);
  const { data: acesso } = useQuery(acessoQuery);
  const podeEditar = acesso?.nivelEstoque === "edicao";

  const [busca, setBusca] = useState("");
  const [fCat, setFCat] = useState("todas");
  const [fStatus, setFStatus] = useState("ativo");
  const [fSit, setFSit] = useState("todas");
  const [ordem, setOrdem] = useState<Ordem>("nome");
  const [asc, setAsc] = useState(true);
  const [pagina, setPagina] = useState(1);

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [movAberto, setMovAberto] = useState(false);
  const [movProduto, setMovProduto] = useState<string | null>(null);
  const [statusProduto, setStatusProduto] = useState<Produto | null>(null);

  const lista = produtos ?? [];
  const indicadores = useMemo(() => {
    const ativos = lista.filter((p) => p.status === "ativo");
    return {
      total: ativos.length,
      baixo: ativos.filter((p) => situacao(p) === "baixo").length,
      zerado: ativos.filter((p) => situacao(p) === "sem_estoque").length,
      itens: ativos.reduce((s, p) => s + p.quantidade, 0),
    };
  }, [lista]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const r = lista.filter((p) => {
      if (fCat !== "todas" && p.categoria_id !== fCat) return false;
      if (fStatus !== "todos" && p.status !== fStatus) return false;
      if (fSit !== "todas" && situacao(p) !== fSit) return false;
      if (!t) return true;
      return [p.nome, p.tipo, p.cor, p.descricao ?? "", ...Object.values(p.atributos)].some((v) =>
        v.toLowerCase().includes(t),
      );
    });
    const dir = asc ? 1 : -1;
    r.sort((a, b) => {
      switch (ordem) {
        case "quantidade":
          return (a.quantidade - b.quantidade) * dir;
        case "preco":
          return (a.preco - b.preco) * dir;
        case "categoria":
          return (a.categoria?.nome ?? "").localeCompare(b.categoria?.nome ?? "") * dir;
        case "atualizado":
          return a.updated_at.localeCompare(b.updated_at) * dir;
        default:
          return a.nome.localeCompare(b.nome, "pt-BR") * dir;
      }
    });
    return r;
  }, [lista, busca, fCat, fStatus, fSit, ordem, asc]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const pag = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);

  const ordenar = (o: Ordem) => {
    if (ordem === o) setAsc(!asc);
    else {
      setOrdem(o);
      setAsc(true);
    }
  };
  const Th = ({ o, children, className }: { o?: Ordem; children: React.ReactNode; className?: string }) => (
    <th className={cn("whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground", className)}>
      {o ? (
        <button onClick={() => ordenar(o)} className={cn("inline-flex items-center gap-1 hover:text-foreground", ordem === o && "text-foreground")}>
          {children} <ArrowDownUp className="h-3 w-3" />
        </button>
      ) : (
        children
      )}
    </th>
  );

  if (acesso && acesso.nivelEstoque === "sem_acesso") {
    return <div className="rounded-md border bg-card p-10 text-center text-muted-foreground">Você não tem acesso ao setor de Estoque.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Módulo</p>
          <h1 className="text-3xl font-semibold tracking-tight">Estoque</h1>
        </div>
        {podeEditar && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setMovProduto(null); setMovAberto(true); }}>
              <ArrowLeftRight className="h-4 w-4" /> Movimentar
            </Button>
            <Button onClick={() => { setEditando(null); setFormAberto(true); }} className="bg-highlight text-highlight-foreground hover:bg-highlight/90">
              <Plus className="h-4 w-4" /> Adicionar produto
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border lg:grid-cols-4">
        <Indicador rotulo="Total de produtos" valor={indicadores.total} nota="ativos" onClick={() => { setFSit("todas"); setFStatus("ativo"); }} />
        <Indicador rotulo="Estoque baixo" valor={indicadores.baixo} tom="warning" onClick={() => { setFSit("baixo"); setFStatus("ativo"); }} />
        <Indicador rotulo="Sem estoque" valor={indicadores.zerado} tom="destructive" onClick={() => { setFSit("sem_estoque"); setFStatus("ativo"); }} />
        <Indicador rotulo="Total de itens em estoque" valor={fmtNum(indicadores.itens)} nota="m² + unidades" />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar nome, tipo, cor, variação..." className="pl-8" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} />
        </div>
        <Select value={fCat} onValueChange={(v) => { setFCat(v); setPagina(1); }}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={(v) => { setFStatus(v); setPagina(1); }}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fSit} onValueChange={(v) => { setFSit(v); setPagina(1); }}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Toda situação</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="baixo">Estoque baixo</SelectItem>
            <SelectItem value="sem_estoque">Sem estoque</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <Th o="nome">Nome</Th>
              <Th o="categoria">Categoria</Th>
              <Th>Tipo</Th>
              <Th>Cor</Th>
              <Th>Variação / Dimensão</Th>
              <Th o="quantidade" className="text-right">Qtd. atual</Th>
              <Th className="text-right">Mín.</Th>
              <Th className="text-right">Máx.</Th>
              <Th o="preco" className="text-right">Preço</Th>
              <Th>Situação</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b"><td colSpan={12} className="px-3 py-3"><Skeleton className="h-5 w-full" /></td></tr>
              ))}
            {error && (
              <tr><td colSpan={12} className="px-3 py-10 text-center">
                <p className="text-destructive">Não foi possível carregar os produtos.</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>Tentar novamente</Button>
              </td></tr>
            )}
            {!isLoading && !error && visiveis.length === 0 && (
              <tr><td colSpan={12} className="px-3 py-14 text-center text-muted-foreground">
                {lista.length === 0 ? "Nenhum produto cadastrado ainda." : "Nenhum produto encontrado com esses filtros."}
              </td></tr>
            )}
            {visiveis.map((p) => {
              const s = situacao(p);
              const especifico = p.atributos["variacao"] ?? p.atributos["dimensao"] ?? "—";
              return (
                <tr key={p.id} className={cn("border-b last:border-0 hover:bg-muted/30", p.status === "inativo" && "text-muted-foreground")}>
                  <td className="px-3 py-2.5 font-medium">
                    <Link to="/estoque/$id" params={{ id: p.id }} className="hover:underline">{p.nome}</Link>
                  </td>
                  <td className="px-3 py-2.5">{p.categoria?.nome}</td>
                  <td className="px-3 py-2.5">{p.tipo}</td>
                  <td className="px-3 py-2.5">{p.cor}</td>
                  <td className="px-3 py-2.5">{especifico}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono">
                    {fmtNum(p.quantidade)} <span className="text-xs text-muted-foreground">{unidade(p)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmtNum(p.estoque_min)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmtNum(p.estoque_max)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono">{fmtBRL(p.preco)}</td>
                  <td className="px-3 py-2.5"><SituacaoBadge s={s as Situacao} /></td>
                  <td className="px-3 py-2.5"><StatusBadge ativo={p.status === "ativo"} /></td>
                  <td className="px-3 py-2.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ações de ${p.nome}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate({ to: "/estoque/$id", params: { id: p.id } })}>
                          <Eye className="h-4 w-4" /> Visualizar
                        </DropdownMenuItem>
                        {podeEditar && (
                          <>
                            <DropdownMenuItem onClick={() => { setEditando(p); setFormAberto(true); }}>
                              <Pencil className="h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setMovProduto(p.id); setMovAberto(true); }}>
                              <ArrowLeftRight className="h-4 w-4" /> Movimentar estoque
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setStatusProduto(p)} className={p.status === "ativo" ? "text-destructive" : ""}>
                              <Power className="h-4 w-4" /> {p.status === "ativo" ? "Inativar" : "Reativar"}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtrados.length > POR_PAGINA && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filtrados.length} produtos · página {pag} de {totalPaginas}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pag <= 1} onClick={() => setPagina(pag - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={pag >= totalPaginas} onClick={() => setPagina(pag + 1)}>Próxima</Button>
          </div>
        </div>
      )}

      <ProdutoFormDialog open={formAberto} onOpenChange={setFormAberto} produto={editando} />
      <MovimentarDialog open={movAberto} onOpenChange={setMovAberto} produtoId={movProduto} />
      <StatusConfirm produto={statusProduto} onClose={() => setStatusProduto(null)} />
    </div>
  );
}

function Indicador({ rotulo, valor, nota, tom, onClick }: { rotulo: string; valor: number | string; nota?: string; tom?: "warning" | "destructive"; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="bg-card p-4 text-left transition-colors enabled:hover:bg-muted/40">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {tom && <span className={cn("h-2 w-2 rounded-full", tom === "warning" ? "bg-warning" : "bg-destructive")} />}
        {rotulo}
      </div>
      <div className="mt-1 font-mono text-3xl font-medium">{valor}</div>
      {nota && <div className="text-xs text-muted-foreground">{nota}</div>}
    </button>
  );
}
