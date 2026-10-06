
CREATE TYPE public.tipo_conta AS ENUM ('empresarial','profissional');
CREATE TYPE public.nivel_acesso AS ENUM ('sem_acesso','visualizacao','edicao');
CREATE TYPE public.status_produto AS ENUM ('ativo','inativo');
CREATE TYPE public.tipo_movimentacao AS ENUM ('entrada','saida','ajuste_positivo','ajuste_negativo');

-- Cargos / setores / permissões
CREATE TABLE public.cargos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.setores (codigo text PRIMARY KEY, nome text NOT NULL);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  nome text NOT NULL DEFAULT '',
  email text,
  tipo_conta public.tipo_conta NOT NULL DEFAULT 'profissional',
  cargo_id uuid REFERENCES public.cargos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.cargo_permissoes (cargo_id uuid NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE, setor text NOT NULL REFERENCES public.setores(codigo), nivel public.nivel_acesso NOT NULL, PRIMARY KEY (cargo_id, setor));
CREATE TABLE public.usuario_permissoes (user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, setor text NOT NULL REFERENCES public.setores(codigo), nivel public.nivel_acesso NOT NULL, PRIMARY KEY (user_id, setor));

GRANT SELECT ON public.cargos, public.setores, public.profiles, public.cargo_permissoes, public.usuario_permissoes TO authenticated;
GRANT ALL ON public.cargos, public.setores, public.profiles, public.cargo_permissoes, public.usuario_permissoes TO service_role;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth le cargos" ON public.cargos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth le setores" ON public.setores FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth le perfis" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth le cargo_perm" ON public.cargo_permissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "le propria perm" ON public.usuario_permissoes FOR SELECT TO authenticated USING (user_id = auth.uid());

INSERT INTO public.setores VALUES ('estoque','Estoque');

CREATE OR REPLACE FUNCTION public.nivel_acesso_setor(_user uuid, _setor text)
RETURNS public.nivel_acesso LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p.tipo_conta = 'empresarial' THEN 'edicao'::public.nivel_acesso
    ELSE COALESCE(
      (SELECT nivel FROM public.usuario_permissoes WHERE user_id = _user AND setor = _setor),
      (SELECT nivel FROM public.cargo_permissoes WHERE cargo_id = p.cargo_id AND setor = _setor),
      'sem_acesso'::public.nivel_acesso)
  END
  FROM public.profiles p WHERE p.id = _user
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, tipo_conta)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email,
    CASE WHEN EXISTS (SELECT 1 FROM public.profiles) THEN 'profissional' ELSE 'empresarial' END::public.tipo_conta);
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Categorias
CREATE TABLE public.categorias (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), codigo text NOT NULL UNIQUE, nome text NOT NULL, unidade_medida text NOT NULL DEFAULT 'un', ordem int NOT NULL DEFAULT 0);
CREATE TABLE public.categoria_atributos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), categoria_id uuid NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE, atributo text NOT NULL, rotulo text NOT NULL, obrigatorio boolean NOT NULL DEFAULT false, UNIQUE (categoria_id, atributo));
GRANT SELECT ON public.categorias, public.categoria_atributos TO authenticated;
GRANT ALL ON public.categorias, public.categoria_atributos TO service_role;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categoria_atributos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth le categorias" ON public.categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth le cat_attr" ON public.categoria_atributos FOR SELECT TO authenticated USING (true);

WITH c AS (INSERT INTO public.categorias (codigo,nome,unidade_medida,ordem) VALUES ('tecido','Tecido','m²',1),('trilhos','Trilhos','un',2),('bando','Bando','un',3) RETURNING id, codigo)
INSERT INTO public.categoria_atributos (categoria_id, atributo, rotulo, obrigatorio)
SELECT id, CASE WHEN codigo='tecido' THEN 'variacao' ELSE 'dimensao' END,
  CASE WHEN codigo='tecido' THEN 'Variação' ELSE 'Dimensão' END,
  codigo <> 'tecido' FROM c;

