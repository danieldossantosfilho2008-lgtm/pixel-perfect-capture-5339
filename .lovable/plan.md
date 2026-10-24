# Administração de funcionários e cargos

## Decisões já tomadas
- Novo funcionário recebe **convite por e-mail** e cria a própria senha.
- Comissão = **% sobre o preço de venda** (percentual definido por funcionário).
- Nos gráficos, conta como venda apenas pedido **Concluído** (data = última atualização do pedido para Concluído).
- Uma empresa só por enquanto, mas os dados já ficam preparados para várias empresas.
- Quem pode administrar: contas Empresariais, ou quem receber permissão de Edição na página "Administração".

## O que o usuário vai ver
1. **Menu**: novo item "Administração" (só aparece para quem tem acesso).
2. **Tela de Administração**: botão "Novo funcionário" no canto superior direito; duas áreas lado a lado (empilhadas em telas pequenas):
   - **Vendedores**: um card por vendedor.
   - **Demais funcionários**: cards agrupados por cargo, em ordem alfabética.
   - Card com a cor do cargo, nome do funcionário e cargo em texto pequeno no canto inferior esquerdo; texto claro ou escuro escolhido automaticamente para contraste.
3. **Cadastro/edição**: nome, e-mail, cargo (com botão "+" para criar cargo), salário, comissão (só para vendedor), descrição.
4. **Cargos**: nome + cor. Padrões: Vendedor (azul), Administrativo (dourado), Financeiro (verde). Todos editáveis; novos podem ser criados.
5. **Detalhe do funcionário** (painel lateral): dados, botão Editar, permissões por página (Estoque, Vendas, Pedidos, Administração: Sem acesso / Visualização / Edição), histórico de cadastro e edições (quem, quando, o que mudou).
6. **Desempenho (vendedores)**: seletor de período, total de vendas em destaque, gráfico de quantidade de vendas por dia/semana e gráfico comparando valor final, lucro e comissão.

## Limitações honestas
- **Lucro**: não existe regra de custo/lucro no sistema (o preço real ainda é "Não calculado"). A série de lucro aparecerá como "Não calculado" até essa regra ser definida.
- Pedidos concluídos sem preço de venda não entram nos valores (são contados na quantidade e sinalizados).

## Detalhes técnicos
- Nova tabela `empresas` (uma linha seed) e coluna `empresa_id` em `profiles` e `cargos`; todas as funções checam a empresa do usuário logado — nunca vem do frontend.
- `cargos` ganha `tipo` (enum interno: vendedor/administrativo/financeiro/outro, independente do nome), `cor` e `empresa_id`. Seed dos três padrões.
- `profiles` ganha `salario`, `comissao_percentual`, `descricao`, `ativo`.
- Novo setor `vendas`, `pedidos`, `administracao` em `setores`. Permissões individuais continuam em `usuario_permissoes` (já existente); edição exige visualização. Usuários atuais mantêm o acesso que já têm (vendas/pedidos continuam liberados a todos logados nesta etapa, salvo override explícito — não muda nada para quem já usa).
- Nova tabela `funcionario_historico` (somente leitura, gravada pelas funções), igual ao padrão de `pedido_historico`.
- Funções seguras: `salvar_cargo`, `atualizar_funcionario`, `definir_permissoes_funcionario` (bloqueia alterar as próprias permissões), `desempenho_vendedor(_id, _inicio, _fim)` agregando pedidos concluídos.
- Convite: server function autenticada que verifica permissão de Administração e usa o cliente administrativo para `inviteUserByEmail`; o trigger existente cria o perfil, e a função grava empresa/cargo/salário + histórico.
- Rota `/_authenticated/administracao`; gráficos com recharts (shadcn chart).
- Testes: regras de comissão, contagem só de Concluído, contraste de cor, permissão edição⇒visualização. Validação no navegador logado.
