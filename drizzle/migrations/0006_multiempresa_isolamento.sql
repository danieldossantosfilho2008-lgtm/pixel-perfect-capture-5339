ALTER TABLE public.profiles ALTER COLUMN empresa_id DROP DEFAULT;
ALTER TABLE public.cargos ALTER COLUMN empresa_id DROP DEFAULT;

ALTER TABLE public.categorias ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
UPDATE public.categorias SET empresa_id = (SELECT id FROM public.empresas ORDER BY created_at LIMIT 1) WHERE empresa_id IS NULL;
ALTER TABLE public.categorias ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.categorias DROP CONSTRAINT categorias_codigo_key;
ALTER TABLE public.categorias ADD CONSTRAINT categorias_empresa_codigo_key UNIQUE (empresa_id, codigo);

ALTER TABLE public.cargos DROP CONSTRAINT cargos_nome_key;
CREATE UNIQUE INDEX cargos_empresa_nome_key ON public.cargos (empresa_id, lower(nome));

ALTER TABLE public.produtos ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.produtos DISABLE TRIGGER trg_proteger_quantidade;
UPDATE public.produtos p SET empresa_id = c.empresa_id FROM public.categorias c WHERE c.id = p.categoria_id AND p.empresa_id IS NULL;
ALTER TABLE public.produtos ENABLE TRIGGER trg_proteger_quantidade;
ALTER TABLE public.produtos ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.pedidos ALTER COLUMN empresa_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS produtos_empresa_idx ON public.produtos (empresa_id);
CREATE INDEX IF NOT EXISTS pedidos_empresa_idx ON public.pedidos (empresa_id);
CREATE INDEX IF NOT EXISTS profiles_empresa_idx ON public.profiles (empresa_id);
CREATE INDEX IF NOT EXISTS categorias_empresa_idx ON public.categorias (empresa_id);

CREATE OR REPLACE FUNCTION public._exigir_login() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN IF auth.uid() IS NULL OR public.minha_empresa() IS NULL THEN RAISE EXCEPTION 'É preciso estar logado em uma empresa'; END IF; END $$;

CREATE OR REPLACE FUNCTION public.nivel_acesso_setor(_user uuid, _setor text) RETURNS public.nivel_acesso LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT CASE WHEN p.empresa_id IS NULL THEN 'sem_acesso'::public.nivel_acesso WHEN p.tipo_conta='empresarial' THEN 'edicao'::public.nivel_acesso WHEN NOT p.ativo THEN 'sem_acesso'::public.nivel_acesso ELSE COALESCE(
 (SELECT nivel FROM public.usuario_permissoes WHERE user_id=_user AND setor=_setor),
 (SELECT nivel FROM public.cargo_permissoes cp JOIN public.cargos c ON c.id=cp.cargo_id WHERE cp.cargo_id=p.cargo_id AND c.empresa_id=p.empresa_id AND cp.setor=_setor),
 CASE WHEN _setor IN ('vendas','pedidos') OR (_setor='financeiro' AND EXISTS(SELECT 1 FROM public.cargos c WHERE c.id=p.cargo_id AND c.tipo='financeiro' AND c.empresa_id=p.empresa_id)) THEN 'edicao'::public.nivel_acesso ELSE 'sem_acesso'::public.nivel_acesso END) END
 FROM public.profiles p WHERE p.id=_user AND (auth.uid() IS NULL OR p.id=auth.uid() OR p.empresa_id=public.minha_empresa()) $$;

