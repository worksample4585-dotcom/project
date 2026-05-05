-- Add land_name to deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS land_name text;

-- Update deal number generator to use NLA- prefix
CREATE OR REPLACE FUNCTION public.generate_deal_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  yr TEXT := to_char(now(), 'YYYY');
  next_num INT;
BEGIN
  IF NEW.deal_number IS NULL OR NEW.deal_number = '' THEN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(deal_number, '-', 3) AS INT)), 0) + 1
      INTO next_num FROM public.deals
      WHERE deal_number LIKE 'NLA-' || yr || '-%';
    NEW.deal_number := 'NLA-' || yr || '-' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END; $function$;

-- Ensure the trigger exists on deals (recreate safely)
DROP TRIGGER IF EXISTS trg_generate_deal_number ON public.deals;
CREATE TRIGGER trg_generate_deal_number
BEFORE INSERT ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.generate_deal_number();