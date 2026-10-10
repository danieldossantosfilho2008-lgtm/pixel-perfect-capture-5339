CREATE TYPE public.status_pedido AS ENUM ('orcamento','aprovado','preparacao','finalizado','enviado','concluido','cancelado');
CREATE TYPE public.metodo_pagamento AS ENUM ('pix','debito','credito','boleto','dinheiro','cheque');

CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  cliente_nome text NOT NULL CHECK (length(trim(cliente_nome)) > 0),
  endereco text,
  descricao text,
  preco_real numeric(14,2) CHECK (preco_real IS NULL OR preco_real >= 0),
  preco_venda numeric(14,2) CHECK (preco_venda IS NULL OR preco_venda >= 0),
  preco_limite numeric(14,2) CHECK (preco_limite IS NULL OR preco_limite >= 0),
  valor_cancelamento numeric(14,2),
  status public.status_pedido NOT NULL DEFAULT 'orcamento',
  metodo_pagamento public.metodo_pagamento,
  vendedor_id uuid REFERENCES public.profiles(id),
  chave_idempotencia uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id),
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  produto_nome text NOT NULL,
  categoria_codigo text NOT NULL,
  unidade text NOT NULL,
  preco_unitario numeric(14,2) NOT NULL,
  quantidade numeric(14,3) NOT NULL CHECK (quantidade > 0),
  largura numeric(10,3) CHECK (largura IS NULL OR largura > 0),
  altura numeric(10,3) CHECK (altura IS NULL OR altura > 0),
  consumo numeric(14,3) NOT NULL CHECK (consumo > 0)
);
CREATE INDEX ON public.pedido_itens(pedido_id);
CREATE TABLE public.pedido_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id),
  usuario_id uuid REFERENCES public.profiles(id),
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ON public.pedido_historico(pedido_id, created_at);
CREATE INDEX ON public.movimentacoes_estoque(origem_tipo, origem_id);

GRANT SELECT ON public.pedidos, public.pedido_itens, public.pedido_historico TO authenticated;
GRANT ALL ON public.pedidos, public.pedido_itens, public.pedido_historico TO service_role;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth le pedidos" ON public.pedidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth le pedido_itens" ON public.pedido_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth le pedido_historico" ON public.pedido_historico FOR SELECT TO authenticated USING (true);

-- helpers
CREATE OR REPLACE FUNCTION public._exigir_login() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'É preciso estar logado'; END IF; END $$;

