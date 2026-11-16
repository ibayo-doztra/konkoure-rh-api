
-- Bucket public pour les médias des publications sociales
insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', true)
on conflict (id) do nothing;

-- Lecture publique
create policy "Social media images are publicly accessible"
on storage.objects for select
using (bucket_id = 'social-media');

-- Écriture / modification / suppression réservées aux membres de l'organisation
-- (le 1er segment du chemin = organization_id)
create policy "Org members can upload social media images"
on storage.objects for insert
with check (
  bucket_id = 'social-media'
  and auth.uid() is not null
  and public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

create policy "Org members can update social media images"
on storage.objects for update
using (
  bucket_id = 'social-media'
  and auth.uid() is not null
  and public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

create policy "Org members can delete social media images"
on storage.objects for delete
using (
  bucket_id = 'social-media'
  and auth.uid() is not null
  and public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Conserver les URLs des images attachées à chaque publication
alter table public.social_posts
  add column if not exists media_urls jsonb not null default '[]'::jsonb;
