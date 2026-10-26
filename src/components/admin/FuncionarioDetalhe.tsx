import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  agruparPorDia, desempenhoQuery, ehVendedor, funcionarioDadosQuery, historicoFuncionarioQuery, isoDia,
  labelNivel, NIVEIS, PAGINAS, permissoesQuery, type Funcionario,
} from "@/lib/admin";
import { fmtBRL, fmtData, type NivelAcesso } from "@/lib/estoque";
import { FuncionarioForm } from "./FuncionarioForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export function FuncionarioDetalhe({ funcionario, onClose, podeEditar, meuId }: {
  funcionario: Funcionario | null; onClose: () => void; podeEditar: boolean; meuId?: string;
}) {
  const [editando, setEditando] = useState(false);
  const id = funcionario?.id ?? "";
  const dados = useQuery({ ...funcionarioDadosQuery(id), enabled: !!funcionario });

  return (
    <Sheet open={!!funcionario} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {funcionario && (
          <>
            <SheetHeader className="flex-row items-start justify-between gap-4 pr-8">
              <div>
                <SheetTitle>{funcionario.nome}</SheetTitle>
                <p className="text-sm text-muted-foreground">{funcionario.email}</p>
              </div>
              {podeEditar && (
                <Button size="sm" variant="outline" onClick={() => setEditando(true)} disabled={dados.isLoading}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
              )}
            </SheetHeader>

            <section className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <Campo rotulo="Cargo">
                {funcionario.cargo ? (
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: funcionario.cargo.cor }} />{funcionario.cargo.nome}</span>
                ) : "Sem cargo"}
              </Campo>
              <Campo rotulo="Tipo de conta">{funcionario.tipo_conta === "empresarial" ? "Empresarial (acesso total)" : "Profissional"}</Campo>
              {dados.isLoading ? <Skeleton className="h-10" /> : dados.error ? (
                <p className="col-span-2 text-destructive">Erro ao carregar dados: {(dados.error as Error).message}</p>
              ) : (
                <>
                  <Campo rotulo="Salário">{dados.data?.salario != null ? fmtBRL(dados.data.salario) : "—"}</Campo>
                  {ehVendedor(funcionario.cargo) && (
                    <Campo rotulo="Comissão">{dados.data?.comissao_percentual != null ? `${dados.data.comissao_percentual}% sobre o preço de venda` : "Não definida"}</Campo>
                  )}
                  {dados.data?.descricao && <div className="col-span-2"><Campo rotulo="Descrição">{dados.data.descricao}</Campo></div>}
                </>
              )}
            </section>

            {ehVendedor(funcionario.cargo) && <Desempenho id={id} percentual={dados.data?.comissao_percentual ?? null} />}

            <Permissoes funcionario={funcionario} podeEditar={podeEditar && funcionario.id !== meuId} proprio={funcionario.id === meuId} />
            <Historico id={id} />

            {editando && <FuncionarioForm open onOpenChange={setEditando} funcionario={funcionario} dados={dados.data} />}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function Permissoes({ funcionario, podeEditar, proprio }: { funcionario: Funcionario; podeEditar: boolean; proprio: boolean }) {
  const qc = useQueryClient();
  const q = useQuery(permissoesQuery(funcionario.id));
  const [rascunho, setRascunho] = useState<Record<string, NivelAcesso>>({});
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (q.data) setRascunho(q.data); return undefined; }, [q.data]);
  const empresarial = funcionario.tipo_conta === "empresarial";
  const editavel = podeEditar && !empresarial;
  const mudou = q.data && PAGINAS.some((p) => rascunho[p.codigo] !== q.data[p.codigo]);

  async function salvar() {
    setSalvando(true);
    const { error } = await supabase.rpc("definir_permissoes_funcionario", { _id: funcionario.id, _perms: rascunho });
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Permissões salvas");
    qc.invalidateQueries({ queryKey: ["funcionarios", funcionario.id] });
    qc.invalidateQueries({ queryKey: ["acesso"] });
  }

  return (
    <section className="mt-8">
      <h3 className="mb-2 font-semibold">Permissões de acesso</h3>
      {empresarial && <p className="mb-2 text-sm text-muted-foreground">Conta empresarial: acesso total a todas as páginas.</p>}
      {proprio && !empresarial && <p className="mb-2 text-sm text-muted-foreground">Você não pode alterar as próprias permissões.</p>}
      {q.isLoading ? <Skeleton className="h-32" /> : q.error ? (
        <p className="text-sm text-destructive">Erro ao carregar permissões.</p>
      ) : (
        <div className="divide-y rounded-md border">
          {PAGINAS.map((p) => (
            <div key={p.codigo} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
              <span>{p.nome}</span>
              {editavel ? (
                <Select value={rascunho[p.codigo] ?? "sem_acesso"} onValueChange={(v) => setRascunho((r) => ({ ...r, [p.codigo]: v as NivelAcesso }))}>
                  <SelectTrigger className="h-8 w-40" aria-label={`Acesso a ${p.nome}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{NIVEIS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}</SelectContent>
                </Select>
              ) : <span className="text-muted-foreground">{labelNivel(rascunho[p.codigo] ?? null)}</span>}
            </div>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-muted-foreground">Edição inclui visualização.</p>
      {editavel && mudou && (
        <div className="mt-2 flex justify-end"><Button size="sm" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar permissões"}</Button></div>
      )}
    </section>
  );
}

function Historico({ id }: { id: string }) {
  const q = useQuery(historicoFuncionarioQuery(id));
  return (
    <section className="mt-8">
      <h3 className="mb-2 font-semibold">Histórico</h3>
      {q.isLoading ? <Skeleton className="h-20" /> : q.error ? (
        <p className="text-sm text-destructive">Erro ao carregar histórico.</p>
      ) : !q.data?.length ? (
        <p className="text-sm text-muted-foreground">Nenhum registro (funcionário cadastrado antes desta tela existir).</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {q.data.map((h) => (
            <li key={h.id} className="rounded border px-3 py-2">
              <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                <span>{h.usuario?.nome ?? "Sistema"}</span><span>{fmtData(h.created_at)}</span>
              </div>
              <div><strong>{h.campo}</strong>{h.valor_anterior != null || h.valor_novo != null ? ": " : ""}
                {h.valor_anterior != null && <span className="text-muted-foreground line-through">{h.campo.startsWith("Permissão") ? labelNivel(h.valor_anterior) : h.valor_anterior}</span>}
                {h.valor_anterior != null && " → "}
                {h.campo.startsWith("Permissão") ? labelNivel(h.valor_novo) : (h.valor_novo ?? "—")}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Desempenho({ id, percentual }: { id: string; percentual: number | null }) {
  const hoje = new Date();
  const [fim, setFim] = useState(isoDia(hoje));
  const [inicio, setInicio] = useState(isoDia(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 29)));
  const valido = inicio && fim && inicio <= fim;
  const q = useQuery({ ...desempenhoQuery(id, inicio, fim), enabled: !!valido });
  const r = q.data ? agruparPorDia(q.data, inicio, fim, percentual) : null;
  const pontos = r?.pontos.map((p) => ({ ...p, rotulo: p.dia.slice(8, 10) + "/" + p.dia.slice(5, 7) })) ?? [];

  return (
    <section className="mt-8 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <h3 className="mr-auto font-semibold">Desempenho de vendas</h3>
        <div className="space-y-1"><Label htmlFor="d-ini" className="text-xs">De</Label><Input id="d-ini" type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} className="h-8" /></div>
        <div className="space-y-1"><Label htmlFor="d-fim" className="text-xs">Até</Label><Input id="d-fim" type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} className="h-8" /></div>
        <div className="rounded-md bg-highlight px-4 py-1.5 text-highlight-foreground">
          <div className="text-[10px] uppercase tracking-wide">Vendas no período</div>
          <div className="text-xl font-bold leading-tight">{r ? r.total : "—"}</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Conta somente pedidos com status Concluído, pela data em que foram concluídos.</p>
      {!valido ? <p className="text-sm text-destructive">Período inválido.</p> : q.isLoading ? <Skeleton className="h-56" /> : q.error ? (
        <p className="text-sm text-destructive">Erro ao carregar desempenho: {(q.error as Error).message}</p>
      ) : r && (
        <>
          <div className="rounded-md border p-3">
            <div className="mb-2 text-sm font-medium">Quantidade de vendas</div>
            <ChartContainer config={{ quantidade: { label: "Vendas", color: "var(--chart-1)" } }} className="h-48 w-full">
              <BarChart data={pontos}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="rotulo" tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="quantidade" fill="var(--color-quantidade)" radius={3} />
              </BarChart>
            </ChartContainer>
          </div>
          <div className="rounded-md border p-3">
            <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="font-medium">Valores das vendas</span>
              <span>Valor final: <strong>{fmtBRL(r.valor)}</strong></span>
              <span>Lucro: <strong className="text-muted-foreground">Não calculado</strong></span>
              <span>Comissão: <strong>{r.comissao == null ? "Não calculado" : fmtBRL(r.comissao)}</strong></span>
            </div>
            <ChartContainer
              config={{ valor: { label: "Valor final", color: "var(--chart-1)" }, comissao: { label: "Comissão", color: "var(--chart-2)" } }}
              className="h-56 w-full"
            >
              <BarChart data={pontos}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="rotulo" tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis width={60} tickLine={false} axisLine={false} tickFormatter={(v) => fmtBRL(v).replace(",00", "")} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => (
                  <span>{n === "valor" ? "Valor final" : "Comissão"}: <strong>{fmtBRL(Number(v))}</strong></span>
                )} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="valor" fill="var(--color-valor)" radius={3} />
                {percentual != null && <Bar dataKey="comissao" fill="var(--color-comissao)" radius={3} />}
              </BarChart>
            </ChartContainer>
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              <li>Lucro: o sistema ainda não tem regra de custo/lucro definida, por isso não é exibido.</li>
              {percentual == null && <li>Comissão: defina o percentual de comissão deste vendedor para calcular.</li>}
              {r.semPreco > 0 && <li>{r.semPreco} venda(s) concluída(s) sem preço de venda não entram nos valores.</li>}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
