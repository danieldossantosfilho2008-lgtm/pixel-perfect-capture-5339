# Módulo de Estoque — Sistema interno de persianas

## O que será entregue
- Login (e-mail/senha) com dois níveis: **Empresarial** (acesso total) e **Profissional** (acesso por cargo + permissões por setor: Sem acesso / Visualização / Edição). O primeiro usuário cadastrado vira Empresarial.
- Tela **Estoque**: título, botão "Adicionar produto", busca, filtros (categoria, status, situação), ordenação, paginação e 4 indicadores reais (total de produtos, estoque baixo, sem estoque, total de itens).
- Listagem: Nome, Categoria, Tipo, Cor, Variação/Dimensão, Quantidade (m² para Tecido), Mín, Máx, Preço, Situação (selo colorido), Status, Ações (Visualizar, Editar, Movimentar, Inativar/Reativar com confirmação).
- Formulário dinâmico: Tecido mostra Variação; Trilhos/Bando mostram Dimensão (obrigatória). Validações junto a cada campo. Na edição, quantidade fica bloqueada (só muda via movimentação).
- **Movimentar estoque**: Entrada, Saída, Ajuste +, Ajuste −; prévia "Atual → Movimentação → Novo estoque" antes de confirmar; bloqueio de saldo negativo e quantidade ≤ 0. Produtos inativos não aparecem por padrão.
- **Detalhes do produto**: todos os dados + Histórico de movimentações (Data, Tipo, Qtd, Saldo anterior, Saldo posterior, Usuário, Observação).
- Situação: Sem estoque (qtd = 0) tem precedência sobre Estoque baixo (qtd < mín); senão Normal.
- Visual: interface administrativa sóbria, densa e legível (tons neutros grafite com destaque âmbar), em português.

## Detalhes técnicos
- Lovable Cloud (banco + auth). Rotas: `/auth`, `/_authenticated/estoque`, `/_authenticated/estoque/$id`; `/` redireciona para estoque.
- Tabelas:
  - `profiles` (nome, tipo_conta enum empresarial|profissional, cargo_id)
  - `cargos`, `setores` (seed: `estoque`), `cargo_permissoes` (cargo, setor, nivel enum), `usuario_permissoes` (override individual)
  - função `nivel_acesso(user, setor)` security definer: empresarial → edicao; senão override > cargo > sem_acesso. Usada nas RLS.
  - `categorias` (codigo, nome, unidade_medida: m² / un) + `categoria_atributos` (atributo, obrigatório) — seed Tecido{variacao opcional}, Trilhos{dimensao obrig.}, Bando{dimensao obrig.}
  - `produtos` (categoria_id, nome, tipo, cor, descricao, quantidade numeric ≥0, preco ≥0, estoque_min, estoque_max com CHECK max ≥ min, status, timestamps, created_by/updated_by) + `produto_atributos` (produto_id, atributo, valor) — extensível a novas categorias.
  - `movimentacoes_estoque` (produto, tipo enum, quantidade >0, saldo_anterior, saldo_posterior, usuario, observacao, origem_tipo/origem_id nulos para futura venda gerar saída automática). Somente inserção; sem update/delete.
- Função RPC `movimentar_estoque(produto, tipo, qtd, obs)` com `SELECT ... FOR UPDATE`, valida e grava atomicamente. Trigger impede alterar `produtos.quantidade` fora dessa função; cadastro com quantidade inicial > 0 gera movimentação "Entrada" automática.
- Sem exclusão física de produtos (sem policy DELETE). Grants + RLS em todas as tabelas.
- Fora de escopo: vendas, clientes, financeiro, página de Administração.