-- Produtos
CREATE TABLE public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES public.categorias(id),
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  tipo text NOT NULL CHECK (length(trim(tipo)) > 0),
  cor text NOT NULL CHECK (length(trim(cor)) > 0),
  descricao text,
  quantidade numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  preco numeric(14,2) NOT NULL DEFAULT 0 CHECK (preco >= 0),
  estoque_min numeric(14,3) CHECK (estoque_min IS NULL OR estoque_min >= 0),
  estoque_max numeric(14,3) CHECK (estoque_max IS NULL OR estoque_max >= 0),
  status public.status_produto NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  CONSTRAINT max_maior_min CHECK (estoque_min IS NULL OR estoque_max IS NULL OR estoque_max >= estoque_min)
);
CREATE TABLE public.produto_atributos (produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE, atributo text NOT NULL, valor text NOT NULL, PRIMARY KEY (produto_id, atributo));
CREATE TABLE public.movimentacoes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  tipo public.tipo_movimentacao NOT NULL,
  quantidade numeric(14,3) NOT NULL CHECK (quantidade > 0),
  saldo_anterior numeric(14,3) NOT NULL CHECK (saldo_anterior >= 0),
  saldo_posterior numeric(14,3) NOT NULL CHECK (saldo_posterior >= 0),
  usuario_id uuid REFERENCES public.profiles(id),
  observacao text,
  origem_tipo text,
  origem_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.movimentacoes_estoque (produto_id, created_at DESC);

GRANT SELECT ON public.produtos, public.produto_atributos, public.movimentacoes_estoque TO authenticated;
GRANT ALL ON public.produtos, public.produto_atributos, public.movimentacoes_estoque TO service_role;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_atributos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "le produtos" ON public.produtos FOR SELECT TO authenticated USING (public.nivel_acesso_setor(auth.uid(),'estoque') <> 'sem_acesso');
CREATE POLICY "le prod_attr" ON public.produto_atributos FOR SELECT TO authenticated USING (public.nivel_acesso_setor(auth.uid(),'estoque') <> 'sem_acesso');
CREATE POLICY "le movs" ON public.movimentacoes_estoque FOR SELECT TO authenticated USING (public.nivel_acesso_setor(auth.uid(),'estoque') <> 'sem_acesso');

-- Proteção da quantidade
CREATE OR REPLACE FUNCTION public.proteger_quantidade()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.quantidade <> 0 AND COALESCE(current_setting('app.mov_estoque', true),'') <> 'on' THEN
      RAISE EXCEPTION 'Quantidade só pode ser alterada por movimentação';
    END IF;
  ELSIF NEW.quantidade IS DISTINCT FROM OLD.quantidade AND COALESCE(current_setting('app.mov_estoque', true),'') <> 'on' THEN
    RAISE EXCEPTION 'Quantidade só pode ser alterada por movimentação';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_proteger_quantidade BEFORE INSERT OR UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.proteger_quantidade();

CREATE OR REPLACE FUNCTION public.exigir_edicao_estoque()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.nivel_acesso_setor(auth.uid(),'estoque') <> 'edicao' THEN
    RAISE EXCEPTION 'Sem permissão para editar o estoque';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.movimentar_estoque(_produto uuid, _tipo public.tipo_movimentacao, _quantidade numeric, _observacao text DEFAULT NULL)
RETURNS public.movimentacoes_estoque LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.produtos; novo numeric; m public.movimentacoes_estoque;
BEGIN
  PERFORM public.exigir_edicao_estoque();
  IF _quantidade IS NULL OR _quantidade <= 0 THEN RAISE EXCEPTION 'A quantidade deve ser maior que zero'; END IF;
  SELECT * INTO p FROM public.produtos WHERE id = _produto FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  IF _tipo IN ('entrada','ajuste_positivo') THEN novo := p.quantidade + _quantidade;
  ELSE novo := p.quantidade - _quantidade; END IF;
  IF novo < 0 THEN RAISE EXCEPTION 'Quantidade superior ao estoque disponível (%)', p.quantidade; END IF;
  PERFORM set_config('app.mov_estoque','on',true);
  UPDATE public.produtos SET quantidade = novo, updated_by = auth.uid() WHERE id = _produto;
  PERFORM set_config('app.mov_estoque','off',true);
  INSERT INTO public.movimentacoes_estoque (produto_id,tipo,quantidade,saldo_anterior,saldo_posterior,usuario_id,observacao)
  VALUES (_produto,_tipo,_quantidade,p.quantidade,novo,auth.uid(),NULLIF(trim(_observacao),''))
  RETURNING * INTO m;
  RETURN m;
