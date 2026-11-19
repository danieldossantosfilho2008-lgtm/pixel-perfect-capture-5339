import { createFileRoute } from "@tanstack/react-router";
import { PainelFinanceiro } from "@/components/financeiro/PainelFinanceiro";

export const Route = createFileRoute("/_authenticated/financeiro/controle")({
  head: () => ({ meta: [
    { title: "Controle Financeiro — Gestão de Persianas" },
    { name: "description", content: "Histórico de caixa, pagamentos parciais, despesas, estornos e materiais de pedidos concluídos." },
    { property: "og:title", content: "Controle Financeiro — Gestão de Persianas" },
    { property: "og:description", content: "Consulte e registre recebimentos, despesas e estornos com histórico preservado." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: () => <PainelFinanceiro controle />,
});