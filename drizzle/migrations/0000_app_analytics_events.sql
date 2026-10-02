CREATE TABLE public.app_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL CHECK (char_length(session_id) BETWEEN 8 AND 64),
  user_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('page_view','search')),
  path text NOT NULL CHECK (char_length(path) <= 300),
  search_term text CHECK (search_term IS NULL OR char_length(search_term) <= 120),
  search_context text CHECK (search_context IS NULL OR char_length(search_context) <= 40),
  device text CHECK (device IS NULL OR device IN ('mobile','tablet','desktop')),
  referrer text CHECK (referrer IS NULL OR char_length(referrer) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_events_created_idx ON public.app_events (created_at DESC);
CREATE INDEX app_events_type_created_idx ON public.app_events (event_type, created_at DESC);

GRANT INSERT ON public.app_events TO anon;
GRANT SELECT, INSERT ON public.app_events TO authenticated;
GRANT ALL ON public.app_events TO service_role;

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log anonymous events" ON public.app_events
  FOR INSERT TO anon WITH CHECK (user_id IS NULL);
CREATE POLICY "Users log own events" ON public.app_events
  FOR INSERT TO authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Admins read events" ON public.app_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));