-- Empresas (preparado para multi-empresa; hoje uma só)
CREATE TABLE public.empresas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
INSERT INTO public.empresas (nome) VALUES ('Empresa principal');

CREATE OR REPLACE FUNCTION public.empresa_padrao() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.empresas ORDER BY created_at LIMIT 1 $$;

ALTER TABLE public.profiles ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) DEFAULT public.empresa_padrao();
ALTER TABLE public.profiles ADD COLUMN ativo boolean NOT NULL DEFAULT true;
UPDATE public.profiles SET empresa_id = public.empresa_padrao() WHERE empresa_id IS NULL;

CREATE OR REPLACE FUNCTION public.minha_empresa() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid() $$;

CREATE POLICY "le propria empresa" ON public.empresas FOR SELECT TO authenticated USING (id = public.minha_empresa());

-- Cargos: tipo interno separado de nome/cor
CREATE TYPE public.tipo_cargo AS ENUM ('vendedor','administrativo','financeiro','outro');
ALTER TABLE public.cargos ADD COLUMN tipo public.tipo_cargo NOT NULL DEFAULT 'outro';
ALTER TABLE public.cargos ADD COLUMN cor text NOT NULL DEFAULT '#64748b';
ALTER TABLE public.cargos ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) DEFAULT public.empresa_padrao();
UPDATE public.cargos SET empresa_id = public.empresa_padrao() WHERE empresa_id IS NULL;
INSERT INTO public.cargos (nome, tipo, cor) VALUES ('Vendedor','vendedor','#2563eb'),('Administrativo','administrativo','#d99a1e'),('Financeiro','financeiro','#2f8f5b');

DROP POLICY "auth le cargos" ON public.cargos;
CREATE POLICY "le cargos da empresa" ON public.cargos FOR SELECT TO authenticated USING (empresa_id = public.minha_empresa());
DROP POLICY "auth le perfis" ON public.profiles;
CREATE POLICY "le perfis da empresa" ON public.profiles FOR SELECT TO authenticated USING (empresa_id = public.minha_empresa() OR id = auth.uid());

-- Setores reais
INSERT INTO public.setores (codigo, nome) VALUES ('vendas','Vendas'),('pedidos','Pedidos'),('administracao','Administração') ON CONFLICT DO NOTHING;

-- Vendas/Pedidos continuam liberados por padrão (comportamento atual), salvo restrição explícita
CREATE OR REPLACE FUNCTION public.nivel_acesso_setor(_user uuid, _setor text)
RETURNS public.nivel_acesso LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p.tipo_conta = 'empresarial' THEN 'edicao'::public.nivel_acesso
    WHEN NOT p.ativo THEN 'sem_acesso'::public.nivel_acesso
    ELSE COALESCE(
      (SELECT nivel FROM public.usuario_permissoes WHERE user_id = _user AND setor = _setor),
      (SELECT nivel FROM public.cargo_permissoes WHERE cargo_id = p.cargo_id AND setor = _setor),
      CASE WHEN _setor IN ('vendas','pedidos') THEN 'edicao'::public.nivel_acesso ELSE 'sem_acesso'::public.nivel_acesso END)
  END
  FROM public.profiles p WHERE p.id = _user
$$;

CREATE OR REPLACE FUNCTION public.pode_administrar() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND COALESCE(public.nivel_acesso_setor(auth.uid(),'administracao') = 'edicao', false) $$;
CREATE OR REPLACE FUNCTION public.ve_administracao() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND COALESCE(public.nivel_acesso_setor(auth.uid(),'administracao') <> 'sem_acesso', false) $$;

-- Pedidos: leitura exige acesso a Vendas ou Pedidos
DROP POLICY "auth le pedidos" ON public.pedidos;
DROP POLICY "auth le pedido_itens" ON public.pedido_itens;
DROP POLICY "auth le pedido_historico" ON public.pedido_historico;
CREATE OR REPLACE FUNCTION public.ve_pedidos() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.nivel_acesso_setor(auth.uid(),'pedidos') <> 'sem_acesso' OR public.nivel_acesso_setor(auth.uid(),'vendas') <> 'sem_acesso' $$;
CREATE POLICY "le pedidos" ON public.pedidos FOR SELECT TO authenticated USING (public.ve_pedidos());
CREATE POLICY "le pedido_itens" ON public.pedido_itens FOR SELECT TO authenticated USING (public.ve_pedidos());
CREATE POLICY "le pedido_historico" ON public.pedido_historico FOR SELECT TO authenticated USING (public.ve_pedidos());

