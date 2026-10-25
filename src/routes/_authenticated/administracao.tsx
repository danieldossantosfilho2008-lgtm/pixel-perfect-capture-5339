import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Palette, Plus } from "lucide-react";
import { acessoQuery } from "@/lib/estoque";
import { cargosQuery, corTexto, ehVendedor, funcionariosQuery, type Cargo, type Funcionario } from "@/lib/admin";
import { FuncionarioForm } from "@/components/admin/FuncionarioForm";
import { FuncionarioDetalhe } from "@/components/admin/FuncionarioDetalhe";
import { CargoDialog } from "@/components/admin/CargoDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/administracao")({
  head: () => ({
    meta: [
      { title: "Administração — Gestão de Persianas" },
      { name: "description", content: "Cadastro de funcionários, cargos e permissões de acesso." },
      { property: "og:title", content: "Administração — Gestão de Persianas" },
      { property: "og:description", content: "Gerencie funcionários, cargos, permissões e desempenho de vendedores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { data: acesso, isLoading: carregandoAcesso } = useQuery(acessoQuery);
  const { data: funcionarios, isLoading, error, refetch } = useQuery(funcionariosQuery);
  const { data: cargos = [] } = useQuery(cargosQuery);
  const [novo, setNovo] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [cargoEdit, setCargoEdit] = useState<Cargo | null | undefined>(undefined);
  const podeEditar = acesso?.niveis.administracao === "edicao";
  const sel = funcionarios?.find((f) => f.id === selId) ?? null;

  const { vendedores, grupos } = useMemo(() => {
    const vendedores: Funcionario[] = [];
    const mapa = new Map<string, { nome: string; itens: Funcionario[] }>();
    for (const f of funcionarios ?? []) {
      if (ehVendedor(f.cargo)) { vendedores.push(f); continue; }
      const k = f.cargo?.id ?? "_sem";
      if (!mapa.has(k)) mapa.set(k, { nome: f.cargo?.nome ?? "Sem cargo", itens: [] });
      mapa.get(k)!.itens.push(f);
    }
    const grupos = [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return { vendedores, grupos };
  }, [funcionarios]);

  if (carregandoAcesso) return <Skeleton className="h-40" />;
  if (acesso && acesso.niveis.administracao === "sem_acesso") {
    return <p className="rounded-md border p-6 text-sm text-muted-foreground">Você não tem acesso à Administração.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold">Administração</h1>
          <p className="text-sm text-muted-foreground">Funcionários, cargos e permissões</p>
        </div>
        {podeEditar && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline"><Palette className="h-4 w-4" /> Cargos</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Editar cargo</DropdownMenuLabel>
                {cargos.map((c) => (
                  <DropdownMenuItem key={c.id} onSelect={() => setCargoEdit(c)}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.cor }} /> {c.nome}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setCargoEdit(null)}><Plus className="h-4 w-4" /> Novo cargo</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Novo funcionário</Button>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 p-4 text-sm">
          Não foi possível carregar os funcionários. <Button size="sm" variant="link" onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      ) : !funcionarios?.length ? (
        <p className="rounded-md border p-6 text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 lg:divide-x lg:gap-0">
          <section className="lg:pr-6">
            <h2 className="mb-3 font-semibold">Vendedores</h2>
            {vendedores.length ? <Cards lista={vendedores} onClick={setSelId} /> : <Vazio texto="Nenhum vendedor cadastrado." />}
          </section>
          <section className="lg:pl-6">
            <h2 className="mb-3 font-semibold">Demais funcionários</h2>
            {grupos.length ? grupos.map((g) => (
              <div key={g.nome} className="mb-5">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.nome}</h3>
                <Cards lista={g.itens} onClick={setSelId} />
              </div>
            )) : <Vazio texto="Nenhum outro funcionário cadastrado." />}
          </section>
        </div>
      )}

      {novo && <FuncionarioForm open onOpenChange={setNovo} />}
      {cargoEdit !== undefined && <CargoDialog open onOpenChange={(v) => !v && setCargoEdit(undefined)} cargo={cargoEdit} />}
      <FuncionarioDetalhe funcionario={sel} onClose={() => setSelId(null)} podeEditar={podeEditar} meuId={acesso?.userId} />
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{texto}</p>;
}

function Cards({ lista, onClick }: { lista: Funcionario[]; onClick: (id: string) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
      {lista.map((f) => {
        const cor = f.cargo?.cor ?? "#64748b";
        return (
          <button
            key={f.id}
            onClick={() => onClick(f.id)}
            className="flex h-24 flex-col justify-between rounded-lg p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ background: cor, color: corTexto(cor) }}
          >
            <span className="line-clamp-2 font-semibold leading-tight">{f.nome}</span>
            <span className="text-[11px] opacity-90">{f.cargo?.nome ?? "Sem cargo"}</span>
          </button>
        );
      })}
    </div>
  );
}
