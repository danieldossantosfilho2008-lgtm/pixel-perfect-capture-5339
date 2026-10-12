CREATE OR REPLACE FUNCTION public._n(_v numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN _v IS NULL THEN NULL ELSE replace(rtrim(rtrim(round(_v,3)::text,'0'),'.'),'.',',') END $$;

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
      PERFORM public._hist(_pedido, 'Estoque', NULL, format('Baixa de %s %s de %s (%s)', public._n(dif), un, nome, _motivo));
    ELSE
      PERFORM public._mov_estoque_pedido(r.produto_id, 'entrada', -dif, _pedido, _motivo);
      PERFORM public._hist(_pedido, 'Estoque', NULL, format('Devolução de %s %s de %s (%s)', public._n(-dif), un, nome, _motivo));
    END IF;
  END LOOP;
END $$;

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
    resumo := resumo || CASE WHEN resumo = '' THEN '' ELSE '; ' END || format('%s: %s %s', p.nome, public._n(c), p.unidade_medida)
      || CASE WHEN l IS NOT NULL THEN format(' (%s×%s m, %s pç)', public._n(l), public._n(a), public._n(q)) ELSE '' END;
  END LOOP;
  IF _checar_disponivel THEN
    FOR p IN SELECT i.produto_nome, SUM(i.consumo) q, pr.quantidade d, i.unidade FROM public.pedido_itens i JOIN public.produtos pr ON pr.id = i.produto_id
      WHERE i.pedido_id = _pedido GROUP BY i.produto_nome, pr.quantidade, i.unidade LOOP
      IF p.q > p.d THEN RAISE EXCEPTION 'Estoque insuficiente de "%": disponível % %, necessário % %', p.produto_nome, public._n(p.d), p.unidade, public._n(p.q), p.unidade; END IF;
    END LOOP;
  END IF;
  RETURN resumo;
END $$;

CREATE OR REPLACE FUNCTION public.atualizar_itens_pedido(_id uuid, _itens jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.pedidos; antes text; depois text;
BEGIN
  PERFORM public._exigir_login();
  SELECT * INTO p FROM public.pedidos WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p.status IN ('cancelado','concluido') THEN RAISE EXCEPTION 'Materiais não podem ser alterados neste status'; END IF;
  SELECT string_agg(format('%s: %s %s', produto_nome, public._n(consumo), unidade), '; ' ORDER BY produto_nome) INTO antes FROM public.pedido_itens WHERE pedido_id = _id;
  depois := public._gravar_itens(_id, _itens, NOT public._status_baixa(p.status));
  PERFORM public._hist(_id, 'Materiais', antes, depois);
  IF public._status_baixa(p.status) THEN PERFORM public._sincronizar_estoque(_id, false, 'Ajuste por alteração de materiais'); END IF;
  UPDATE public.pedidos SET updated_at = now() WHERE id = _id;
END $$;

REVOKE EXECUTE ON FUNCTION public._sincronizar_estoque(uuid,boolean,text), public._gravar_itens(uuid,jsonb,boolean) FROM PUBLIC, anon, authenticated;