DROP POLICY IF EXISTS "auth le cargo_perm" ON public.cargo_permissoes;
CREATE POLICY "le cargo_perm da empresa" ON public.cargo_permissoes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cargos c WHERE c.id = cargo_permissoes.cargo_id AND c.empresa_id = public.minha_empresa()));

DROP POLICY IF EXISTS "auth le cat_attr" ON public.categoria_atributos;
CREATE POLICY "membro le cat_attr" ON public.categoria_atributos FOR SELECT TO authenticated
USING (public.minha_empresa() IS NOT NULL);

DROP POLICY IF EXISTS "auth le setores" ON public.setores;
CREATE POLICY "membro le setores" ON public.setores FOR SELECT TO authenticated
USING (public.minha_empresa() IS NOT NULL);

DROP POLICY IF EXISTS "auth le categorias" ON public.categorias;
CREATE POLICY "membro le categorias" ON public.categorias FOR SELECT TO authenticated
USING (public.minha_empresa() IS NOT NULL);