-- Escrita em pedidos protegida por gatilhos (sem reescrever as funções existentes)
CREATE OR REPLACE FUNCTION public._guarda_pedidos() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_TABLE_NAME = 'pedidos' AND TG_OP = 'INSERT' THEN
    IF public.nivel_acesso_setor(auth.uid(),'vendas') <> 'edicao' THEN RAISE EXCEPTION 'Sem permissão para registrar vendas'; END IF;
  ELSIF TG_TABLE_NAME = 'pedidos' THEN
    IF OLD.created_at <> now() AND public.nivel_acesso_setor(auth.uid(),'pedidos') <> 'edicao' THEN RAISE EXCEPTION 'Sem permissão para editar pedidos'; END IF;
  ELSE
    IF public.nivel_acesso_setor(auth.uid(),'pedidos') <> 'edicao' AND public.nivel_acesso_setor(auth.uid(),'vendas') <> 'edicao' THEN
      RAISE EXCEPTION 'Sem permissão para editar pedidos'; END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_guarda_pedidos BEFORE INSERT OR UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public._guarda_pedidos();
CREATE TRIGGER trg_guarda_pedido_itens BEFORE INSERT OR UPDATE OR DELETE ON public.pedido_itens FOR EACH ROW EXECUTE FUNCTION public._guarda_pedidos();

-- Dados sensíveis do funcionário (só administração e o próprio)
CREATE TABLE public.funcionario_dados (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  salario numeric CHECK (salario IS NULL OR salario >= 0),
  comissao_percentual numeric CHECK (comissao_percentual IS NULL OR (comissao_percentual >= 0 AND comissao_percentual <= 100)),
  descricao text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.funcionario_dados TO authenticated;
GRANT ALL ON public.funcionario_dados TO service_role;
ALTER TABLE public.funcionario_dados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "le dados func" ON public.funcionario_dados FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR (public.ve_administracao() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.empresa_id = public.minha_empresa())));

CREATE TABLE public.funcionario_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.profiles(id),
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT ON public.funcionario_historico TO authenticated;
GRANT ALL ON public.funcionario_historico TO service_role;
ALTER TABLE public.funcionario_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "le hist func" ON public.funcionario_historico FOR SELECT TO authenticated USING (
  public.ve_administracao() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = funcionario_id AND p.empresa_id = public.minha_empresa()));

-- Permissões individuais: admins da empresa podem ler as dos funcionários
CREATE POLICY "admin le perms" ON public.usuario_permissoes FOR SELECT TO authenticated USING (
  public.ve_administracao() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.empresa_id = public.minha_empresa()));

CREATE OR REPLACE FUNCTION public._exigir_admin() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NOT public.pode_administrar() THEN RAISE EXCEPTION 'Sem permissão para administrar funcionários'; END IF; END $$;

