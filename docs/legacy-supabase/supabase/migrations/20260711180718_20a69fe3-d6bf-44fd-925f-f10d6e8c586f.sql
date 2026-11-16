
-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.punch_type AS ENUM ('ARRIVEE', 'DEPART');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Drop old policies then rebuild the table (empty in prod).
DROP POLICY IF EXISTS "time_logs: admins delete"  ON public.time_logs;
DROP POLICY IF EXISTS "time_logs: members read"   ON public.time_logs;
DROP POLICY IF EXISTS "time_logs: members update" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs: members write"  ON public.time_logs;

DROP TABLE IF EXISTS public.time_logs;

CREATE TABLE public.time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id     uuid NOT NULL REFERENCES public.employees(id)     ON DELETE CASCADE,
  type            public.punch_type NOT NULL,
  "timestamp"     timestamptz NOT NULL DEFAULT now(),
  latitude        double precision,
  longitude       double precision,
  source          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX time_logs_employee_ts_idx ON public.time_logs (employee_id, "timestamp" DESC);
CREATE INDEX time_logs_org_ts_idx      ON public.time_logs (organization_id, "timestamp" DESC);

-- Legacy enum no longer used
DROP TYPE IF EXISTS public.timelog_status;

-- 3. Grants (append-only from app POV: no UPDATE, no DELETE)
GRANT SELECT, INSERT ON public.time_logs TO authenticated;
GRANT ALL ON public.time_logs TO service_role;

-- 4. RLS
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_logs: members read"
  ON public.time_logs FOR SELECT
  USING (private.is_org_member(auth.uid(), organization_id));

CREATE POLICY "time_logs: staff insert"
  ON public.time_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = time_logs.organization_id
        AND ur.role IN ('owner','hr_admin','security_agent')
    )
  );
-- No UPDATE, no DELETE policies → immutable via the app.

-- 5. record_punch(): atomic decision + insert with dedupe window
CREATE OR REPLACE FUNCTION public.record_punch(
  p_org uuid,
  p_employee uuid,
  p_lat double precision,
  p_lng double precision,
  p_source text,
  p_dedupe_seconds int DEFAULT 7
) RETURNS TABLE(type public.punch_type, ts timestamptz, deduped boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_type public.punch_type;
  v_last_ts   timestamptz;
  v_next_type public.punch_type;
  v_now       timestamptz := now();
BEGIN
  -- Row-level lock on the employee to serialize concurrent scans
  PERFORM 1 FROM public.employees WHERE id = p_employee FOR UPDATE;

  SELECT tl.type, tl."timestamp"
    INTO v_last_type, v_last_ts
    FROM public.time_logs tl
   WHERE tl.employee_id = p_employee
   ORDER BY tl."timestamp" DESC
   LIMIT 1;

  -- Dedup: ignore rapid re-scans, return the previous punch as-is
  IF v_last_ts IS NOT NULL
     AND v_now - v_last_ts < make_interval(secs => p_dedupe_seconds) THEN
    RETURN QUERY SELECT v_last_type, v_last_ts, true;
    RETURN;
  END IF;

  v_next_type := CASE
    WHEN v_last_type = 'ARRIVEE'::public.punch_type THEN 'DEPART'::public.punch_type
    ELSE 'ARRIVEE'::public.punch_type
  END;

  INSERT INTO public.time_logs(
    organization_id, employee_id, type, "timestamp", latitude, longitude, source
  ) VALUES (
    p_org, p_employee, v_next_type, v_now, p_lat, p_lng, p_source
  );

  RETURN QUERY SELECT v_next_type, v_now, false;
END;
$$;

REVOKE ALL ON FUNCTION public.record_punch(uuid,uuid,double precision,double precision,text,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_punch(uuid,uuid,double precision,double precision,text,int) TO authenticated, service_role;
