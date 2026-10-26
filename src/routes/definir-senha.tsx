import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrength, SENHA_MIN } from "@/components/auth/PasswordStrength";

export const Route = createFileRoute("/definir-senha")({
  head: () => ({
    meta: [
      { title: "Definir senha — Gestão de Persianas" },
      { name: "description", content: "Crie sua senha para acessar o sistema." },
      { property: "og:title", content: "Definir senha — Gestão de Persianas" },
      { property: "og:description", content: "Crie sua senha para acessar o sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DefinirSenha,
});

function DefinirSenha() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < SENHA_MIN) { toast.error(`A senha deve ter ao menos ${SENHA_MIN} caracteres`); return; }
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) { toast.error(error.message.includes("session") ? "Link expirado. Peça um novo convite." : error.message); return; }
    toast.success("Senha definida");
    navigate({ to: "/estoque" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={salvar} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6">
        <h1 className="text-xl font-semibold">Crie sua senha</h1>
        <div className="space-y-1.5">
          <Label htmlFor="senha">Nova senha</Label>
          <PasswordInput id="senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <PasswordStrength senha={senha} />
        </div>
        <Button type="submit" className="w-full" disabled={salvando}>{salvando ? "Salvando..." : "Salvar e entrar"}</Button>
      </form>
    </div>
  );
}
