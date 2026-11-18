ALTER TABLE public.pedidos ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
UPDATE public.pedidos p SET empresa_id = pr.empresa_id FROM public.profiles pr WHERE pr.id=p.vendedor_id AND p.empresa_id IS NULL;
CREATE INDEX pedidos_empresa_data ON public.pedidos(empresa_id,created_at);
CREATE FUNCTION public._empresa_novo_pedido() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN NEW.empresa_id := public.minha_empresa(); RETURN NEW; END $$;
CREATE TRIGGER trg_empresa_novo_pedido BEFORE INSERT ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public._empresa_novo_pedido();
CREATE TABLE public.financeiro_movimentos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sequencia bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), pedido_id uuid REFERENCES public.pedidos(id),
 estorno_de uuid REFERENCES public.financeiro_movimentos(id), tipo text NOT NULL CHECK(tipo IN ('entrada','saida')),
 valor numeric(16,2) NOT NULL CHECK(valor>0), descricao text NOT NULL, categoria text NOT NULL,
 metodo_pagamento public.metodo_pagamento NOT NULL, data_movimento date NOT NULL,
 usuario_id uuid NOT NULL REFERENCES public.profiles(id), chave uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(empresa_id,chave)
);
GRANT SELECT ON public.financeiro_movimentos TO authenticated;
GRANT ALL ON public.financeiro_movimentos TO service_role;
ALTER TABLE public.financeiro_movimentos ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.nivel_acesso_setor(_user uuid,_setor text) RETURNS public.nivel_acesso LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN p.tipo_conta='empresarial' THEN 'edicao'::public.nivel_acesso WHEN NOT p.ativo THEN 'sem_acesso'::public.nivel_acesso ELSE COALESCE(
 (SELECT nivel FROM public.usuario_permissoes WHERE user_id=_user AND setor=_setor),
 (SELECT nivel FROM public.cargo_permissoes WHERE cargo_id=p.cargo_id AND setor=_setor),
 CASE WHEN _setor IN ('vendas','pedidos') OR (_setor='financeiro' AND EXISTS(SELECT 1 FROM public.cargos c WHERE c.id=p.cargo_id AND c.tipo='financeiro' AND c.empresa_id=p.empresa_id)) THEN 'edicao'::public.nivel_acesso ELSE 'sem_acesso'::public.nivel_acesso END) END FROM public.profiles p WHERE p.id=_user $$;