CREATE OR REPLACE FUNCTION public._checar_mesma_empresa() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'produtos' THEN
    IF NOT EXISTS (SELECT 1 FROM public.categorias WHERE id = NEW.categoria_id AND empresa_id = NEW.empresa_id) THEN RAISE EXCEPTION 'Categoria inválida para esta empresa'; END IF;
  ELSIF TG_TABLE_NAME = 'pedido_itens' THEN
    IF NOT EXISTS (SELECT 1 FROM public.produtos pr JOIN public.pedidos pe ON pe.empresa_id = pr.empresa_id WHERE pr.id = NEW.produto_id AND pe.id = NEW.pedido_id) THEN RAISE EXCEPTION 'Material não encontrado'; END IF;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    IF TG_OP = 'UPDATE' AND OLD.empresa_id IS NOT NULL AND NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN RAISE EXCEPTION 'Este usuário já pertence a outra empresa'; END IF;
    IF NEW.cargo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cargos WHERE id = NEW.cargo_id AND empresa_id = NEW.empresa_id) THEN RAISE EXCEPTION 'Cargo inválido'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mesma_empresa BEFORE INSERT OR UPDATE OF categoria_id, empresa_id ON public.produtos FOR EACH ROW EXECUTE FUNCTION public._checar_mesma_empresa();
CREATE TRIGGER trg_mesma_empresa BEFORE INSERT OR UPDATE ON public.pedido_itens FOR EACH ROW EXECUTE FUNCTION public._checar_mesma_empresa();
CREATE TRIGGER trg_mesma_empresa BEFORE INSERT OR UPDATE OF cargo_id, empresa_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION public._checar_mesma_empresa();

CREATE OR REPLACE FUNCTION public._preparar_empresa(_emp uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cat uuid;
BEGIN
  INSERT INTO public.cargos (nome, cor, tipo, empresa_id) VALUES ('Vendedor','#2563eb','vendedor',_emp), ('Administrativo','#d99a1e','administrativo',_emp), ('Financeiro','#2f8f5b','financeiro',_emp);
  INSERT INTO public.categorias (codigo,nome,unidade_medida,ordem,empresa_id) VALUES ('tecido','Tecido','m²',1,_emp) RETURNING id INTO cat;
  INSERT INTO public.categoria_atributos (categoria_id,atributo,rotulo,obrigatorio) VALUES (cat,'variacao','Variação',false);
  INSERT INTO public.categorias (codigo,nome,unidade_medida,ordem,empresa_id) VALUES ('trilhos','Trilhos','un',2,_emp) RETURNING id INTO cat;
  INSERT INTO public.categoria_atributos (categoria_id,atributo,rotulo,obrigatorio) VALUES (cat,'dimensao','Dimensão',true);
  INSERT INTO public.categorias (codigo,nome,unidade_medida,ordem,empresa_id) VALUES ('bando','Bando','un',3,_emp) RETURNING id INTO cat;
  INSERT INTO public.categoria_atributos (categoria_id,atributo,rotulo,obrigatorio) VALUES (cat,'dimensao','Dimensão',true);
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp uuid; nome_emp text := left(NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'empresa_nome','')),''),120);
BEGIN
  IF nome_emp IS NOT NULL THEN
    INSERT INTO public.empresas (nome) VALUES (nome_emp) RETURNING id INTO emp;
    PERFORM public._preparar_empresa(emp);
  END IF;
  INSERT INTO public.profiles (id, nome, email, tipo_conta, empresa_id)
  VALUES (NEW.id, left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'nome'),''), split_part(NEW.email,'@',1)),120), NEW.email,
    CASE WHEN emp IS NULL THEN 'profissional' ELSE 'empresarial' END::public.tipo_conta, emp);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.vincular_convite(_user uuid, _empresa uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _empresa IS NULL OR NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = _empresa) THEN RAISE EXCEPTION 'Empresa inválida'; END IF;
  UPDATE public.profiles SET empresa_id = _empresa WHERE id = _user AND empresa_id IS NULL AND tipo_conta = 'profissional';
  IF NOT FOUND THEN RAISE EXCEPTION 'Este usuário já pertence a uma empresa'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.criar_produto(_dados jsonb, _atributos jsonb, _quantidade_inicial numeric DEFAULT 0) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE novo_id uuid; emp uuid := public.minha_empresa();
