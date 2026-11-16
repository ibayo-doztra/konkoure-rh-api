CREATE INDEX IF NOT EXISTS candidates_job_email_lower_idx ON public.candidates (job_id, lower(email));
CREATE INDEX IF NOT EXISTS candidates_job_phone_idx ON public.candidates (job_id, phone);