CREATE POLICY "financeiro le propria empresa" ON public.financeiro_movimentos FOR SELECT TO authenticated USING(empresa_id=public.minha_empresa() AND public.nivel_acesso_setor(auth.uid(),'financeiro') IN ('visualizacao','edicao'));
CREATE INDEX financeiro_empresa_data ON public.financeiro_movimentos(empresa_id,data_movimento,sequencia);
CREATE INDEX financeiro_pedido ON public.financeiro_movimentos(pedido_id);
CREATE INDEX financeiro_estorno ON public.financeiro_movimentos(estorno_de);
CREATE FUNCTION public.financeiro_lancar(_dados jsonb,_chave uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE emp uuid; novo uuid; p public.pedidos; original public.financeiro_movimentos; v numeric; pago numeric; devolvido numeric; pid uuid; eid uuid; t text; cat text; d text; metodo public.metodo_pagamento; dia date;
BEGIN
 emp:=public.minha_empresa();
 IF auth.uid() IS NULL OR emp IS NULL OR COALESCE(public.nivel_acesso_setor(auth.uid(),'financeiro'),'sem_acesso')<>'edicao' THEN RAISE EXCEPTION 'Sem permissão para alterar o Financeiro'; END IF;
 IF _chave IS NULL THEN RAISE EXCEPTION 'Chave obrigatória'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(emp::text,0));
 SELECT id INTO novo FROM public.financeiro_movimentos WHERE empresa_id=emp AND chave=_chave; IF FOUND THEN RETURN novo; END IF;
 v:=(_dados->>'valor')::numeric; pid:=NULLIF(_dados->>'pedido_id','')::uuid; eid:=NULLIF(_dados->>'estorno_de','')::uuid; t:=_dados->>'tipo'; cat:=trim(_dados->>'categoria'); d:=trim(_dados->>'descricao'); metodo:=(_dados->>'metodo_pagamento')::public.metodo_pagamento; dia:=(_dados->>'data_movimento')::date;
 IF v IS NULL OR v<=0 OR v<>round(v,2) OR v>=100000000000000 OR v::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Informe um valor positivo com até duas casas decimais'; END IF;
 IF t IS NULL OR t NOT IN ('entrada','saida') OR NULLIF(cat,'') IS NULL OR NULLIF(d,'') IS NULL OR metodo IS NULL OR dia IS NULL OR dia>(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Preencha os campos e informe uma data não futura'; END IF;
 IF eid IS NOT NULL THEN
 SELECT * INTO original FROM public.financeiro_movimentos WHERE id=eid AND empresa_id=emp FOR UPDATE;
 IF NOT FOUND OR original.estorno_de IS NOT NULL THEN RAISE EXCEPTION 'Movimentação inválida para estorno'; END IF;
 SELECT COALESCE(sum(valor),0) INTO devolvido FROM public.financeiro_movimentos WHERE estorno_de=eid AND empresa_id=emp;
 IF v>original.valor-devolvido THEN RAISE EXCEPTION 'Estorno excede o valor disponível'; END IF;
 IF dia<original.data_movimento THEN RAISE EXCEPTION 'Estorno não pode preceder a movimentação'; END IF;
 pid:=original.pedido_id; t:=CASE WHEN original.tipo='entrada' THEN 'saida' ELSE 'entrada' END; metodo:=original.metodo_pagamento; cat:=original.categoria;
 ELSIF pid IS NOT NULL THEN
 SELECT * INTO p FROM public.pedidos WHERE id=pid AND empresa_id=emp FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
 IF NOT public._status_usa_venda(p.status) OR p.preco_venda IS NULL OR t<>'entrada' THEN RAISE EXCEPTION 'Recebimentos exigem pedido aprovado e preço de venda'; END IF;
 SELECT COALESCE(sum(CASE WHEN tipo='entrada' THEN valor ELSE -valor END),0) INTO pago FROM public.financeiro_movimentos WHERE pedido_id=pid AND empresa_id=emp;
 IF v>p.preco_venda-pago THEN RAISE EXCEPTION 'Pagamento excede o valor pendente'; END IF;
 END IF;
 INSERT INTO public.financeiro_movimentos(empresa_id,pedido_id,estorno_de,tipo,valor,descricao,categoria,metodo_pagamento,data_movimento,usuario_id,chave) VALUES(emp,pid,eid,t,v,d,cat,metodo,dia,auth.uid(),_chave) RETURNING id INTO novo;
 IF pid IS NOT NULL THEN PERFORM public._hist(pid,CASE WHEN eid IS NULL THEN 'Recebimento' ELSE 'Estorno financeiro' END,NULL,format('%s: R$ %s (%s)',d,v,metodo)); END IF;
 RETURN novo;
END $$;
CREATE FUNCTION public.financeiro_consultar(_area text,_filtros jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE emp uuid; inicio date; fim date; busca text; pag text; tp text; st text; offst int; resultado jsonb;
BEGIN
 emp:=public.minha_empresa();
 IF auth.uid() IS NULL OR emp IS NULL OR COALESCE(public.nivel_acesso_setor(auth.uid(),'financeiro'),'sem_acesso') NOT IN ('visualizacao','edicao') THEN RAISE EXCEPTION 'Sem acesso ao Financeiro'; END IF;
 inicio:=COALESCE(NULLIF(_filtros->>'inicio','')::date,'1900-01-01'); fim:=COALESCE(NULLIF(_filtros->>'fim','')::date,'9999-12-31'); busca:=COALESCE(_filtros->>'busca',''); pag:=COALESCE(_filtros->>'pagamento','todos'); tp:=COALESCE(_filtros->>'tipo','todos'); st:=COALESCE(_filtros->>'status','todos'); offst:=GREATEST(0,COALESCE((_filtros->>'offset')::int,0));
 IF _area='dashboard' THEN
 WITH meses AS (SELECT generate_series(date_trunc('month',inicio::timestamp),date_trunc('month',fim::timestamp),interval '1 month')::date mes), mov AS(SELECT date_trunc('month',data_movimento)::date mes, sum(CASE WHEN tipo='entrada' THEN valor ELSE 0 END) entradas,sum(CASE WHEN tipo='saida' THEN valor ELSE 0 END) saidas FROM public.financeiro_movimentos WHERE empresa_id=emp AND data_movimento BETWEEN inicio AND fim GROUP BY 1), ord AS(SELECT date_trunc('month',p.created_at AT TIME ZONE 'America/Sao_Paulo')::date mes,count(*) quantidade FROM public.pedidos p WHERE p.empresa_id=emp AND (p.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN inicio AND fim GROUP BY 1)
 SELECT jsonb_build_object('meses',COALESCE(jsonb_agg(jsonb_build_object('mes',m.mes,'entradas',COALESCE(v.entradas,0),'saidas',COALESCE(v.saidas,0),'resultado',COALESCE(v.entradas,0)-COALESCE(v.saidas,0),'pedidos',COALESCE(o.quantidade,0)) ORDER BY m.mes),'[]'::jsonb)) INTO resultado FROM meses m LEFT JOIN mov v USING(mes) LEFT JOIN ord o USING(mes);
 RETURN resultado || jsonb_build_object('caixa',(SELECT COALESCE(sum(CASE WHEN tipo='entrada' THEN valor ELSE -valor END),0) FROM public.financeiro_movimentos WHERE empresa_id=emp),'receber',(SELECT COALESCE(sum(GREATEST(p.preco_venda-COALESCE(m.pago,0),0)),0) FROM public.pedidos p LEFT JOIN LATERAL(SELECT sum(CASE WHEN tipo='entrada' THEN valor ELSE -valor END) pago FROM public.financeiro_movimentos WHERE pedido_id=p.id AND empresa_id=emp)m ON true WHERE p.empresa_id=emp AND public._status_usa_venda(p.status)));
 ELSIF _area='caixa' THEN
 WITH saldo AS(SELECT m.*,sum(CASE WHEN tipo='entrada' THEN valor ELSE -valor END) OVER(ORDER BY data_movimento,sequencia) saldo FROM public.financeiro_movimentos m WHERE empresa_id=emp), filtrado AS(SELECT s.*,pr.nome responsavel FROM saldo s LEFT JOIN public.profiles pr ON pr.id=s.usuario_id WHERE data_movimento BETWEEN inicio AND fim AND (pag='todos' OR metodo_pagamento::text=pag) AND (tp='todos' OR tipo=tp) AND (NULLIF(_filtros->>'pedido_id','') IS NULL OR pedido_id=NULLIF(_filtros->>'pedido_id','')::uuid)), pagina AS(SELECT * FROM filtrado ORDER BY data_movimento DESC,sequencia DESC LIMIT 50 OFFSET offst)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtrado),'itens',COALESCE(jsonb_agg(to_jsonb(pagina) ORDER BY data_movimento DESC,sequencia DESC),'[]'::jsonb)) INTO resultado FROM pagina; RETURN resultado;
 ELSIF _area='pedidos' THEN
 WITH base AS(SELECT p.id,p.numero,p.cliente_nome,p.created_at,p.status,p.preco_venda valor_total,COALESCE(m.pago,0) pago,CASE WHEN public._status_usa_venda(p.status) THEN GREATEST(p.preco_venda-COALESCE(m.pago,0),0) ELSE 0 END pendente,COALESCE(m.metodos,'[]'::jsonb) metodos,CASE WHEN p.status='cancelado' THEN 'cancelado' WHEN p.status='orcamento' THEN 'orcamento' WHEN p.preco_venda IS NULL THEN 'nao_calculado' WHEN COALESCE(m.pago,0)>=p.preco_venda THEN 'pago' WHEN COALESCE(m.pago,0)>0 THEN 'parcial' ELSE 'nao_pago' END status_pagamento FROM public.pedidos p LEFT JOIN LATERAL(SELECT sum(CASE WHEN tipo='entrada' THEN valor ELSE -valor END) pago,jsonb_agg(DISTINCT metodo_pagamento::text) metodos FROM public.financeiro_movimentos WHERE pedido_id=p.id AND empresa_id=emp)m ON true WHERE p.empresa_id=emp), filtrado AS(SELECT * FROM base WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN inicio AND fim AND (cliente_nome ILIKE '%'||busca||'%' OR lpad(numero::text,5,'0') ILIKE '%'||replace(busca,'#','')||'%') AND (st='todos' OR status_pagamento=st OR (st='pendente' AND pendente>0)) AND (pag='todos' OR metodos ? pag)), pagina AS(SELECT * FROM filtrado ORDER BY created_at DESC,id LIMIT 50 OFFSET offst)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtrado),'itens',COALESCE(jsonb_agg(to_jsonb(pagina) ORDER BY created_at DESC,id),'[]'::jsonb)) INTO resultado FROM pagina; RETURN resultado;
 ELSIF _area='produtos' THEN
 WITH base AS(SELECT i.produto_id,i.produto_nome,i.unidade,sum(i.consumo) quantidade,sum(i.preco_unitario*i.consumo) valor,count(DISTINCT p.id) pedidos,min(h.quando)::date primeira,max(h.quando)::date ultima FROM public.pedido_itens i JOIN public.pedidos p ON p.id=i.pedido_id JOIN LATERAL(SELECT max(created_at) quando FROM public.pedido_historico WHERE pedido_id=p.id AND campo='Status' AND valor_novo='concluido')h ON true WHERE p.empresa_id=emp AND p.status='concluido' AND (h.quando AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN inicio AND fim AND i.produto_nome ILIKE '%'||busca||'%' GROUP BY i.produto_id,i.produto_nome,i.unidade), pagina AS(SELECT * FROM base ORDER BY pedidos DESC,quantidade DESC,produto_nome LIMIT 50 OFFSET offst)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM base),'itens',COALESCE(jsonb_agg(to_jsonb(pagina) ORDER BY pedidos DESC,quantidade DESC,produto_nome),'[]'::jsonb)) INTO resultado FROM pagina; RETURN resultado;
 ELSE RAISE EXCEPTION 'Consulta inválida'; END IF;
END $$;
REVOKE ALL ON FUNCTION public._empresa_novo_pedido(),public.financeiro_lancar(jsonb,uuid),public.financeiro_consultar(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.financeiro_lancar(jsonb,uuid),public.financeiro_consultar(text,jsonb) TO authenticated;