-- =====================================================
-- DIAGNÓSTICO E CORREÇÃO DE ROLE
-- Execute no Supabase SQL Editor
-- =====================================================

-- 1. Verificar se o perfil existe
SELECT 
    up.id,
    up.email,
    up.name,
    up.role,
    up.is_active,
    au.email as auth_email
FROM public.user_profiles up
RIGHT JOIN auth.users au ON up.id = au.id
WHERE au.email = 'ericson.cardoso10@gmail.com';

-- 2. Se o perfil NÃO existe, criar:
INSERT INTO public.user_profiles (id, email, name, role, is_active)
SELECT 
    id, 
    email, 
    'Ericson Cardoso', 
    'master',
    true
FROM auth.users 
WHERE email = 'ericson.cardoso10@gmail.com'
ON CONFLICT (id) DO UPDATE SET 
    role = 'master',
    name = 'Ericson Cardoso';

-- 3. Verificar novamente
SELECT * FROM public.user_profiles 
WHERE email = 'ericson.cardoso10@gmail.com';

-- 4. Adicionar política RLS para permitir leitura do próprio perfil
-- (isso já foi criado, mas vamos garantir)
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

-- 5. Verificar políticas existentes
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';
