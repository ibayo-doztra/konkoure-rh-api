
-- achievements
DROP POLICY IF EXISTS "achievements: members write" ON public.achievements;
DROP POLICY IF EXISTS "achievements: members update" ON public.achievements;
CREATE POLICY "achievements: owner or manager write" ON public.achievements
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), employee_id)
      OR private.is_employee_manager(auth.uid(), employee_id)
    )
  );
CREATE POLICY "achievements: owner or manager update" ON public.achievements
  FOR UPDATE TO authenticated
  USING (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), employee_id)
      OR private.is_employee_manager(auth.uid(), employee_id)
    )
  )
  WITH CHECK (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), employee_id)
      OR private.is_employee_manager(auth.uid(), employee_id)
    )
  );

-- employee_skills
DROP POLICY IF EXISTS "employee_skills: members write" ON public.employee_skills;
DROP POLICY IF EXISTS "employee_skills: members update" ON public.employee_skills;
CREATE POLICY "employee_skills: owner or manager write" ON public.employee_skills
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), employee_id)
      OR private.is_employee_manager(auth.uid(), employee_id)
    )
  );
CREATE POLICY "employee_skills: owner or manager update" ON public.employee_skills
  FOR UPDATE TO authenticated
  USING (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), employee_id)
      OR private.is_employee_manager(auth.uid(), employee_id)
    )
  )
  WITH CHECK (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), employee_id)
      OR private.is_employee_manager(auth.uid(), employee_id)
    )
  );

-- goal_activities
DROP POLICY IF EXISTS "goal_activities: members write" ON public.goal_activities;
DROP POLICY IF EXISTS "goal_activities: members update" ON public.goal_activities;
CREATE POLICY "goal_activities: owner or manager write" ON public.goal_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), employee_id)
      OR private.is_employee_manager(auth.uid(), employee_id)
    )
  );
CREATE POLICY "goal_activities: owner or manager update" ON public.goal_activities
  FOR UPDATE TO authenticated
  USING (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), employee_id)
      OR private.is_employee_manager(auth.uid(), employee_id)
    )
  )
  WITH CHECK (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), employee_id)
      OR private.is_employee_manager(auth.uid(), employee_id)
    )
  );

-- okrs
DROP POLICY IF EXISTS "okrs: members write" ON public.okrs;
DROP POLICY IF EXISTS "okrs: members update" ON public.okrs;
CREATE POLICY "okrs: owner or manager write" ON public.okrs
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), employee_id)
      OR private.is_employee_manager(auth.uid(), employee_id)
    )
  );
CREATE POLICY "okrs: owner or manager update" ON public.okrs
  FOR UPDATE TO authenticated
  USING (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), employee_id)
      OR private.is_employee_manager(auth.uid(), employee_id)
    )
  )
  WITH CHECK (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), employee_id)
      OR private.is_employee_manager(auth.uid(), employee_id)
    )
  );

-- feedbacks: only the author (or an admin) may update
DROP POLICY IF EXISTS "feedbacks: members update" ON public.feedbacks;
CREATE POLICY "feedbacks: author or admin update" ON public.feedbacks
  FOR UPDATE TO authenticated
  USING (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), from_employee_id)
    )
  )
  WITH CHECK (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), from_employee_id)
    )
  );

-- time_logs: geolocation data restricted to self / manager / admin / security agent
DROP POLICY IF EXISTS "time_logs: members read" ON public.time_logs;
CREATE POLICY "time_logs: self manager admin read" ON public.time_logs
  FOR SELECT TO authenticated
  USING (
    private.is_org_admin(auth.uid(), organization_id)
    OR private.has_role(auth.uid(), organization_id, 'security_agent'::app_role)
    OR private.is_self_employee(auth.uid(), employee_id)
    OR private.is_employee_manager(auth.uid(), employee_id)
  );
