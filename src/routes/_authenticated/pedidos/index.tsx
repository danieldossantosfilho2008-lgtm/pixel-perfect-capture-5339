import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDownUp, History, Plus, Search } from "lucide-react";
import {
  idCurto, labelStatus, METODOS_PAGAMENTO, pedidosQuery, STATUS_PEDIDO, valorPedido, vendedoresQuery,
} from "@/lib/pedidos";
import { fmtData, fmtNum } from "@/lib/estoque";
import { Pagamento, StatusPedidoBadge, Valor } from "@/components/pedidos/PedidoBadges";
import { HistoricoDialog } from "@/components/pedidos/HistoricoDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  head: () => ({
    meta: [
      { title: "Pedidos — Gestão de Persianas" },
      { name: "description", content: "Acompanhe, filtre e edite os pedidos gerados pelas vendas." },
      { property: "og:title", content: "Pedidos — Gestão de Persianas" },
      { property: "og:description", content: "Gerenciamento de pedidos com histórico e integração ao estoque." },
    ],
  }),
  component: PedidosPage,
});

type Ordem = "data" | "cliente" | "valor" | "status";

function PedidosPage() {
  const { data: pedidos, isLoading, error, refetch } = useQuery(pedidosQuery);
  const { data: vendedores = [] } = useQuery(vendedoresQuery);
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [fVend, setFVend] = useState("todos");
  const [fPag, setFPag] = useState("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("data");
  const [asc, setAsc] = useState(false);
  const [hist, setHist] = useState<string | null>(null);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase().replace(/^#/, "");
    const r = (pedidos ?? []).filter((p) => {
      if (t && !(p.cliente_nome.toLowerCase().includes(t) || String(p.numero).includes(t.replace(/^0+/, "") || "0") || p.id.startsWith(t))) return false;
      if (fStatus !== "todos" && p.status !== fStatus) return false;
      if (fVend !== "todos" && p.vendedor_id !== fVend) return false;
      if (fPag !== "todos" && p.metodo_pagamento !== fPag) return false;
      const d = p.updated_at.slice(0, 10);
      const dl = new Date(p.updated_at).toLocaleDateString("sv-SE");
      if (de && (dl || d) < de) return false;
      if (ate && (dl || d) > ate) return false;
      return true;
    });
    const dir = asc ? 1 : -1;
    const ordStatus = (s: string) => labelStatus(s);
    r.sort((a, b) => {
      if (ordem === "cliente") return dir * a.cliente_nome.localeCompare(b.cliente_nome, "pt-BR");
      if (ordem === "status") return dir * ordStatus(a.status).localeCompare(ordStatus(b.status), "pt-BR");
      if (ordem === "valor") {
        const va = valorPedido(a), vb = valorPedido(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return dir * (va - vb);
      }
      return dir * a.updated_at.localeCompare(b.updated_at);
    });
    return r;
  }, [pedidos, busca, fStatus, fVend, fPag, de, ate, ordem, asc]);

  const Th = ({ o, children }: { o?: Ordem; children: React.ReactNode }) => (
    <th className="whitespace-nowrap px-3 py-2 font-medium">
      {o ? (
        <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => (ordem === o ? setAsc(!asc) : (setOrdem(o), setAsc(true)))}>
          {children} <ArrowDownUp className={ordem === o ? "h-3 w-3 text-foreground" : "h-3 w-3 opacity-40"} />
        </button>
      ) : children}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">{pedidos ? `${lista.length} de ${pedidos.length} pedidos` : "Carregando…"}</p>
        </div>
        <Button asChild><Link to="/vendas"><Plus className="h-4 w-4" /> Nova venda</Link></Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por ID ou cliente" className="pl-8" />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_PEDIDO.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fVend} onValueChange={setFVend}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os vendedores</SelectItem>
            {vendedores.map((v) => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fPag} onValueChange={setFPag}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo pagamento</SelectItem>
            {METODOS_PAGAMENTO.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" aria-label="De" value={de} onChange={(e) => setDe(e.target.value)} className="w-38" />
        <Input type="date" aria-label="Até" value={ate} onChange={(e) => setAte(e.target.value)} className="w-38" />
      </div>

      <div className="overflow-x-auto rounded border border-border">
        {isLoading ? (
          <div className="space-y-2 p-4">{[1, 2, 3, 4].map((k) => <Skeleton key={k} className="h-10" />)}</div>
        ) : error ? (
          <div className="p-6 text-sm">
            <p className="text-destructive">Não foi possível carregar os pedidos.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        ) : !pedidos?.length ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhum pedido ainda. Registre uma venda para criar o primeiro.</p>
        ) : !lista.length ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhum pedido corresponde aos filtros.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <Th o="data">Data</Th><Th>ID</Th><Th o="cliente">Cliente</Th><Th>Pedido</Th><Th>Materiais</Th>
                <Th o="status">Status</Th><Th o="valor">Valor</Th><Th>Pagamento</Th><Th>Localização</Th><Th>Vendedor</Th><Th>Histórico</Th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className="border-t border-border align-top hover:bg-muted/50">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{fmtData(p.updated_at)}</td>
                  <td className="px-3 py-2">
                    <Link to="/pedidos/$id" params={{ id: p.id }} className="font-mono font-medium underline-offset-2 hover:underline">{idCurto(p.numero)}</Link>
                  </td>
                  <td className="px-3 py-2 font-medium">{p.cliente_nome}</td>
                  <td className="max-w-48 truncate px-3 py-2 text-muted-foreground" title={p.descricao ?? ""}>{p.descricao ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {p.itens.map((i) => <div key={i.id} className="whitespace-nowrap">{i.produto_nome} · {fmtNum(i.consumo)} {i.unidade}</div>)}
                  </td>
                  <td className="px-3 py-2"><StatusPedidoBadge s={p.status} /></td>
                  <td className="whitespace-nowrap px-3 py-2"><Valor v={valorPedido(p)} /></td>
                  <td className="px-3 py-2"><Pagamento m={p.metodo_pagamento} /></td>
                  <td className="max-w-48 truncate px-3 py-2 text-muted-foreground" title={p.endereco ?? ""}>{p.endereco ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{p.vendedor?.nome ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="ghost" aria-label="Ver histórico" onClick={() => setHist(p.id)}><History className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <HistoricoDialog pedidoId={hist} onClose={() => setHist(null)} />
    </div>
  );
}
