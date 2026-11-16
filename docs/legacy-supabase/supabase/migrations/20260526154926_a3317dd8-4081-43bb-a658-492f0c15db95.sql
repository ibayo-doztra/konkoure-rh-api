-- Enum for activity types
CREATE TYPE public.candidate_activity_type AS ENUM ('created', 'stage_changed', 'scored', 'note_added', 'note_deleted');

-- candidate_notes table
CREATE TABLE public.candidate_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  author_id uuid,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_candidate_notes_candidate ON public.candidate_notes (candidate_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_notes TO authenticated;
GRANT ALL ON public.candidate_notes TO service_role;

ALTER TABLE public.candidate_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidate_notes: members read"
  ON public.candidate_notes FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "candidate_notes: members write"
  ON public.candidate_notes FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND auth.uid() = author_id);

CREATE POLICY "candidate_notes: author or admin delete"
  ON public.candidate_notes FOR DELETE
  USING (auth.uid() = author_id OR public.is_org_admin(auth.uid(), organization_id));

-- candidate_activities table
CREATE TABLE public.candidate_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  actor_id uuid,
  type public.candidate_activity_type NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_candidate_activities_candidate ON public.candidate_activities (candidate_id, created_at DESC);

GRANT SELECT, INSERT ON public.candidate_activities TO authenticated;
GRANT SELECT, INSERT ON public.candidate_activities TO anon;
GRANT ALL ON public.candidate_activities TO service_role;

ALTER TABLE public.candidate_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidate_activities: members read"
  ON public.candidate_activities FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "candidate_activities: members insert"
  ON public.candidate_activities FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) OR actor_id IS NULL);

CREATE POLICY "candidate_activities: admins delete"
  ON public.candidate_activities FOR DELETE
  USING (public.is_org_admin(auth.uid(), organization_id));