BEGIN
  PERFORM public.exigir_edicao_estoque();
  IF emp IS NULL THEN RAISE EXCEPTION 'Sem empresa vinculada'; END IF;
  IF _quantidade_inicial < 0 THEN RAISE EXCEPTION 'Quantidade não pode ser negativa'; END IF;
  INSERT INTO public.produtos (empresa_id,categoria_id,nome,tipo,cor,descricao,preco,estoque_min,estoque_max,status,created_by,updated_by)
  VALUES (emp, (_dados->>'categoria_id')::uuid, trim(_dados->>'nome'), trim(_dados->>'tipo'), trim(_dados->>'cor'), NULLIF(trim(_dados->>'descricao'),''),
    COALESCE((_dados->>'preco')::numeric,0), (_dados->>'estoque_min')::numeric, (_dados->>'estoque_max')::numeric,
    COALESCE((_dados->>'status')::public.status_produto,'ativo'), auth.uid(), auth.uid())
  RETURNING id INTO novo_id;
  PERFORM public.salvar_atributos(novo_id, (_dados->>'categoria_id')::uuid, _atributos);
  IF COALESCE(_quantidade_inicial,0) > 0 THEN
    PERFORM public.movimentar_estoque(novo_id, 'entrada', _quantidade_inicial, 'Estoque inicial no cadastro');
  END IF;
  RETURN novo_id;
END $$;

DO $do$
DECLARE r record; d text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public.atualizar_pedido(uuid,jsonb)', $a$FROM public.pedidos WHERE id = _id FOR UPDATE$a$, $a$FROM public.pedidos WHERE id = _id AND empresa_id = public.minha_empresa() FOR UPDATE$a$),
    ('public.alterar_status_pedido(uuid,status_pedido,boolean)', $a$FROM public.pedidos WHERE id = _id FOR UPDATE$a$, $a$FROM public.pedidos WHERE id = _id AND empresa_id = public.minha_empresa() FOR UPDATE$a$),
    ('public.atualizar_itens_pedido(uuid,jsonb)', $a$FROM public.pedidos WHERE id = _id FOR UPDATE$a$, $a$FROM public.pedidos WHERE id = _id AND empresa_id = public.minha_empresa() FOR UPDATE$a$),
    ('public.movimentar_estoque(uuid,tipo_movimentacao,numeric,text)', $a$FROM public.produtos WHERE id = _produto FOR UPDATE$a$, $a$FROM public.produtos WHERE id = _produto AND empresa_id = public.minha_empresa() FOR UPDATE$a$),
    ('public.atualizar_produto(uuid,jsonb,jsonb)', $a$WHERE id = _id;$a$, $a$WHERE id = _id AND empresa_id = public.minha_empresa();$a$),
    ('public.alterar_status_produto(uuid,status_produto)', $a$WHERE id = _id;$a$, $a$WHERE id = _id AND empresa_id = public.minha_empresa(); IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;$a$),
    ('public.materiais_disponiveis()', $a$WHERE p.status = 'ativo'$a$, $a$WHERE p.status = 'ativo' AND p.empresa_id = public.minha_empresa()$a$),
    ('public._gravar_itens(uuid,jsonb,boolean)', $a$WHERE pr.id = (it->>'produto_id')::uuid;$a$, $a$WHERE pr.id = (it->>'produto_id')::uuid AND pr.empresa_id = (SELECT pe.empresa_id FROM public.pedidos pe WHERE pe.id = _pedido);$a$),
    ('public.criar_pedido(jsonb,jsonb,uuid)', $a$WHERE chave_idempotencia = _chave;$a$, $a$WHERE chave_idempotencia = _chave AND empresa_id = public.minha_empresa();$a$),
    ('public.pedido_tem_baixa(uuid)', $a$auth.uid() IS NOT NULL AND EXISTS$a$, $a$auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.pedidos WHERE id = _id AND empresa_id = public.minha_empresa()) AND EXISTS$a$)
  ) v(f, a, b) LOOP
    d := pg_get_functiondef(r.f::regprocedure);
    IF position(r.a in d) = 0 THEN RAISE EXCEPTION 'Não foi possível ajustar %', r.f; END IF;
    EXECUTE replace(d, r.a, r.b);
  END LOOP;
