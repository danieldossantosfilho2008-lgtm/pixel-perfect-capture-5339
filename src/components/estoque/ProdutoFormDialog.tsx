import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { categoriasQuery, erroMsg, fmtNum, type Produto, type StatusProduto } from "@/lib/estoque";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  produto?: Produto | null;
}

type Campos = {
  categoria_id: string;
  nome: string;
  tipo: string;
  cor: string;
  descricao: string;
  quantidade: string;
  preco: string;
  estoque_min: string;
  estoque_max: string;
  status: StatusProduto;
};
const vazio: Campos = {
  categoria_id: "",
  nome: "",
  tipo: "",
  cor: "",
  descricao: "",
  quantidade: "0",
  preco: "0",
  estoque_min: "",
  estoque_max: "",
  status: "ativo",
};

const toNum = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

export function ProdutoFormDialog({ open, onOpenChange, produto }: Props) {
  const { data: categorias = [] } = useQuery(categoriasQuery);
  const qc = useQueryClient();
  const edicao = !!produto;
  const [f, setF] = useState<Campos>(vazio);
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErros({});
    if (produto) {
      setF({
        categoria_id: produto.categoria_id,
        nome: produto.nome,
        tipo: produto.tipo,
        cor: produto.cor,
        descricao: produto.descricao ?? "",
        quantidade: String(produto.quantidade),
        preco: String(produto.preco),
        estoque_min: produto.estoque_min == null ? "" : String(produto.estoque_min),
        estoque_max: produto.estoque_max == null ? "" : String(produto.estoque_max),
        status: produto.status,
      });
      setAttrs(produto.atributos);
    } else {
      setF(vazio);
      setAttrs({});
    }
  }, [open, produto]);

  const cat = categorias.find((c) => c.id === f.categoria_id);
  const set = (k: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  function validar() {
    const e: Record<string, string> = {};
    if (!f.categoria_id) e.categoria_id = "Selecione a categoria.";
    if (!f.nome.trim()) e.nome = "Informe o nome.";
    if (!f.tipo.trim()) e.tipo = "Informe o tipo.";
    if (!f.cor.trim()) e.cor = "Informe a cor.";
    const q = toNum(f.quantidade);
    if (!edicao && (q == null || isNaN(q) || q < 0)) e.quantidade = "Quantidade não pode ser negativa.";
    const p = toNum(f.preco);
    if (p == null || isNaN(p) || p < 0) e.preco = "Preço não pode ser negativo.";
    const mn = toNum(f.estoque_min);
    const mx = toNum(f.estoque_max);
    if (mn != null && (isNaN(mn) || mn < 0)) e.estoque_min = "Estoque mínimo não pode ser negativo.";
    if (mx != null && (isNaN(mx) || mx < 0)) e.estoque_max = "Estoque máximo não pode ser negativo.";
    if (mn != null && mx != null && !e.estoque_min && !e.estoque_max && mx < mn)
      e.estoque_max = "Estoque máximo não pode ser menor que o mínimo.";
    cat?.atributos.forEach((a) => {
      if (a.obrigatorio && !attrs[a.atributo]?.trim()) e[`attr_${a.atributo}`] = `Informe ${a.rotulo.toLowerCase()}.`;
    });
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validar() || !cat) return;
    setSalvando(true);
    const dados = {
      categoria_id: f.categoria_id,
      nome: f.nome,
      tipo: f.tipo,
      cor: f.cor,
      descricao: f.descricao,
      preco: toNum(f.preco),
      estoque_min: toNum(f.estoque_min),
      estoque_max: toNum(f.estoque_max),
      status: f.status,
    };
    // somente atributos da categoria selecionada
    const atributos = Object.fromEntries(cat.atributos.map((a) => [a.atributo, attrs[a.atributo] ?? ""]));
    try {
      if (edicao && produto) {
        const { error } = await supabase.rpc("atualizar_produto", { _id: produto.id, _dados: dados, _atributos: atributos });
        if (error) throw error;
        toast.success("Produto atualizado.");
      } else {
        const { error } = await supabase.rpc("criar_produto", {
          _dados: dados,
          _atributos: atributos,
          _quantidade_inicial: toNum(f.quantidade) ?? 0,
        });
        if (error) throw error;
        toast.success("Produto cadastrado.");
      }
      await qc.invalidateQueries({ queryKey: ["produtos"] });
      await qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(erroMsg(e));
    } finally {
      setSalvando(false);
    }
  }

  const Erro = ({ k }: { k: string }) => (erros[k] ? <p className="text-xs text-destructive">{erros[k]}</p> : null);
  const un = cat?.unidade_medida ?? "un";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{edicao ? "Editar produto" : "Adicionar produto"}</DialogTitle>
          <DialogDescription>Os campos se ajustam conforme a categoria escolhida.</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Categoria *</Label>
            <Select value={f.categoria_id} onValueChange={(v) => setF((s) => ({ ...s, categoria_id: v }))}>
              <SelectTrigger aria-invalid={!!erros.categoria_id}>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Erro k="categoria_id" />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" value={f.nome} onChange={set("nome")} aria-invalid={!!erros.nome} />
            <Erro k="nome" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo *</Label>
            <Input id="tipo" value={f.tipo} onChange={set("tipo")} aria-invalid={!!erros.tipo} />
            <Erro k="tipo" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cor">Cor *</Label>
            <Input id="cor" value={f.cor} onChange={set("cor")} aria-invalid={!!erros.cor} />
            <Erro k="cor" />
          </div>

          {cat?.atributos.map((a) => (
            <div key={a.atributo} className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={a.atributo}>
                {a.rotulo} {a.obrigatorio ? "*" : <span className="text-muted-foreground">(opcional)</span>}
              </Label>
              <Input
                id={a.atributo}
                value={attrs[a.atributo] ?? ""}
                onChange={(e) => setAttrs((s) => ({ ...s, [a.atributo]: e.target.value }))}
                aria-invalid={!!erros[`attr_${a.atributo}`]}
              />
              <Erro k={`attr_${a.atributo}`} />
            </div>
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="quantidade">Quantidade atual ({un})</Label>
            {edicao ? (
              <>
                <Input id="quantidade" value={fmtNum(Number(f.quantidade))} disabled />
                <p className="text-xs text-muted-foreground">Altere a quantidade pelo botão "Movimentar estoque".</p>
              </>
            ) : (
              <>
                <Input id="quantidade" type="number" min={0} step="any" value={f.quantidade} onChange={set("quantidade")} aria-invalid={!!erros.quantidade} />
                <Erro k="quantidade" />
              </>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preco">Preço (R$)</Label>
            <Input id="preco" type="number" min={0} step="0.01" value={f.preco} onChange={set("preco")} aria-invalid={!!erros.preco} />
            <Erro k="preco" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="min">Estoque mínimo <span className="text-muted-foreground">(opcional)</span></Label>
            <Input id="min" type="number" min={0} step="any" value={f.estoque_min} onChange={set("estoque_min")} aria-invalid={!!erros.estoque_min} />
            <Erro k="estoque_min" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max">Estoque máximo <span className="text-muted-foreground">(opcional)</span></Label>
            <Input id="max" type="number" min={0} step="any" value={f.estoque_max} onChange={set("estoque_max")} aria-invalid={!!erros.estoque_max} />
            <Erro k="estoque_max" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => setF((s) => ({ ...s, status: v as StatusProduto }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" rows={3} value={f.descricao} onChange={set("descricao")} />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
