import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { calcularConsumo, materiaisQuery, parseNum, type Material } from "@/lib/pedidos";
import { fmtNum } from "@/lib/estoque";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export interface ItemForm {
  produto_id: string;
  quantidade: string;
  largura: string;
  altura: string;
}

export interface ItemCalculado {
  item: ItemForm;
  material: Material | undefined;
  consumo: number | null;
  erro: string | null;
}

/** Calcula consumo e erros de cada item. `baixadoPorProduto` soma ao disponível o que este pedido já tirou do estoque. */
export function validarItens(itens: ItemForm[], materiais: Material[], baixadoPorProduto: Record<string, number> = {}) {
  const calc: ItemCalculado[] = itens.map((item) => {
    const material = materiais.find((m) => m.id === item.produto_id);
    const q = parseNum(item.quantidade);
    const l = parseNum(item.largura);
    const a = parseNum(item.altura);
    let erro: string | null = null;
    if (!material) erro = "Material indisponível";
    else if (q == null || Number.isNaN(q) || q <= 0) erro = "Quantidade deve ser maior que zero";
    else if ([l, a].some((v) => v != null && (Number.isNaN(v) || v <= 0))) erro = "Dimensões devem ser números positivos";
    else if (material.categoria_codigo === "tecido" && (l == null || a == null)) erro = "Informe largura e altura";
    const consumo = !erro && material ? calcularConsumo(material.categoria_codigo, q!, l, a) : null;
    return { item, material, consumo, erro };
  });
  const total: Record<string, number> = {};
  calc.forEach((c) => c.consumo && (total[c.item.produto_id] = (total[c.item.produto_id] ?? 0) + c.consumo));
  calc.forEach((c) => {
    if (c.erro || !c.material) return;
    const disp = c.material.quantidade + (baixadoPorProduto[c.material.id] ?? 0);
    if (total[c.material.id] > disp) c.erro = `Estoque insuficiente (disponível ${fmtNum(disp)} ${c.material.unidade})`;
  });
  return calc;
}

export function MateriaisEditor({
  itens,
  onChange,
  baixado,
}: {
  itens: ItemForm[];
  onChange: (i: ItemForm[]) => void;
  baixado?: Record<string, number>;
}) {
  const { data: materiais = [], isLoading, error } = useQuery(materiaisQuery);
  const [busca, setBusca] = useState("");
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return materiais.filter((m) =>
      !t || [m.nome, m.tipo, m.cor, m.categoria_nome, m.detalhe ?? ""].some((x) => x.toLowerCase().includes(t)),
    );
  }, [materiais, busca]);
  const calc = validarItens(itens, materiais, baixado);
  const set = (i: number, campo: keyof ItemForm, v: string) =>
    onChange(itens.map((it, j) => (j === i ? { ...it, [campo]: v } : it)));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded border border-border">
        <div className="flex items-center gap-2 border-b border-border p-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar material, tipo, cor…"
            className="h-8 border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-80 overflow-auto">
          {isLoading ? (
            <div className="space-y-2 p-3">{[1, 2, 3].map((k) => <Skeleton key={k} className="h-8" />)}</div>
          ) : error ? (
            <p className="p-4 text-sm text-destructive">Não foi possível carregar os materiais.</p>
          ) : filtrados.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum material encontrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-1.5">Material</th><th className="px-3 py-1.5 text-right">Disponível</th><th /></tr>
              </thead>
              <tbody>
                {filtrados.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-3 py-1.5">
                      <div className="font-medium">{m.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.categoria_nome} · {m.tipo} · {m.cor}{m.detalhe ? ` · ${m.detalhe}` : ""}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums">
                      {fmtNum(m.quantidade)} {m.unidade}
                    </td>
                    <td className="px-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Adicionar ${m.nome}`}
                        onClick={() => onChange([...itens, { produto_id: m.id, quantidade: "1", largura: "", altura: "" }])}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="rounded border border-border">
        <div className="border-b border-border px-3 py-2 text-sm font-medium">Selecionados ({itens.length})</div>
        {itens.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Adicione materiais pela lista ao lado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {calc.map((c, i) => {
              const tecido = c.material?.categoria_codigo === "tecido";
              return (
                <li key={i} className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{c.material?.nome ?? "Material indisponível"}</div>
                      <div className="text-xs text-muted-foreground">{c.material?.categoria_nome}</div>
                    </div>
                    <Button type="button" size="sm" variant="ghost" aria-label="Remover" onClick={() => onChange(itens.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-xs">
                      {tecido ? "Peças" : `Quantidade (${c.material?.unidade ?? "un"})`}
                      <Input inputMode="decimal" value={c.item.quantidade} onChange={(e) => set(i, "quantidade", e.target.value)} className="h-8" />
                    </label>
                    <label className="text-xs">
                      Largura (m){tecido && " *"}
                      <Input inputMode="decimal" value={c.item.largura} onChange={(e) => set(i, "largura", e.target.value)} className="h-8" />
                    </label>
                    <label className="text-xs">
                      Altura (m){tecido && " *"}
                      <Input inputMode="decimal" value={c.item.altura} onChange={(e) => set(i, "altura", e.target.value)} className="h-8" />
                    </label>
                  </div>
                  <div className="text-xs">
                    {c.erro ? (
                      <span className="text-destructive">{c.erro}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        Consumo: <span className="font-mono text-foreground">{fmtNum(c.consumo)} {c.material?.unidade}</span>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
