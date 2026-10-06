import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Package } from "lucide-react";
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
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
          <div className="flex items-center gap-2 font-semibold">
            <span className="h-5 w-1.5 rounded-sm bg-highlight" /> Persianas
          </div>
          <nav className="flex gap-1 text-sm">
            <Link
              to="/estoque"
              className="flex items-center gap-1.5 rounded px-3 py-1.5 opacity-80 hover:bg-sidebar-accent hover:opacity-100"
              activeProps={{ className: "bg-sidebar-accent !opacity-100" }}
            >
              <Package className="h-4 w-4" /> Estoque
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {acesso?.perfil && (
              <div className="hidden text-right leading-tight sm:block">
                <div>{acesso.perfil.nome}</div>
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
        <Outlet />
      </main>
    </div>
  );
}
