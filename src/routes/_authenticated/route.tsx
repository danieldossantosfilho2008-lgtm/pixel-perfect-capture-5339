import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, LogOut, Package, ShoppingCart, Users, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { acessoQuery } from "@/lib/estoque";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const { data: acesso } = useQuery(acessoQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex min-h-14 max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2 font-semibold">
            <span className="h-5 w-1.5 rounded-sm bg-highlight" /> Persianas
          </div>
          <nav className="order-3 flex w-full flex-wrap gap-1 text-sm xl:order-none xl:w-auto">
            <Link
              to="/estoque"
              className="flex items-center gap-1.5 rounded px-3 py-1.5 opacity-80 hover:bg-sidebar-accent hover:opacity-100"
              activeProps={{ className: "bg-sidebar-accent !opacity-100" }}
            >
              <Package className="h-4 w-4" /> Estoque
            </Link>
            <Link
              to="/vendas"
              className="flex items-center gap-1.5 rounded px-3 py-1.5 opacity-80 hover:bg-sidebar-accent hover:opacity-100"
              activeProps={{ className: "bg-sidebar-accent !opacity-100" }}
            >
              <ShoppingCart className="h-4 w-4" /> Vendas
            </Link>
            <Link
              to="/pedidos"
              className="flex items-center gap-1.5 rounded px-3 py-1.5 opacity-80 hover:bg-sidebar-accent hover:opacity-100"
              activeProps={{ className: "bg-sidebar-accent !opacity-100" }}
            >
              <ClipboardList className="h-4 w-4" /> Pedidos
            </Link>
            {acesso && acesso.niveis.financeiro !== "sem_acesso" && (
              <Link to="/financeiro" className="flex items-center gap-1.5 rounded px-3 py-1.5 opacity-80 hover:bg-sidebar-accent hover:opacity-100" activeProps={{ className: "bg-sidebar-accent !opacity-100" }}><Wallet className="h-4 w-4" /> Financeiro</Link>
            )}
            {acesso && acesso.niveis.administracao !== "sem_acesso" && (
              <Link
                to="/administracao"
                className="flex items-center gap-1.5 rounded px-3 py-1.5 opacity-80 hover:bg-sidebar-accent hover:opacity-100"
                activeProps={{ className: "bg-sidebar-accent !opacity-100" }}
              >
                <Users className="h-4 w-4" /> Administração
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {acesso?.perfil && (
              <div className="hidden text-right leading-tight sm:block">
                <div>{acesso.perfil.nome}</div>
                {acesso.perfil.empresa && <div className="text-xs opacity-70">{acesso.perfil.empresa.nome}</div>}
                <div className="font-mono text-[10px] uppercase tracking-wider text-sidebar-primary">
                  {acesso.perfil.tipo_conta}
                </div>
              </div>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="hover:bg-sidebar-accent hover:text-sidebar-foreground">
                  <LogOut className="h-4 w-4" /> Sair
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deseja realmente sair?</AlertDialogTitle>
                  <AlertDialogDescription>Sua sessão será encerrada e você voltará à tela de entrada.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={sair}>Sair</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {acesso?.perfil && !acesso.perfil.empresa_id ? (
          <div className="mx-auto max-w-md rounded-lg border bg-card p-6 text-center">
            <h1 className="text-lg font-semibold">Conta sem empresa</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sua conta não está vinculada a nenhuma empresa. Peça um convite ao administrador da sua empresa.</p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
