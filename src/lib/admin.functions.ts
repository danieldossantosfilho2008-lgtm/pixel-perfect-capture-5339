import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  cargo_id: z.string().uuid(),
  salario: z.number().min(0).nullable(),
  comissao_percentual: z.number().min(0).max(100).nullable(),
  descricao: z.string().max(1000).nullable(),
  redirectTo: z.string().url(),
});

/** Convida um funcionário por e-mail e o vincula à empresa de quem convidou (verificado no banco). */
export const convidarFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: pode, error: ePode } = await context.supabase.rpc("pode_administrar");
    if (ePode || !pode) throw new Error("Sem permissão para administrar funcionários");
    const { data: empresa, error: eEmp } = await context.supabase.rpc("minha_empresa");
    if (eEmp || !empresa) throw new Error("Sua conta não está vinculada a uma empresa");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { nome: data.nome },
      redirectTo: data.redirectTo,
    });
    if (error || !conv.user) {
      const m = error?.message ?? "";
      if (/already|registered|exists/i.test(m)) throw new Error("Já existe um usuário com este e-mail");
      throw new Error(m || "Não foi possível enviar o convite");
    }
    // Vincula o convidado somente à empresa de quem convidou; recusa quem já pertence a uma empresa.
    const { error: eVinc } = await supabaseAdmin.rpc("vincular_convite", { _user: conv.user.id, _empresa: empresa });
    if (eVinc) throw new Error(eVinc.message);
    const { error: eUpd } = await context.supabase.rpc("atualizar_funcionario", {
      _id: conv.user.id,
      _novo: true,
      _dados: {
        nome: data.nome,
        cargo_id: data.cargo_id,
        salario: data.salario,
        comissao_percentual: data.comissao_percentual,
        descricao: data.descricao,
      },
    });
    if (eUpd) throw new Error(eUpd.message);
    return { id: conv.user.id };
  });
