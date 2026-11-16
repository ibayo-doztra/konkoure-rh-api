
-- ============================================================
-- 1) CONTRACTS — restrict to org admins (+ owning employee read)
-- ============================================================
DROP POLICY IF EXISTS "contracts: members read"   ON public.contracts;
DROP POLICY IF EXISTS "contracts: members write"  ON public.contracts;
DROP POLICY IF EXISTS "contracts: members update" ON public.contracts;

CREATE POLICY "contracts: admins read"
  ON public.contracts FOR SELECT
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "contracts: self read"
  ON public.contracts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = contracts.employee_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "contracts: admins write"
  ON public.contracts FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "contracts: admins update"
  ON public.contracts FOR UPDATE
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- ============================================================
-- 2) EMPLOYEES — column-level: hide base_salary from non-admins
-- ============================================================
-- Revoke any default broad SELECT and re-grant only the non-sensitive columns.
REVOKE SELECT ON public.employees FROM authenticated;
GRANT SELECT (
  id, organization_id, user_id, first_name, last_name, email, phone,
  photo_url, job_title, department_id, manager_id, hire_date, status,
  created_at, position, updated_at, profile_details
) ON public.employees TO authenticated;
-- service_role keeps full access via earlier grants; admins can still SELECT
-- base_salary via the admin client or via dedicated reports. App reads using
-- `select *` will fail for non-admins until updated; the dashboard payroll
-- query (contracts.salary) is already restricted in step 1.
GRANT SELECT (base_salary) ON public.employees TO service_role;

-- ============================================================
-- 3) SOCIAL_ACCOUNTS — column-level: hide OAuth tokens
-- ============================================================
REVOKE SELECT ON public.social_accounts FROM authenticated;
GRANT SELECT (
  id, organization_id, provider, account_id, account_name,
  token_expires_at, scopes, status, connected_by, connected_at, metadata
) ON public.social_accounts TO authenticated;
-- access_token + refresh_token are only readable by service_role
-- (the publishing server function uses the admin client).

-- ============================================================
-- 4) PERFORMANCE_REVIEWS — restrict to admin / employee / manager
-- ============================================================
DROP POLICY IF EXISTS "previews: members read"   ON public.performance_reviews;
DROP POLICY IF EXISTS "previews: members write"  ON public.performance_reviews;
DROP POLICY IF EXISTS "previews: members update" ON public.performance_reviews;

CREATE POLICY "previews: admin/manager/employee read"
  ON public.performance_reviews FOR SELECT
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = performance_reviews.employee_id AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.employees m
      WHERE m.id = performance_reviews.manager_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "previews: admins write"
  ON public.performance_reviews FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "previews: admin/manager/employee update"
  ON public.performance_reviews FOR UPDATE
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = performance_reviews.employee_id AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.employees m
      WHERE m.id = performance_reviews.manager_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = performance_reviews.employee_id AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.employees m
      WHERE m.id = performance_reviews.manager_id AND m.user_id = auth.uid()
    )
  );

-- ============================================================
-- 5) REVIEWS (legacy) — restrict to admin / employee
-- ============================================================
DROP POLICY IF EXISTS "reviews: members read"   ON public.reviews;
DROP POLICY IF EXISTS "reviews: members write"  ON public.reviews;
DROP POLICY IF EXISTS "reviews: members update" ON public.reviews;

CREATE POLICY "reviews: admin/employee read"
  ON public.reviews FOR SELECT
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = reviews.employee_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "reviews: admins write"
  ON public.reviews FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "reviews: admin/employee update"
  ON public.reviews FOR UPDATE
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = reviews.employee_id AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = reviews.employee_id AND e.user_id = auth.uid()
    )
  );

-- ============================================================
-- 6) REVIEW_GOAL_COMMENTS — same scope as parent review
-- ============================================================
DROP POLICY IF EXISTS "rgc: members read"   ON public.review_goal_comments;
DROP POLICY IF EXISTS "rgc: members write"  ON public.review_goal_comments;
DROP POLICY IF EXISTS "rgc: members update" ON public.review_goal_comments;

CREATE POLICY "rgc: scoped read"
  ON public.review_goal_comments FOR SELECT
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1
      FROM public.performance_reviews pr
      LEFT JOIN public.employees e ON e.id = pr.employee_id
      LEFT JOIN public.employees m ON m.id = pr.manager_id
      WHERE pr.id = review_goal_comments.review_id
        AND (e.user_id = auth.uid() OR m.user_id = auth.uid())
    )
  );

CREATE POLICY "rgc: scoped write"
  ON public.review_goal_comments FOR INSERT
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1
      FROM public.performance_reviews pr
      LEFT JOIN public.employees e ON e.id = pr.employee_id
      LEFT JOIN public.employees m ON m.id = pr.manager_id
      WHERE pr.id = review_goal_comments.review_id
        AND (e.user_id = auth.uid() OR m.user_id = auth.uid())
    )
  );

CREATE POLICY "rgc: scoped update"
  ON public.review_goal_comments FOR UPDATE
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1
      FROM public.performance_reviews pr
      LEFT JOIN public.employees e ON e.id = pr.employee_id
      LEFT JOIN public.employees m ON m.id = pr.manager_id
      WHERE pr.id = review_goal_comments.review_id
        AND (e.user_id = auth.uid() OR m.user_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1
      FROM public.performance_reviews pr
      LEFT JOIN public.employees e ON e.id = pr.employee_id
      LEFT JOIN public.employees m ON m.id = pr.manager_id
      WHERE pr.id = review_goal_comments.review_id
        AND (e.user_id = auth.uid() OR m.user_id = auth.uid())
    )
  );

-- ============================================================
-- 7) CANDIDATE_ACTIVITIES — add admin-only UPDATE policy
-- (no anon INSERT path exists; public application uses service role)
-- ============================================================
DROP POLICY IF EXISTS "candidate_activities: admins update" ON public.candidate_activities;
CREATE POLICY "candidate_activities: admins update"
  ON public.candidate_activities FOR UPDATE
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- ============================================================
-- 8) AVATARS bucket — explicit public SELECT policy
-- (avatars are intentionally public profile images)
-- ============================================================
DROP POLICY IF EXISTS "Avatars: public read" ON storage.objects;
CREATE POLICY "Avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- ============================================================
-- 9) SECURITY DEFINER functions — revoke EXECUTE from anon
-- (trigger-only functions; not callable by clients)
-- ============================================================
REVOKE ALL ON FUNCTION public.handle_new_user()  FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at()   FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at()  TO service_role;
