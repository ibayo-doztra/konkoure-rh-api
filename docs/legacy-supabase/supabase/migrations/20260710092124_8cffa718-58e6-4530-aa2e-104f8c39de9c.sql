
REVOKE ALL ON public.candidate_notes FROM anon;
REVOKE ALL ON public.achievements FROM anon;
REVOKE ALL ON public.feedbacks FROM anon;
REVOKE ALL ON public.goal_activities FROM anon;
REVOKE ALL ON public.okrs FROM anon;
REVOKE ALL ON public.performance_reviews FROM anon;
REVOKE ALL ON public.review_goal_comments FROM anon;
REVOKE ALL ON public.reviews FROM anon;
REVOKE ALL ON public.notifications FROM anon;
REVOKE ALL ON public.time_logs FROM anon;

REVOKE SELECT, UPDATE, DELETE ON public.candidates FROM anon;
