import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { erroMsg, type Produto } from "@/lib/estoque";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function StatusConfirm({ produto, onClose }: { produto: Produto | null; onClose: () => void }) {
  const qc = useQueryClient();
  const inativar = produto?.status === "ativo";

  async function confirmar() {
    if (!produto) return;
    const { error } = await supabase.rpc("alterar_status_produto", {
      _id: produto.id,
      _status: inativar ? "inativo" : "ativo",
    });
    if (error) toast.error(erroMsg(error));
    else {
      toast.success(inativar ? "Produto inativado." : "Produto reativado.");
      await qc.invalidateQueries({ queryKey: ["produtos"] });
    }
    onClose();
  }

  return (
    <AlertDialog open={!!produto} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{inativar ? "Inativar produto?" : "Reativar produto?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {inativar
              ? `"${produto?.nome}" deixará de aparecer como opção em novas movimentações. O histórico será mantido.`
              : `"${produto?.nome}" voltará a aparecer nas movimentações.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmar}
            className={inativar ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {inativar ? "Inativar" : "Reativar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
