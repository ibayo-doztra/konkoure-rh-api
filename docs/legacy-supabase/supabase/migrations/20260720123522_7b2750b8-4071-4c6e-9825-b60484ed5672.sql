
-- 1) Employees: revoke table-level INSERT/UPDATE grants and re-grant only on non-sensitive columns.
REVOKE INSERT, UPDATE ON public.employees FROM authenticated;

GRANT INSERT (organization_id, user_id, first_name, last_name, email, phone, photo_url,
              job_title, department_id, manager_id, hire_date, status)
  ON public.employees TO authenticated;

GRANT UPDATE (first_name, last_name, email, phone, photo_url,
              job_title, department_id, manager_id, hire_date, status)
  ON public.employees TO authenticated;

-- Sensitive columns (base_salary, profile_details, nfc_badge_uid, nfc_badge_active,
-- nfc_badge_assigned_at) are only writable via SECURITY DEFINER RPCs / service_role.

-- 2) candidate_activities: revoke all direct anon privileges.
REVOKE ALL ON public.candidate_activities FROM anon;

-- 3) social_accounts: strip write privileges from authenticated (admins go through RPC / service_role).
REVOKE INSERT, UPDATE, DELETE ON public.social_accounts FROM authenticated;

-- 4) Storage: drop the legacy org-root delete policy on employee-docs.
DROP POLICY IF EXISTS "Docs: admins delete" ON storage.objects;
