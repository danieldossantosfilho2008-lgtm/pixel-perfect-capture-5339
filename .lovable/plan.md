# Vendas, Cadastros e Pedidos

## Decisões já tomadas
- Consumo: Tecido (m²) = largura × altura em metros, multiplicado pela quantidade de peças. Trilhos e Bando (un): a quantidade digitada é o consumo.
- Preço real: fica "Não calculado" até existir o percentual de lucro (a futura Administração vai definir). A regra do cálculo fica separada, pronta para receber esse percentual.
- Preço limite: só o campo, sempre "Não calculado" nesta etapa.
- Acesso: qualquer pessoa logada pode registrar vendas e editar pedidos. O Estoque continua com as permissões atuais.

## O que o usuário vai ver
1. **Menu**: novos itens "Vendas" e "Pedidos" ao lado de "Estoque".
2. **Vendas e Cadastros** (uma página):
   - Cliente: nome (obrigatório) e endereço de entrega/instalação.
   - Materiais: tabela com pesquisa mostrando produtos ativos, unidade e quantidade disponível. Adicionar/remover itens; cada item tem quantidade, largura e altura (obrigatórias para Tecido).
   - Consumo calculado aparece por item, com aviso se faltar estoque.
   - Preço real e preço limite mostrados como "Não calculado"; preço de venda opcional em R$; descrição livre.
   - Salvar cria a venda e o pedido juntos, em status Orçamento, e leva para o pedido.
3. **Pedidos**: tabela com Data (última atualização), ID curto, cliente, descrição, materiais, status (etiqueta colorida), valor, pagamento (com ícone), localização, vendedor e botão de histórico.
   - Pesquisa por ID ou cliente; filtros por status, vendedor, pagamento e período; ordenação por cliente, valor e status.
4. **Detalhe do pedido**: editar cliente, endereço, descrição, preço de venda, pagamento, materiais e status. Vendedor não editável. Histórico em ordem cronológica com quem, quando, campo, antes e depois.

## Regras
- Status: Orçamento, Aprovado, Preparação, Finalizado, Enviado, Concluído, Cancelado.
- Valor exibido: Orçamento = preço real; demais = preço de venda; Cancelado = o valor que valia antes de cancelar. Nunca mostra nulo como zero.
- Sair de Orçamento para qualquer status (exceto Cancelado) exige preço de venda preenchido.
- Pagamento: Pix, Débito, Crédito, Boleto, Dinheiro, Cheque.
- Entrar em Preparação baixa o estoque uma única vez (verificado pelas movimentações já registradas para o pedido), sem deixar saldo negativo.
- Cancelar um pedido que já baixou estoque pergunta: devolver materiais ou cancelar sem devolver. Devolução só acontece uma vez.
- Mudar materiais depois da baixa ajusta o estoque pela diferença (entrada ou saída), registrada no histórico.
- Pedidos nunca são apagados. Itens guardam nome, unidade e preço do material no momento da venda.

## Detalhes técnicos
- Novas tabelas: `pedidos` (cliente, endereço, descrição, preco_real, preco_venda, preco_limite nulos, valor_cancelamento, status, metodo_pagamento, vendedor_id, created/updated_at, numero sequencial para o ID exibido), `pedido_itens` (snapshot de produto: nome, categoria, unidade, preço unitário, quantidade, largura, altura, consumo), `pedido_historico` (imutável: usuario_id, campo, valor_anterior, valor_novo, created_at). Enums `status_pedido`, `metodo_pagamento`. A "venda" é o próprio registro do pedido (uma linha só, evita venda sem pedido).
- Leitura liberada a todos logados; nenhuma escrita direta — tudo via funções seguras: `criar_pedido`, `atualizar_pedido`, `alterar_status_pedido(_id, _status, _devolver)`, `atualizar_itens_pedido`. Cada uma grava o histórico e roda numa transação.
- Baixa/devolução usam uma função interna derivada de `movimentar_estoque` sem a checagem de permissão de estoque, preenchendo `origem_tipo='pedido'` e `origem_id`. O saldo baixado é calculado somando as movimentações do pedido, o que impede baixa ou devolução em dobro.
- Lista de materiais para vendedores via função `materiais_disponiveis()` (só campos necessários), já que a tabela de produtos exige acesso ao Estoque.
- Proteção contra duplo clique: chave única gerada no formulário (`chave_idempotencia`).
- Cálculo de consumo e de valor em `src/lib/pedidos.ts` (com testes); `src/lib/precos.ts` com `calcularPrecoReal` e `calcularPrecoLimite` retornando null até as regras existirem. Consumo também revalidado no banco.
- Rotas: `/_authenticated/vendas`, `/_authenticated/pedidos/index`, `/_authenticated/pedidos/$id`.
- Testes: regras de valor por status, consumo, bloqueio sem preço de venda. Validação no navegador logado: venda, preparação, cancelamento com/sem devolução.
