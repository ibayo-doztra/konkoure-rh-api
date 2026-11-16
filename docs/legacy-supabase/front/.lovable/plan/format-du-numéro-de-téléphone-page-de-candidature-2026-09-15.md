# Format du numéro de téléphone — page de candidature

## Objectif

Sur la page publique de candidature (`/careers/$slug/$jobSlug`), le champ Téléphone est formaté automatiquement « 622 00 00 00 » et limité à exactement 12 caractères (9 chiffres + 3 espaces).

## Comportement attendu

- Pendant la saisie, les espaces s'insèrent automatiquement : `622000000` devient `622 00 00 00`.
- Impossible de saisir plus de 12 caractères ou des lettres.
- À l'envoi, le numéro doit contenir exactement 9 chiffres ; sinon un message d'erreur indique le format attendu.
- Le numéro stocké en base reste le format affiché (`622 00 00 00`), inchangé pour le workflow d'analyse.

## Détails techniques

- `src/routes/careers.$slug.$jobSlug.tsx` :
  - Ajout d'une fonction de formatage `formatGnPhone(value)` : conserve uniquement les chiffres, tronque à 9, regroupe en `XXX XX XX XX`.
  - Le `onChange` du champ téléphone applique ce formatage ; `inputMode="numeric"`, `maxLength={12}`, placeholder `622 00 00 00`.
  - Schéma zod `buildSchema` : `phone` validé par regex `/^\d{3} \d{2} \d{2} \d{2}$/` (exactement 12 caractères), avec message d'erreur dédié.
- `src/lib/recruitment-webhooks.server.ts` : durcissement du schéma serveur `phone` (même regex, côté `recordPublicApplication`) pour refuser les formats invalides — messages d'erreur inchangés côté client.
- Traductions `src/locales/{fr,en}/public.ts` : nouvelle clé `careers.errors.phoneInvalid` (« Numéro attendu au format 622 00 00 00. » / « Phone number must look like 622 00 00 00. »).
- Aucune migration, aucun changement sur la page Candidats (affichage inchangé).