CREATE OR REPLACE FUNCTION public._hist(_pedido uuid, _campo text, _ant text, _novo text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.pedido_historico (pedido_id, usuario_id, campo, valor_anterior, valor_novo) VALUES (_pedido, auth.uid(), _campo, _ant, _novo);
$$;

CREATE OR REPLACE FUNCTION public._status_usa_venda(_s public.status_pedido) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _s IN ('aprovado','preparacao','finalizado','enviado','concluido');
$$;
CREATE OR REPLACE FUNCTION public._status_baixa(_s public.status_pedido) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _s IN ('preparacao','finalizado','enviado','concluido');
$$;

CREATE OR REPLACE FUNCTION public._mov_estoque_pedido(_produto uuid, _tipo public.tipo_movimentacao, _quantidade numeric, _pedido uuid, _obs text) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.produtos; novo numeric;
BEGIN
  SELECT * INTO p FROM public.produtos WHERE id = _produto FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  IF _tipo IN ('entrada','ajuste_positivo') THEN novo := p.quantidade + _quantidade; ELSE novo := p.quantidade - _quantidade; END IF;
  IF novo < 0 THEN RAISE EXCEPTION 'Estoque insuficiente de "%": disponível %, necessário %', p.nome, p.quantidade, _quantidade; END IF;
  PERFORM set_config('app.mov_estoque','on',true);
  UPDATE public.produtos SET quantidade = novo, updated_by = auth.uid() WHERE id = _produto;
  PERFORM set_config('app.mov_estoque','off',true);
  INSERT INTO public.movimentacoes_estoque (produto_id,tipo,quantidade,saldo_anterior,saldo_posterior,usuario_id,observacao,origem_tipo,origem_id)
  VALUES (_produto,_tipo,_quantidade,p.quantidade,novo,auth.uid(),_obs,'pedido',_pedido);
  RETURN novo;
END $$;

CREATE OR REPLACE FUNCTION public.pedido_baixado(_pedido uuid) RETURNS TABLE(produto_id uuid, quantidade numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT m.produto_id, SUM(CASE WHEN m.tipo IN ('saida','ajuste_negativo') THEN m.quantidade ELSE -m.quantidade END)
  FROM public.movimentacoes_estoque m WHERE m.origem_tipo = 'pedido' AND m.origem_id = _pedido
  GROUP BY m.produto_id
  HAVING SUM(CASE WHEN m.tipo IN ('saida','ajuste_negativo') THEN m.quantidade ELSE -m.quantidade END) <> 0;
$$;

-- Leva o estoque baixado pelo pedido até o alvo (consumo dos itens, ou zero na devolução)
CREATE OR REPLACE FUNCTION public._sincronizar_estoque(_pedido uuid, _zerar boolean, _motivo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; dif numeric; nome text; un text;
BEGIN
  FOR r IN
    WITH alvo AS (
      SELECT i.produto_id, SUM(i.consumo) q FROM public.pedido_itens i WHERE i.pedido_id = _pedido AND NOT _zerar GROUP BY i.produto_id
    ), feito AS (SELECT * FROM public.pedido_baixado(_pedido))
    SELECT COALESCE(a.produto_id, f.produto_id) produto_id, COALESCE(a.q,0) alvo, COALESCE(f.quantidade,0) feito
    FROM alvo a FULL JOIN feito f ON f.produto_id = a.produto_id
    ORDER BY 1
  LOOP
    dif := r.alvo - r.feito;
    CONTINUE WHEN dif = 0;
    SELECT p.nome, c.unidade_medida INTO nome, un FROM public.produtos p JOIN public.categorias c ON c.id = p.categoria_id WHERE p.id = r.produto_id;
    IF dif > 0 THEN
      PERFORM public._mov_estoque_pedido(r.produto_id, 'saida', dif, _pedido, _motivo);
      PERFORM public._hist(_pedido, 'Estoque', NULL, format('Baixa de %s %s de %s (%s)', trim(to_char(dif,'FM999999990.###')), un, nome, _motivo));
    ELSE
      PERFORM public._mov_estoque_pedido(r.produto_id, 'entrada', -dif, _pedido, _motivo);
      PERFORM public._hist(_pedido, 'Estoque', NULL, format('Devolução de %s %s de %s (%s)', trim(to_char(-dif,'FM999999990.###')), un, nome, _motivo));
    END IF;
  END LOOP;
END $$;

-- Grava itens validando produto, dimensões e disponibilidade
CREATE OR REPLACE FUNCTION public._gravar_itens(_pedido uuid, _itens jsonb, _checar_disponivel boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE it jsonb; p record; q numeric; l numeric; a numeric; c numeric; resumo text := '';
BEGIN
  IF _itens IS NULL OR jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN RAISE EXCEPTION 'Selecione ao menos um material'; END IF;
  DELETE FROM public.pedido_itens WHERE pedido_id = _pedido;
  FOR it IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    SELECT pr.id, pr.nome, pr.preco, pr.quantidade, pr.status, ca.codigo, ca.unidade_medida INTO p
      FROM public.produtos pr JOIN public.categorias ca ON ca.id = pr.categoria_id WHERE pr.id = (it->>'produto_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Material não encontrado'; END IF;
    q := (it->>'quantidade')::numeric; l := NULLIF(it->>'largura','')::numeric; a := NULLIF(it->>'altura','')::numeric;
    IF q IS NULL OR q <= 0 THEN RAISE EXCEPTION 'Quantidade inválida para "%"', p.nome; END IF;
    IF (l IS NOT NULL AND l <= 0) OR (a IS NOT NULL AND a <= 0) THEN RAISE EXCEPTION 'Dimensões de "%" devem ser positivas', p.nome; END IF;
    IF p.codigo = 'tecido' THEN
      IF l IS NULL OR a IS NULL THEN RAISE EXCEPTION 'Informe largura e altura de "%"', p.nome; END IF;
      c := round(l * a * q, 3);
    ELSE
      c := q;
    END IF;
    IF c <= 0 THEN RAISE EXCEPTION 'Consumo de "%" muito pequeno', p.nome; END IF;
    INSERT INTO public.pedido_itens (pedido_id,produto_id,produto_nome,categoria_codigo,unidade,preco_unitario,quantidade,largura,altura,consumo)
    VALUES (_pedido,p.id,p.nome,p.codigo,p.unidade_medida,p.preco,q,l,a,c);
    resumo := resumo || CASE WHEN resumo = '' THEN '' ELSE '; ' END || format('%s: %s %s', p.nome, trim(to_char(c,'FM999999990.###')), p.unidade_medida)
      || CASE WHEN l IS NOT NULL THEN format(' (%s×%s m, %s pç)', trim(to_char(l,'FM9990.###')), trim(to_char(a,'FM9990.###')), trim(to_char(q,'FM999990.###'))) ELSE '' END;
  END LOOP;
  IF _checar_disponivel THEN
    FOR p IN SELECT i.produto_nome, SUM(i.consumo) q, pr.quantidade d, i.unidade FROM public.pedido_itens i JOIN public.produtos pr ON pr.id = i.produto_id
      WHERE i.pedido_id = _pedido GROUP BY i.produto_nome, pr.quantidade, i.unidade LOOP
      IF p.q > p.d THEN RAISE EXCEPTION 'Estoque insuficiente de "%": disponível % %, necessário % %', p.produto_nome, p.d, p.unidade, p.q, p.unidade; END IF;
    END LOOP;
  END IF;
  RETURN resumo;
END $$;

CREATE OR REPLACE FUNCTION public.materiais_disponiveis() RETURNS TABLE(id uuid, nome text, tipo text, cor text, categoria_codigo text, categoria_nome text, unidade text, quantidade numeric, preco numeric, detalhe text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public._exigir_login();
  RETURN QUERY SELECT p.id, p.nome, p.tipo, p.cor, c.codigo, c.nome, c.unidade_medida, p.quantidade, p.preco,
    (SELECT string_agg(pa.valor, ', ') FROM public.produto_atributos pa WHERE pa.produto_id = p.id)
  FROM public.produtos p JOIN public.categorias c ON c.id = p.categoria_id WHERE p.status = 'ativo' ORDER BY c.ordem, p.nome;
END $$;

CREATE OR REPLACE FUNCTION public.criar_pedido(_dados jsonb, _itens jsonb, _chave uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE novo uuid; pv numeric; resumo text;
BEGIN
  PERFORM public._exigir_login();
  IF _chave IS NOT NULL THEN
    SELECT id INTO novo FROM public.pedidos WHERE chave_idempotencia = _chave;
    IF FOUND THEN RETURN novo; END IF;
  END IF;
  IF NULLIF(trim(_dados->>'cliente_nome'),'') IS NULL THEN RAISE EXCEPTION 'Informe o nome do cliente'; END IF;
  pv := NULLIF(_dados->>'preco_venda','')::numeric;
  IF pv IS NOT NULL AND pv < 0 THEN RAISE EXCEPTION 'Preço de venda não pode ser negativo'; END IF;
  INSERT INTO public.pedidos (cliente_nome,endereco,descricao,preco_venda,metodo_pagamento,vendedor_id,chave_idempotencia)
  VALUES (trim(_dados->>'cliente_nome'), NULLIF(trim(_dados->>'endereco'),''), NULLIF(trim(_dados->>'descricao'),''), pv,
    NULLIF(_dados->>'metodo_pagamento','')::public.metodo_pagamento, auth.uid(), _chave)
  RETURNING id INTO novo;
  resumo := public._gravar_itens(novo, _itens, true);
  PERFORM public._hist(novo, 'Criação', NULL, format('Pedido criado em Orçamento. Materiais: %s', resumo));
  RETURN novo;
END $$;

CREATE OR REPLACE FUNCTION public.atualizar_pedido(_id uuid, _dados jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.pedidos; nome text; ende text; descr text; pv numeric; mp public.metodo_pagamento;
BEGIN
  PERFORM public._exigir_login();
  SELECT * INTO p FROM public.pedidos WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p.status = 'cancelado' THEN RAISE EXCEPTION 'Pedido cancelado não pode ser editado'; END IF;
  nome := trim(_dados->>'cliente_nome'); ende := NULLIF(trim(_dados->>'endereco'),''); descr := NULLIF(trim(_dados->>'descricao'),'');
  pv := NULLIF(_dados->>'preco_venda','')::numeric; mp := NULLIF(_dados->>'metodo_pagamento','')::public.metodo_pagamento;
  IF NULLIF(nome,'') IS NULL THEN RAISE EXCEPTION 'Informe o nome do cliente'; END IF;
  IF pv IS NOT NULL AND pv < 0 THEN RAISE EXCEPTION 'Preço de venda não pode ser negativo'; END IF;
  IF pv IS NULL AND public._status_usa_venda(p.status) THEN RAISE EXCEPTION 'O preço de venda é obrigatório no status atual'; END IF;
  IF nome IS DISTINCT FROM p.cliente_nome THEN PERFORM public._hist(_id,'Cliente',p.cliente_nome,nome); END IF;
  IF ende IS DISTINCT FROM p.endereco THEN PERFORM public._hist(_id,'Endereço',p.endereco,ende); END IF;
  IF descr IS DISTINCT FROM p.descricao THEN PERFORM public._hist(_id,'Descrição',p.descricao,descr); END IF;
  IF pv IS DISTINCT FROM p.preco_venda THEN PERFORM public._hist(_id,'Preço de venda',p.preco_venda::text,pv::text); END IF;
  IF mp IS DISTINCT FROM p.metodo_pagamento THEN PERFORM public._hist(_id,'Método de pagamento',p.metodo_pagamento::text,mp::text); END IF;
  UPDATE public.pedidos SET cliente_nome=nome, endereco=ende, descricao=descr, preco_venda=pv, metodo_pagamento=mp, updated_at=now() WHERE id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.atualizar_itens_pedido(_id uuid, _itens jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.pedidos; antes text; depois text;
BEGIN
  PERFORM public._exigir_login();
  SELECT * INTO p FROM public.pedidos WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p.status IN ('cancelado','concluido') THEN RAISE EXCEPTION 'Materiais não podem ser alterados neste status'; END IF;
  SELECT string_agg(format('%s: %s %s', produto_nome, trim(to_char(consumo,'FM999999990.###')), unidade), '; ' ORDER BY produto_nome) INTO antes FROM public.pedido_itens WHERE pedido_id = _id;
  depois := public._gravar_itens(_id, _itens, NOT public._status_baixa(p.status));
  PERFORM public._hist(_id, 'Materiais', antes, depois);
  IF public._status_baixa(p.status) THEN PERFORM public._sincronizar_estoque(_id, false, 'Ajuste por alteração de materiais'); END IF;
  UPDATE public.pedidos SET updated_at = now() WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.alterar_status_pedido(_id uuid, _status public.status_pedido, _devolver boolean DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.pedidos; tem_baixa boolean;
BEGIN
  PERFORM public._exigir_login();
  SELECT * INTO p FROM public.pedidos WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p.status = _status THEN RETURN; END IF;
  IF p.status = 'cancelado' THEN RAISE EXCEPTION 'Pedido cancelado não pode mudar de status'; END IF;
  IF public._status_usa_venda(_status) AND p.preco_venda IS NULL THEN
    RAISE EXCEPTION 'Registre o preço de venda (valor negociado) antes de mudar para este status';
  END IF;
  IF _status = 'cancelado' THEN
    tem_baixa := EXISTS (SELECT 1 FROM public.pedido_baixado(_id));
    IF tem_baixa AND _devolver IS NULL THEN RAISE EXCEPTION 'Informe se os materiais serão devolvidos ao estoque'; END IF;
    IF tem_baixa AND _devolver THEN
      PERFORM public._sincronizar_estoque(_id, true, 'Devolução por cancelamento');
      PERFORM public._hist(_id, 'Cancelamento', NULL, 'Cancelado com devolução dos materiais ao estoque');
    ELSIF tem_baixa THEN
      PERFORM public._hist(_id, 'Cancelamento', NULL, 'Cancelado sem devolução dos materiais ao estoque');
    ELSE
      PERFORM public._hist(_id, 'Cancelamento', NULL, 'Cancelado (não havia baixa de estoque)');
    END IF;
    UPDATE public.pedidos SET valor_cancelamento = CASE WHEN p.status = 'orcamento' THEN p.preco_real ELSE p.preco_venda END WHERE id = _id;
  ELSIF public._status_baixa(_status) THEN
    PERFORM public._sincronizar_estoque(_id, false, 'Baixa ao entrar em Preparação');
  END IF;
  PERFORM public._hist(_id, 'Status', p.status::text, _status::text);
  UPDATE public.pedidos SET status = _status, updated_at = now() WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.pedido_tem_baixa(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.pedido_baixado(_id));
$$;

REVOKE EXECUTE ON FUNCTION public._hist(uuid,text,text,text), public._mov_estoque_pedido(uuid,public.tipo_movimentacao,numeric,uuid,text),
  public._sincronizar_estoque(uuid,boolean,text), public._gravar_itens(uuid,jsonb,boolean), public.pedido_baixado(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.materiais_disponiveis(), public.criar_pedido(jsonb,jsonb,uuid), public.atualizar_pedido(uuid,jsonb),
  public.atualizar_itens_pedido(uuid,jsonb), public.alterar_status_pedido(uuid,public.status_pedido,boolean), public.pedido_tem_baixa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.materiais_disponiveis(), public.criar_pedido(jsonb,jsonb,uuid), public.atualizar_pedido(uuid,jsonb),
  public.atualizar_itens_pedido(uuid,jsonb), public.alterar_status_pedido(uuid,public.status_pedido,boolean), public.pedido_tem_baixa(uuid) TO authenticated;