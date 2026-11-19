import { createFileRoute } from "@tanstack/react-router";
import { PainelFinanceiro } from "@/components/financeiro/PainelFinanceiro";

export const Route = createFileRoute("/_authenticated/financeiro/")({
  head: () => ({ meta: [
    { title: "Dashboard Financeiro — Gestão de Persianas" },
    { name: "description", content: "Saldo em caixa, valores a receber e resultados financeiros por período." },
    { property: "og:title", content: "Dashboard Financeiro — Gestão de Persianas" },
    { property: "og:description", content: "Entradas, despesas e resultado de caixa da empresa." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: () => <PainelFinanceiro />,
});