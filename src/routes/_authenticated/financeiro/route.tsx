import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/financeiro")({ component: FinanceiroLayout });
function FinanceiroLayout() {
  return <div className="min-w-0 space-y-5"><nav aria-label="Áreas do Financeiro" className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/financeiro" activeOptions={{ exact: true }} activeProps={{ className: "bg-accent text-accent-foreground" }}>Dashboard</Link></Button><Button asChild variant="outline"><Link to="/financeiro/controle" activeProps={{ className: "bg-accent text-accent-foreground" }}>Controle Financeiro</Link></Button></nav><Outlet /></div>;
}