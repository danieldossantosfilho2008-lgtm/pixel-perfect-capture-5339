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
- Orders (`pedidos`, `pedido_itens`, `pedido_historico`) are read-only tables for clients; all writes go through security-definer RPCs that also append history — keeps history immutable and complete.
- Order stock debits use `_mov_estoque_pedido` with `origem_tipo='pedido'`; the amount already debited is always derived from those movements, which makes debit/return idempotent.
- Order items snapshot product name, unit and price at sale time — later catalog changes never alter past orders.
- Price rules (real/limit) live in `src/lib/precos.ts` and return null until official formulas exist — never substitute an invented formula.
- Company scoping: `profiles.empresa_id`/`cargos.empresa_id` resolved server-side via `minha_empresa()`; never accept a company id from the client — ready for multi-company later.
- Role meaning comes from `cargos.tipo` (enum), never the display name/color — renaming a role must not change behavior.
- Page permissions use `nivel_acesso_setor` per sector (estoque, vendas, pedidos, administracao); vendas/pedidos default to edicao when no override, order writes are guarded by triggers on `pedidos`/`pedido_itens`.
- Sensitive employee data (salary, commission) lives in `funcionario_dados`, readable only by admins and the employee; employee changes go through RPCs that append `funcionario_historico`.
- Employee invites use a server function (admin check via `pode_administrar`, then admin invite); invited users set their password at `/definir-senha`.
- Finance screens share `PainelFinanceiro` under the authenticated Financeiro layout and use existing browser RPCs; this keeps ledger writes audited without changing order or stock logic.
- Financial indicators use all-time totals while graphs use bounded periods; this prevents historical ledgers from generating unbounded monthly series.
