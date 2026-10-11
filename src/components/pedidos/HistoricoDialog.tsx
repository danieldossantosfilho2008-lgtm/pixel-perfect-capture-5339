import { useQuery } from "@tanstack/react-query";
import { historicoQuery, labelPagamento, labelStatus } from "@/lib/pedidos";
import { fmtBRL, fmtData } from "@/lib/estoque";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

function fmt(campo: string, v: string | null) {
  if (v == null || v === "") return "—";
  if (campo === "Status") return labelStatus(v);
  if (campo === "Método de pagamento") return labelPagamento(v) ?? v;
  if (campo === "Preço de venda") return fmtBRL(Number(v));
  return v;
}

export function HistoricoLista({ pedidoId }: { pedidoId: string }) {
  const { data, isLoading, error } = useQuery(historicoQuery(pedidoId));
  if (isLoading) return <div className="space-y-2">{[1, 2, 3].map((k) => <Skeleton key={k} className="h-12" />)}</div>;
  if (error) return <p className="text-sm text-destructive">Não foi possível carregar o histórico.</p>;
  if (!data?.length) return <p className="text-sm text-muted-foreground">Sem registros.</p>;
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {data.map((h) => (
        <li key={h.id} className="text-sm">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-highlight" />
          <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
            <span className="font-mono">{fmtData(h.created_at)}</span>
            <span>· {h.usuario?.nome ?? "Usuário não identificado"}</span>
          </div>
          <div className="font-medium">{h.campo}</div>
          {h.valor_anterior != null ? (
            <div className="text-sm">
              <span className="text-muted-foreground line-through">{fmt(h.campo, h.valor_anterior)}</span>
              {" → "}
              <span>{fmt(h.campo, h.valor_novo)}</span>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{fmt(h.campo, h.valor_novo)}</div>
          )}
        </li>
      ))}
    </ol>
  );
}

export function HistoricoDialog({ pedidoId, onClose }: { pedidoId: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!pedidoId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Histórico de edição</DialogTitle></DialogHeader>
        {pedidoId && <HistoricoLista pedidoId={pedidoId} />}
      </DialogContent>
    </Dialog>
  );
}
