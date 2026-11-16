
CREATE OR REPLACE FUNCTION public.record_punch(
  p_org uuid,
  p_employee uuid,
  p_lat double precision,
  p_lng double precision,
  p_source text,
  p_dedupe_seconds int DEFAULT 7
) RETURNS TABLE(type public.punch_type, ts timestamptz, deduped boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_last_type public.punch_type;
  v_last_ts   timestamptz;
  v_next_type public.punch_type;
  v_now       timestamptz := now();
BEGIN
  PERFORM 1 FROM public.employees WHERE id = p_employee FOR UPDATE;

  SELECT tl.type, tl."timestamp"
    INTO v_last_type, v_last_ts
    FROM public.time_logs tl
   WHERE tl.employee_id = p_employee
   ORDER BY tl."timestamp" DESC
   LIMIT 1;

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
