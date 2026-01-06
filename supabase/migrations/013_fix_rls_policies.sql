-- =====================================================
-- CORRIGIR RLS - Permitir usuários lerem próprio perfil
-- Execute AGORA no Supabase SQL Editor
-- =====================================================

-- Remover e recriar políticas de forma mais simples
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Platform admins can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON public.user_profiles;

-- Política simples: usuários podem ler seu próprio perfil
CREATE POLICY "Users can read own profile" ON public.user_profiles
    FOR SELECT 
    TO authenticated
    USING (auth.uid() = id);

-- Plataforma admins podem ler todos
CREATE POLICY "Platform admins read all" ON public.user_profiles
    FOR SELECT 
    TO authenticated
    USING (
        (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('master', 'admin', 'operator')
    );

-- Usuários podem atualizar próprio perfil
CREATE POLICY "Users update own" ON public.user_profiles
    FOR UPDATE 
    TO authenticated
    USING (auth.uid() = id);

-- Inserção livre para trigger funcionar
CREATE POLICY "Allow inserts" ON public.user_profiles
    FOR INSERT 
    TO authenticated
    WITH CHECK (true);

-- Verificar políticas criadas
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'user_profiles';
