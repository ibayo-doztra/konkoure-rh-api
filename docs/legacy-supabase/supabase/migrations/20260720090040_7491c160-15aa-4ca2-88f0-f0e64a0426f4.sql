
-- 1) employees_sensitive_read: restrict sensitive column access via column privileges + tightened UPDATE policy

-- Tighten UPDATE: only org admins or the employee themselves may update any row
DROP POLICY IF EXISTS "employees: members update" ON public.employees;
CREATE POLICY "employees: admin or self update"
ON public.employees
FOR UPDATE
TO authenticated
USING (
  private.is_org_admin(auth.uid(), organization_id)
  OR user_id = auth.uid()
)
WITH CHECK (
  private.is_org_admin(auth.uid(), organization_id)
  OR user_id = auth.uid()
);

-- Column privileges: hide base_salary + profile_details from authenticated at read/update time.
-- We revoke the table-level SELECT/UPDATE and re-grant them on the non-sensitive columns only.
REVOKE SELECT, UPDATE ON public.employees FROM authenticated;
GRANT SELECT (
  id, organization_id, user_id, first_name, last_name, email, phone, photo_url,
  job_title, department_id, manager_id, hire_date, status, created_at, position,
  updated_at, nfc_badge_uid, nfc_badge_active, nfc_badge_assigned_at
) ON public.employees TO authenticated;
GRANT UPDATE (
  first_name, last_name, email, phone, photo_url, job_title, department_id,
  manager_id, hire_date, status, position, updated_at
) ON public.employees TO authenticated;

-- SECURITY DEFINER RPCs so admins/self can still read + update the sensitive fields
CREATE OR REPLACE FUNCTION public.get_employee_sensitive(p_employee uuid)
RETURNS TABLE (base_salary numeric, profile_details jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user uuid;
BEGIN
  SELECT e.organization_id, e.user_id INTO v_org, v_user
  FROM public.employees e WHERE e.id = p_employee;
  IF v_org IS NULL THEN
    RETURN;
  END IF;
  IF NOT (private.is_org_admin(auth.uid(), v_org) OR v_user = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT e.base_salary, e.profile_details
  FROM public.employees e WHERE e.id = p_employee;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_employee_sensitive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_sensitive(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_employee_profile_details(p_employee uuid, p_details jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user uuid;
BEGIN
  SELECT e.organization_id, e.user_id INTO v_org, v_user
  FROM public.employees e WHERE e.id = p_employee;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Employé introuvable' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (private.is_org_admin(auth.uid(), v_org) OR v_user = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.employees
     SET profile_details = COALESCE(p_details, '{}'::jsonb)
   WHERE id = p_employee;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_employee_profile_details(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_employee_profile_details(uuid, jsonb) TO authenticated;

-- 2) social_tokens_rls: hide the raw OAuth metadata blob from PostgREST for authenticated
REVOKE SELECT ON public.social_accounts FROM authenticated;
GRANT SELECT (
  id, organization_id, provider, account_id, account_name,
  token_expires_at, scopes, status, connected_by, connected_at
) ON public.social_accounts TO authenticated;

-- 3) candidate_activities_anon_insert: explicitly scope INSERT policy to authenticated role
DROP POLICY IF EXISTS "candidate_activities: members insert notes" ON public.candidate_activities;
CREATE POLICY "candidate_activities: members insert notes"
ON public.candidate_activities
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_org_member(auth.uid(), organization_id)
  AND actor_id = auth.uid()
  AND type = ANY (ARRAY['note_added'::candidate_activity_type, 'note_deleted'::candidate_activity_type])
  AND EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_activities.candidate_id
      AND c.organization_id = candidate_activities.organization_id
  )
);

-- 4) employee_docs_legacy_org_paths: no files under legacy paths anymore, drop the policies
DROP POLICY IF EXISTS "Docs: org members read legacy org paths" ON storage.objects;
DROP POLICY IF EXISTS "Docs: org members insert legacy org paths" ON storage.objects;
DROP POLICY IF EXISTS "Docs: org admins update legacy org paths" ON storage.objects;
DROP POLICY IF EXISTS "Docs: org admins delete legacy org paths" ON storage.objects;
