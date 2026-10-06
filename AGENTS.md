<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules

- Stock quantity changes only through the `movimentar_estoque` DB function (a trigger blocks direct updates) — guarantees every change is logged with before/after balances.
- Product create/edit/status go through security-definer RPCs that check `nivel_acesso_setor(user, setor)` — one permission source for all sectors.
- Access model: `profiles.tipo_conta` (empresarial = full access) + `cargo_permissoes` with per-user overrides in `usuario_permissoes` — lets future Admin area customize per employee.
- Category-specific fields live in `categoria_atributos` / `produto_atributos` (EAV), not per-category tables — new categories need only seed rows.
- `movimentacoes_estoque.origem_tipo/origem_id` reserved for future modules (e.g. a sale generating an automatic exit).
- Frontend reads/writes via the browser Supabase client (RLS + RPCs); no server functions needed for this module.
