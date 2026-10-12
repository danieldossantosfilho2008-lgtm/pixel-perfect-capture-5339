import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bloqueioTransicao, STATUS_PEDIDO, type Pedido, type StatusPedido } from "@/lib/pedidos";
import { erroMsg } from "@/lib/estoque";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function StatusControl({ pedido }: { pedido: Pedido }) {
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [perguntaDevolver, setPerguntaDevolver] = useState(false);

  async function aplicar(status: StatusPedido, devolver: boolean | null = null) {
    setOcupado(true);
    const { error } = await supabase.rpc("alterar_status_pedido", devolver == null ? { _id: pedido.id, _status: status } : { _id: pedido.id, _status: status, _devolver: devolver });
    setOcupado(false);
    setPerguntaDevolver(false);
    if (error) return void toast.error(erroMsg(error));
    toast.success("Status atualizado.");
    ["pedidos", "pedido_historico", "materiais", "produtos"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  }

  async function escolher(v: string) {
    const novo = v as StatusPedido;
    const bloqueio = bloqueioTransicao(pedido.status, novo, pedido.preco_venda);
    if (bloqueio) return void toast.error(bloqueio);
    if (novo === "cancelado") {
      const { data, error } = await supabase.rpc("pedido_tem_baixa", { _id: pedido.id });
      if (error) return void toast.error(erroMsg(error));
      if (data) return void setPerguntaDevolver(true);
    }
    aplicar(novo);
  }

  return (
    <>
      <Select value={pedido.status} onValueChange={escolher} disabled={ocupado || pedido.status === "cancelado"}>
        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          {STATUS_PEDIDO.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <AlertDialog open={perguntaDevolver} onOpenChange={setPerguntaDevolver}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Devolver materiais ao estoque?</AlertDialogTitle>
            <AlertDialogDescription>
              Este pedido já tirou materiais do estoque. Ao devolver, as quantidades voltam ao saldo. Sem devolução, o
              estoque não muda (por exemplo, se o material já foi cortado). Em ambos os casos o pedido fica Cancelado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>Voltar</AlertDialogCancel>
            <Button variant="outline" disabled={ocupado} onClick={() => aplicar("cancelado", false)}>Cancelar sem devolver</Button>
            <Button disabled={ocupado} onClick={() => aplicar("cancelado", true)}>Cancelar e devolver</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
