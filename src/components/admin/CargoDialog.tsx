import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Cargo } from "@/lib/admin";
import { corTexto } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CargoDialog({ open, onOpenChange, cargo, onSalvo }: {
  open: boolean; onOpenChange: (v: boolean) => void; cargo?: Cargo | null; onSalvo?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(cargo?.nome ?? "");
  const [cor, setCor] = useState(cargo?.cor ?? "#64748b");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { toast.error("Informe o nome do cargo"); return; }
    setSalvando(true);
    const { data, error } = await supabase.rpc("salvar_cargo", { _id: cargo?.id ?? (null as unknown as string), _nome: nome, _cor: cor });
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success(cargo ? "Cargo atualizado" : "Cargo criado");
    await qc.invalidateQueries({ queryKey: ["cargos"] });
    await qc.invalidateQueries({ queryKey: ["funcionarios"] });
    onSalvo?.(data as string);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{cargo ? "Editar cargo" : "Novo cargo"}</DialogTitle></DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cargo-nome">Nome</Label>
            <Input id="cargo-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargo-cor">Cor</Label>
            <div className="flex items-center gap-3">
              <input id="cargo-cor" type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-input bg-transparent" />
              <span className="rounded px-3 py-1 text-sm font-medium" style={{ background: cor, color: corTexto(cor) }}>{nome || "Prévia"}</span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
