import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cargosQuery, ehVendedor, type Funcionario, type FuncionarioDados } from "@/lib/admin";
import { convidarFuncionario } from "@/lib/admin.functions";
import { CargoDialog } from "./CargoDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const numOuNull = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

export function FuncionarioForm({ open, onOpenChange, funcionario, dados }: {
  open: boolean; onOpenChange: (v: boolean) => void; funcionario?: Funcionario | null; dados?: FuncionarioDados | null | undefined;
}) {
  const qc = useQueryClient();
  const convidar = useServerFn(convidarFuncionario);
  const { data: cargos = [] } = useQuery(cargosQuery);
  const [nome, setNome] = useState(funcionario?.nome ?? "");
  const [email, setEmail] = useState(funcionario?.email ?? "");
  const [cargoId, setCargoId] = useState(funcionario?.cargo?.id ?? "");
  const [salario, setSalario] = useState(dados?.salario?.toString() ?? "");
  const [comissao, setComissao] = useState(dados?.comissao_percentual?.toString() ?? "");
  const [descricao, setDescricao] = useState(dados?.descricao ?? "");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [novoCargo, setNovoCargo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const cargo = cargos.find((c) => c.id === cargoId);
  const vendedor = ehVendedor(cargo);

  function validar() {
    const e: Record<string, string> = {};
    if (!nome.trim()) e["nome"] = "Informe o nome";
    if (!funcionario && !EMAIL_RE.test(email.trim())) e["email"] = "E-mail inválido";
    if (!cargoId) e["cargo"] = "Selecione o cargo";
    const s = numOuNull(salario);
    if (s != null && (isNaN(s) || s < 0)) e["salario"] = "Salário inválido";
    const c = numOuNull(comissao);
    if (vendedor && c != null && (isNaN(c) || c < 0 || c > 100)) e["comissao"] = "Use um percentual entre 0 e 100";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validar()) return;
    setSalvando(true);
    const payload = {
      nome: nome.trim(),
      cargo_id: cargoId,
      salario: numOuNull(salario),
      comissao_percentual: vendedor ? numOuNull(comissao) : null,
      descricao: descricao.trim() || null,
    };
    try {
      if (funcionario) {
        const { error } = await supabase.rpc("atualizar_funcionario", { _id: funcionario.id, _dados: payload });
        if (error) throw error;
        toast.success("Funcionário atualizado");
      } else {
        await convidar({ data: { ...payload, email: email.trim(), redirectTo: `${window.location.origin}/definir-senha` } });
        toast.success("Convite enviado por e-mail");
      }
      await qc.invalidateQueries({ queryKey: ["funcionarios"] });
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  }

  const erro = (k: string) => erros[k] && <p className="text-xs text-destructive">{erros[k]}</p>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{funcionario ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
          {!funcionario && <DialogDescription>A pessoa receberá um e-mail para criar a própria senha.</DialogDescription>}
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="f-nome">Nome</Label>
            <Input id="f-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
            {erro("nome")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-email">E-mail</Label>
            <Input id="f-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!funcionario} />
            {erro("email")}
          </div>
          <div className="space-y-1.5">
            <Label>Cargo</Label>
            <div className="flex gap-2">
              <Select value={cargoId} onValueChange={setCargoId}>
                <SelectTrigger aria-label="Cargo"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {cargos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.cor }} />{c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="icon" variant="outline" aria-label="Novo cargo" onClick={() => setNovoCargo(true)}><Plus className="h-4 w-4" /></Button>
            </div>
            {erro("cargo")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-sal">Salário (R$)</Label>
              <Input id="f-sal" inputMode="decimal" value={salario} onChange={(e) => setSalario(e.target.value)} />
              {erro("salario")}
            </div>
            {vendedor && (
              <div className="space-y-1.5">
                <Label htmlFor="f-com">Comissão (% sobre o preço de venda)</Label>
                <Input id="f-com" inputMode="decimal" value={comissao} onChange={(e) => setComissao(e.target.value)} />
                {erro("comissao")}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-desc">Descrição (opcional)</Label>
            <Textarea id="f-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={1000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>{salvando ? "Salvando..." : funcionario ? "Salvar" : "Enviar convite"}</Button>
          </DialogFooter>
        </form>
        {novoCargo && <CargoDialog open onOpenChange={setNovoCargo} onSalvo={setCargoId} />}
      </DialogContent>
    </Dialog>
  );
}
