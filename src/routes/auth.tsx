import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrength, SENHA_MIN } from "@/components/auth/PasswordStrength";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Gestão de Persianas" },
      { name: "description", content: "Acesso ao sistema interno de gestão." },
      { property: "og:title", content: "Entrar — Gestão de Persianas" },
      { property: "og:description", content: "Acesso ao sistema interno de gestão." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        navigate({ to: "/estoque" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: window.location.origin, data: { nome } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/estoque" });
        else toast.success("Cadastro feito! Confirme pelo link enviado ao seu e-mail.");
      }
    } catch (err) {
      const m = (err as Error).message;
      toast.error(m.includes("Invalid login") ? "E-mail ou senha incorretos." : m);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2 font-semibold">
          <span className="h-6 w-1.5 rounded-sm bg-highlight" /> Persianas · Gestão
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-sidebar-primary">Módulo Estoque</p>
          <h1 className="mt-3 max-w-md text-4xl font-semibold leading-tight">
            Tecidos, trilhos e bandôs sob controle, com histórico de cada movimento.
          </h1>
        </div>
        <p className="text-sm opacity-60">Uso interno</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={enviar} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-semibold">{modo === "entrar" ? "Entrar" : "Criar conta"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {modo === "entrar" ? "Use seu e-mail corporativo." : "O primeiro cadastro recebe acesso Empresarial."}
            </p>
          </div>
          {modo === "cadastrar" && (
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha</Label>
            <PasswordInput id="senha" required minLength={SENHA_MIN} value={senha} onChange={(e) => setSenha(e.target.value)} />
            {modo === "cadastrar" && <PasswordStrength senha={senha} />}
          </div>
          <Button type="submit" className="w-full" disabled={carregando}>
            {carregando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Cadastrar"}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setModo(modo === "entrar" ? "cadastrar" : "entrar")}
          >
            {modo === "entrar" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
