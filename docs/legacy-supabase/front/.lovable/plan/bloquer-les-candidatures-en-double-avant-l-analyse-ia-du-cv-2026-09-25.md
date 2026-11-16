# Bloquer les candidatures en double avant l'analyse IA du CV

## Objectif
Ne jamais appeler le workflow n8n de scoring si la personne a déjà postulé à la même offre. Les crédits IA ne sont consommés que pour une première candidature.

## Règle de détection
Un candidat est considéré comme ayant déjà postulé si, pour **la même offre**, il existe déjà une candidature avec :
- le même email (sans tenir compte des majuscules/espaces), **ou**
- le même numéro de téléphone.

Une personne peut toujours postuler à une autre offre de la même organisation.

## Parcours candidat
1. Au clic sur « Envoyer ma candidature », une vérification rapide est faite **avant** l'envoi du CV.
2. Si déjà postulé : la modale se ferme, message clair : « Vous avez déjà postulé à cette offre. Votre candidature est en cours d'examen. » (FR/EN). Aucun fichier envoyé, aucun appel IA.
3. Sinon : parcours actuel inchangé.
4. La même vérification est refaite côté serveur juste avant l'appel au workflow (protection contre le contournement du formulaire).

## Détails techniques
- `src/lib/recruitment-webhooks.functions.ts` :
  - nouvelle fonction serveur publique `checkPublicApplicationDuplicate({ organizationId, jobId, email, phone })` (client admin, offre publiée vérifiée, renvoie seulement `{ duplicate: boolean }`, aucune donnée personnelle exposée).
  - dans `recordPublicApplication`, avant `runCandidateScoring` : requête `candidates` filtrée `job_id` + (`email ilike` normalisé OR `phone =`) → retour `reason: "already_applied"` sans appel n8n.
- `createPublicApplicationUpload` : même contrôle, pour ne pas émettre d'URL d'upload à un doublon.
- `src/routes/careers.$slug.$jobSlug.tsx` : appel du pré-contrôle au début de la soumission, gestion de `already_applied` avec toast lisible.
- `src/lib/i18n.ts` : clé `careers.errors.alreadyApplied` FR/EN.
- Base : index `(job_id, lower(email))` et `(job_id, phone)` sur `candidates` pour une vérification rapide (migration additive, non destructive).
- Docs backend (`docs/backend/07-regles-metier.md`, skill konkoure-recruitment) : règle « pas de scoring IA pour une candidature en double » ajoutée.
