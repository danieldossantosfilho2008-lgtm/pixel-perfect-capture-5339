import { Banknote, CreditCard, FileText, QrCode, ReceiptText, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { labelPagamento, labelStatus, type MetodoPagamento, type StatusPedido } from "@/lib/pedidos";

const estilos: Record<StatusPedido, string> = {
  orcamento: "border border-border text-foreground",
  aprovado: "bg-secondary text-secondary-foreground",
  preparacao: "bg-warning-soft text-warning",
  finalizado: "bg-highlight/20 text-foreground",
  enviado: "bg-accent text-accent-foreground",
  concluido: "bg-success-soft text-success",
  cancelado: "bg-destructive-soft text-destructive line-through decoration-1",
};

export function StatusPedidoBadge({ s }: { s: StatusPedido }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium", estilos[s])}>
      {labelStatus(s)}
    </span>
  );
}

export const ICONE_PAGAMENTO: Record<MetodoPagamento, typeof QrCode> = {
  pix: QrCode,
  debito: Wallet,
  credito: CreditCard,
  boleto: ReceiptText,
  dinheiro: Banknote,
  cheque: FileText,
};

export function Pagamento({ m }: { m: MetodoPagamento | null }) {
  if (!m) return <span className="text-muted-foreground">—</span>;
  const I = ICONE_PAGAMENTO[m];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <I className="h-3.5 w-3.5 text-muted-foreground" /> {labelPagamento(m)}
    </span>
  );
}

export function Valor({ v }: { v: number | null }) {
  if (v == null) return <span className="text-xs italic text-muted-foreground">Não calculado</span>;
  return <span className="font-mono tabular-nums">{v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>;
}