CREATE OR REPLACE FUNCTION public._fhist(_f uuid, _campo text, _ant text, _novo text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.funcionario_historico (funcionario_id, usuario_id, campo, valor_anterior, valor_novo)
  SELECT _f, auth.uid(), _campo, _ant, _novo WHERE _ant IS DISTINCT FROM _novo $$;

CREATE OR REPLACE FUNCTION public.salvar_cargo(_id uuid, _nome text, _cor text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.cargos; novo uuid;
BEGIN
  PERFORM public._exigir_admin();
  IF _nome IS NULL OR length(trim(_nome)) = 0 THEN RAISE EXCEPTION 'Informe o nome do cargo'; END IF;
  IF _cor !~ '^#[0-9a-fA-F]{6}$' THEN RAISE EXCEPTION 'Cor inválida'; END IF;
  IF _id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.cargos WHERE empresa_id = public.minha_empresa() AND lower(nome) = lower(trim(_nome))) THEN RAISE EXCEPTION 'Já existe um cargo com esse nome'; END IF;
    INSERT INTO public.cargos (nome, cor, tipo, empresa_id) VALUES (trim(_nome), _cor, 'outro', public.minha_empresa()) RETURNING id INTO novo;
    RETURN novo;
  END IF;
  SELECT * INTO c FROM public.cargos WHERE id = _id AND empresa_id = public.minha_empresa() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cargo não encontrado'; END IF;
  IF EXISTS (SELECT 1 FROM public.cargos WHERE empresa_id = c.empresa_id AND id <> _id AND lower(nome) = lower(trim(_nome))) THEN RAISE EXCEPTION 'Já existe um cargo com esse nome'; END IF;
  UPDATE public.cargos SET nome = trim(_nome), cor = _cor WHERE id = _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.atualizar_funcionario(_id uuid, _dados jsonb, _novo boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles; d public.funcionario_dados; c_ant text; c_novo text; v_cargo uuid; v_tipo public.tipo_cargo;
  v_sal numeric; v_com numeric; v_desc text; v_nome text;
BEGIN
  PERFORM public._exigir_admin();
  SELECT * INTO p FROM public.profiles WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR p.empresa_id IS DISTINCT FROM public.minha_empresa() THEN RAISE EXCEPTION 'Funcionário não encontrado'; END IF;
  v_nome := trim(COALESCE(_dados->>'nome', p.nome));
  IF length(v_nome) = 0 THEN RAISE EXCEPTION 'Informe o nome'; END IF;
  v_cargo := NULLIF(_dados->>'cargo_id','')::uuid;
  IF v_cargo IS NULL THEN RAISE EXCEPTION 'Selecione o cargo'; END IF;
  SELECT tipo INTO v_tipo FROM public.cargos WHERE id = v_cargo AND empresa_id = p.empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cargo inválido'; END IF;
  v_sal := NULLIF(_dados->>'salario','')::numeric;
  v_com := CASE WHEN v_tipo = 'vendedor' THEN NULLIF(_dados->>'comissao_percentual','')::numeric ELSE NULL END;
  v_desc := NULLIF(trim(COALESCE(_dados->>'descricao','')),'');
  SELECT * INTO d FROM public.funcionario_dados WHERE user_id = _id;
  SELECT nome INTO c_ant FROM public.cargos WHERE id = p.cargo_id;
  SELECT nome INTO c_novo FROM public.cargos WHERE id = v_cargo;
  IF _novo THEN
    PERFORM public._fhist(_id, 'Cadastro', NULL, 'Funcionário convidado por e-mail');
  ELSE
    PERFORM public._fhist(_id, 'Nome', p.nome, v_nome);
    PERFORM public._fhist(_id, 'Cargo', c_ant, c_novo);
    PERFORM public._fhist(_id, 'Salário', public._n(d.salario), public._n(v_sal));
    PERFORM public._fhist(_id, 'Comissão (%)', public._n(d.comissao_percentual), public._n(v_com));
    PERFORM public._fhist(_id, 'Descrição', d.descricao, v_desc);
  END IF;
  UPDATE public.profiles SET nome = v_nome, cargo_id = v_cargo WHERE id = _id;
  INSERT INTO public.funcionario_dados (user_id, salario, comissao_percentual, descricao, created_by)
  VALUES (_id, v_sal, v_com, v_desc, auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET salario = EXCLUDED.salario, comissao_percentual = EXCLUDED.comissao_percentual, descricao = EXCLUDED.descricao, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.definir_permissoes_funcionario(_id uuid, _perms jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; v text; ant text;
BEGIN
  PERFORM public._exigir_admin();
  IF _id = auth.uid() THEN RAISE EXCEPTION 'Você não pode alterar as próprias permissões'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _id AND empresa_id = public.minha_empresa()) THEN RAISE EXCEPTION 'Funcionário não encontrado'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _id AND tipo_conta = 'empresarial') THEN RAISE EXCEPTION 'Contas empresariais já têm acesso total'; END IF;
  FOR k, v IN SELECT * FROM jsonb_each_text(_perms) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.setores WHERE codigo = k) THEN RAISE EXCEPTION 'Página inválida: %', k; END IF;
    ant := public.nivel_acesso_setor(_id, k)::text;
    INSERT INTO public.usuario_permissoes (user_id, setor, nivel) VALUES (_id, k, v::public.nivel_acesso)
    ON CONFLICT (user_id, setor) DO UPDATE SET nivel = EXCLUDED.nivel;
    PERFORM public._fhist(_id, 'Permissão: ' || (SELECT nome FROM public.setores WHERE codigo = k), ant, v);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.desempenho_vendedor(_id uuid, _inicio date, _fim date)
RETURNS TABLE(pedido_id uuid, concluido_em timestamptz, preco_venda numeric) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.ve_administracao() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _id AND empresa_id = public.minha_empresa()) THEN RAISE EXCEPTION 'Funcionário não encontrado'; END IF;
  RETURN QUERY
  SELECT p.id, h.quando, p.preco_venda FROM public.pedidos p
  JOIN LATERAL (SELECT max(created_at) AS quando FROM public.pedido_historico WHERE pedido_id = p.id AND campo = 'Status' AND valor_novo = 'concluido') h ON true
  WHERE p.vendedor_id = _id AND p.status = 'concluido' AND h.quando IS NOT NULL
    AND h.quando >= _inicio AND h.quando < (_fim + 1);
END $$;