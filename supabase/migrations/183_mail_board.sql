-- 183_mail_board.sql
-- Tablica spraw w Poczcie dostawców: ręczna kolumna (do zrobienia / w trakcie / czekam / do zapłaty /
-- zakończone), opis, na kogo czekam i do kiedy, kto obsługuje. Bez wiersza sprawa ma kolumnę z automatu.

CREATE TABLE IF NOT EXISTS public.mail_board_items (
  -- 'conv:<skrzynka>|<wątek Gmaila>' albo 'zd:<uuid>' / 'inquiry:<uuid>' (sprawa bez odpowiedzi).
  item_key text PRIMARY KEY,
  board_column text CHECK (board_column IN ('todo', 'doing', 'waiting', 'to_pay', 'done')),
  -- Od tej chwili liczy się „nowa wiadomość” (wraca do Do zrobienia) i odpowiedź (Czekam).
  column_set_at timestamptz,
  note text NOT NULL DEFAULT '',
  waiting_on text NOT NULL DEFAULT '',
  remind_on date,
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Adres, na który „Do zapłaty” przekazuje fakturę (np. księgowość) — zapamiętany per osoba.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_forward_email text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_board_items TO ontime_app;
  END IF;
END
$$;
