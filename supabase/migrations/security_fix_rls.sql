-- 1. تفعيل الـ RLS على الجداول الرئيسية
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;

-- 2. قواعد جدول البروفايل (كل واحد يشوف بروفايله بس)
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 3. قواعد جدول المنتجات (المنتجات المربوطة باليوزر)
-- ملاحظة: لو مفيش user_id في الجدول ده لازم نضيفه
CREATE POLICY "Users can manage their own products" 
ON public.products FOR ALL 
USING (auth.uid() = user_id);

-- 4. قواعد المكتبة (أهم جزء)
CREATE POLICY "Users can manage their own library items" 
ON public.library_items FOR ALL 
USING (auth.uid() = user_id);

-- 5. منع الوصول العام لأي جدول مش متفعل عليه Policy
-- (Supabase باي ديفولت بيمنع لو الـ RLS شغال ومفيش Policy)