END $do$;

DROP POLICY IF EXISTS "le produtos" ON public.produtos;
CREATE POLICY "le produtos" ON public.produtos FOR SELECT TO authenticated USING (empresa_id = public.minha_empresa() AND public.nivel_acesso_setor(auth.uid(),'estoque') <> 'sem_acesso');
DROP POLICY IF EXISTS "le prod_attr" ON public.produto_atributos;
CREATE POLICY "le prod_attr" ON public.produto_atributos FOR SELECT TO authenticated USING (public.nivel_acesso_setor(auth.uid(),'estoque') <> 'sem_acesso' AND EXISTS (SELECT 1 FROM public.produtos pr WHERE pr.id = produto_atributos.produto_id AND pr.empresa_id = public.minha_empresa()));
DROP POLICY IF EXISTS "le movs" ON public.movimentacoes_estoque;
CREATE POLICY "le movs" ON public.movimentacoes_estoque FOR SELECT TO authenticated USING (public.nivel_acesso_setor(auth.uid(),'estoque') <> 'sem_acesso' AND EXISTS (SELECT 1 FROM public.produtos pr WHERE pr.id = movimentacoes_estoque.produto_id AND pr.empresa_id = public.minha_empresa()));
DROP POLICY IF EXISTS "le pedidos" ON public.pedidos;
CREATE POLICY "le pedidos" ON public.pedidos FOR SELECT TO authenticated USING (empresa_id = public.minha_empresa() AND public.ve_pedidos());
DROP POLICY IF EXISTS "le pedido_itens" ON public.pedido_itens;
CREATE POLICY "le pedido_itens" ON public.pedido_itens FOR SELECT TO authenticated USING (public.ve_pedidos() AND EXISTS (SELECT 1 FROM public.pedidos pe WHERE pe.id = pedido_itens.pedido_id AND pe.empresa_id = public.minha_empresa()));
DROP POLICY IF EXISTS "le pedido_historico" ON public.pedido_historico;
CREATE POLICY "le pedido_historico" ON public.pedido_historico FOR SELECT TO authenticated USING (public.ve_pedidos() AND EXISTS (SELECT 1 FROM public.pedidos pe WHERE pe.id = pedido_historico.pedido_id AND pe.empresa_id = public.minha_empresa()));
DROP POLICY IF EXISTS "membro le categorias" ON public.categorias;
CREATE POLICY "membro le categorias" ON public.categorias FOR SELECT TO authenticated USING (empresa_id = public.minha_empresa());
DROP POLICY IF EXISTS "membro le cat_attr" ON public.categoria_atributos;
CREATE POLICY "membro le cat_attr" ON public.categoria_atributos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.categorias c WHERE c.id = categoria_atributos.categoria_id AND c.empresa_id = public.minha_empresa()));

REVOKE EXECUTE ON FUNCTION public._fhist(uuid,text,text,text), public._hist(uuid,text,text,text), public.salvar_atributos(uuid,uuid,jsonb),
  public._gravar_itens(uuid,jsonb,boolean), public._mov_estoque_pedido(uuid,tipo_movimentacao,numeric,uuid,text), public._sincronizar_estoque(uuid,boolean,text),
  public.pedido_baixado(uuid), public.empresa_padrao(), public.handle_new_user(), public._preparar_empresa(uuid), public.vincular_convite(uuid,uuid),
  public._checar_mesma_empresa(), public._guarda_pedidos(), public._empresa_novo_pedido() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_convite(uuid,uuid) TO service_role;