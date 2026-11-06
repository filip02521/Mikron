-- Rola „serwis”: serwisant z własnym panelem (/serwis). Konto jest powiązane z kartą
-- handlowca w grupie Serwis (profiles.sales_person_id), bo prośby o części składa jak handlowiec.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'serwis';