END $$;

CREATE OR REPLACE FUNCTION public.salvar_atributos(_produto uuid, _categoria uuid, _atributos jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v text;
BEGIN
  DELETE FROM public.produto_atributos WHERE produto_id = _produto;
  FOR a IN SELECT * FROM public.categoria_atributos WHERE categoria_id = _categoria LOOP
    v := NULLIF(trim(COALESCE(_atributos->>a.atributo,'')),'');
    IF v IS NULL AND a.obrigatorio THEN RAISE EXCEPTION '% é obrigatório', a.rotulo; END IF;
    IF v IS NOT NULL THEN INSERT INTO public.produto_atributos VALUES (_produto, a.atributo, v); END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.criar_produto(_dados jsonb, _atributos jsonb, _quantidade_inicial numeric DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE novo_id uuid;
BEGIN
  PERFORM public.exigir_edicao_estoque();
  IF _quantidade_inicial < 0 THEN RAISE EXCEPTION 'Quantidade não pode ser negativa'; END IF;
  INSERT INTO public.produtos (categoria_id,nome,tipo,cor,descricao,preco,estoque_min,estoque_max,status,created_by,updated_by)
  VALUES ((_dados->>'categoria_id')::uuid, trim(_dados->>'nome'), trim(_dados->>'tipo'), trim(_dados->>'cor'), NULLIF(trim(_dados->>'descricao'),''),
    COALESCE((_dados->>'preco')::numeric,0), (_dados->>'estoque_min')::numeric, (_dados->>'estoque_max')::numeric,
    COALESCE((_dados->>'status')::public.status_produto,'ativo'), auth.uid(), auth.uid())
  RETURNING id INTO novo_id;
  PERFORM public.salvar_atributos(novo_id, (_dados->>'categoria_id')::uuid, _atributos);
  IF COALESCE(_quantidade_inicial,0) > 0 THEN
    PERFORM public.movimentar_estoque(novo_id, 'entrada', _quantidade_inicial, 'Estoque inicial no cadastro');
  END IF;
  RETURN novo_id;
END $$;

CREATE OR REPLACE FUNCTION public.atualizar_produto(_id uuid, _dados jsonb, _atributos jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.exigir_edicao_estoque();
  UPDATE public.produtos SET
    categoria_id = (_dados->>'categoria_id')::uuid, nome = trim(_dados->>'nome'), tipo = trim(_dados->>'tipo'), cor = trim(_dados->>'cor'),
    descricao = NULLIF(trim(_dados->>'descricao'),''), preco = COALESCE((_dados->>'preco')::numeric,0),
    estoque_min = (_dados->>'estoque_min')::numeric, estoque_max = (_dados->>'estoque_max')::numeric,
    status = COALESCE((_dados->>'status')::public.status_produto, status), updated_by = auth.uid()
  WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  PERFORM public.salvar_atributos(_id, (_dados->>'categoria_id')::uuid, _atributos);
END $$;

CREATE OR REPLACE FUNCTION public.alterar_status_produto(_id uuid, _status public.status_produto)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.exigir_edicao_estoque();
  UPDATE public.produtos SET status = _status, updated_by = auth.uid() WHERE id = _id;
END $$;

REVOKE EXECUTE ON FUNCTION public.salvar_atributos(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.movimentar_estoque(uuid,public.tipo_movimentacao,numeric,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.criar_produto(jsonb,jsonb,numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.atualizar_produto(uuid,jsonb,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.alterar_status_produto(uuid,public.status_produto) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.movimentar_estoque(uuid,public.tipo_movimentacao,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_produto(jsonb,jsonb,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_produto(uuid,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alterar_status_produto(uuid,public.status_produto) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nivel_acesso_setor(uuid,text) TO authenticated;
