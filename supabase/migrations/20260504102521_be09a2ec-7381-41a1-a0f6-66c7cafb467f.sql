
-- =========== ENUMS ===========
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'client');
CREATE TYPE public.deal_type AS ENUM ('purchase', 'sale');
CREATE TYPE public.deal_status AS ENUM ('active', 'pending', 'closed', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending', 'partial', 'paid', 'overdue');
CREATE TYPE public.party_role AS ENUM ('buyer', 'seller', 'agent', 'witness', 'other');

-- =========== UPDATED_AT TRIGGER FN ===========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========== PROFILES ===========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role public.app_role NOT NULL DEFAULT 'client',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========== ROLE HELPER (SECURITY DEFINER) ===========
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role AND is_active = true)
$$;

CREATE OR REPLACE FUNCTION public.get_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;

-- =========== HANDLE NEW USER ===========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'client'::public.app_role)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles policies
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========== DEALS ===========
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  deal_type public.deal_type NOT NULL,
  status public.deal_status NOT NULL DEFAULT 'active',
  deal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto deal number
CREATE OR REPLACE FUNCTION public.generate_deal_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  yr TEXT := to_char(now(), 'YYYY');
  next_num INT;
BEGIN
  IF NEW.deal_number IS NULL OR NEW.deal_number = '' THEN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(deal_number, '-', 3) AS INT)), 0) + 1
      INTO next_num FROM public.deals
      WHERE deal_number LIKE 'DEAL-' || yr || '-%';
    NEW.deal_number := 'DEAL-' || yr || '-' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_deals_number BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.generate_deal_number();

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deals_admin_editor_all" ON public.deals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "deals_client_select_own" ON public.deals FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- =========== AREAS ===========
CREATE TABLE public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  total_area_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_area_unit TEXT NOT NULL DEFAULT 'Acre',
  location_name TEXT,
  latitude NUMERIC(10,6),
  longitude NUMERIC(10,6),
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas_admin_editor_all" ON public.areas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "areas_client_select" ON public.areas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = areas.deal_id AND d.client_id = auth.uid()));

-- =========== BLOCKS ===========
CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  block_number TEXT NOT NULL,
  area_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  area_unit TEXT NOT NULL DEFAULT 'Acre',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_admin_editor_all" ON public.blocks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "blocks_client_select" ON public.blocks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = blocks.deal_id AND d.client_id = auth.uid()));

-- =========== PARTIES ===========
CREATE TABLE public.parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role public.party_role NOT NULL DEFAULT 'other',
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties_admin_editor_all" ON public.parties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "parties_client_select" ON public.parties FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = parties.deal_id AND d.client_id = auth.uid()));

-- =========== PAYMENTS ===========
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_due_date DATE,
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_admin_editor_all" ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "payments_client_select" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = payments.deal_id AND d.client_id = auth.uid()));

-- =========== PAYMENT TRANSACTIONS ===========
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  paid_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  remarks TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ptx_admin_editor_all" ON public.payment_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "ptx_client_select" ON public.payment_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = payment_transactions.deal_id AND d.client_id = auth.uid()));

-- =========== DOCUMENTS ===========
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_admin_editor_all" ON public.documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "documents_client_select" ON public.documents FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.deals d WHERE d.id = documents.deal_id AND d.client_id = auth.uid())
  );

-- =========== REMINDERS ===========
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  remind_on DATE NOT NULL,
  is_sent BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders_admin_editor_all" ON public.reminders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "reminders_client_select" ON public.reminders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = reminders.deal_id AND d.client_id = auth.uid()));

-- =========== AUDIT LOGS ===========
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_select" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit_authenticated_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- =========== STORAGE ===========
INSERT INTO storage.buckets (id, name, public) VALUES ('deal-documents', 'deal-documents', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "deal_docs_admin_editor_all" ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'deal-documents'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  )
  WITH CHECK (
    bucket_id = 'deal-documents'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  );

CREATE POLICY "deal_docs_client_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'deal-documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_path = storage.objects.name
        AND (d.client_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.deals dl WHERE dl.id = d.deal_id AND dl.client_id = auth.uid()))
    )
  );

-- =========== INDEXES ===========
CREATE INDEX idx_deals_client ON public.deals(client_id);
CREATE INDEX idx_deals_status ON public.deals(status);
CREATE INDEX idx_areas_deal ON public.areas(deal_id);
CREATE INDEX idx_blocks_deal ON public.blocks(deal_id);
CREATE INDEX idx_parties_deal ON public.parties(deal_id);
CREATE INDEX idx_payments_deal ON public.payments(deal_id);
CREATE INDEX idx_ptx_deal ON public.payment_transactions(deal_id);
CREATE INDEX idx_documents_deal ON public.documents(deal_id);
CREATE INDEX idx_documents_client ON public.documents(client_id);
CREATE INDEX idx_reminders_deal ON public.reminders(deal_id);
