# Loader visuel sur la page de candidature

## Objectif
Sur la page publique de candidature (`/careers/:slug/:jobSlug`), le candidat doit voir clairement qu'une action est en cours — aujourd'hui seul le libellé du bouton change (« Envoi en cours… »), ce qui est trop discret.

## Changements — `src/routes/careers.$slug.$jobSlug.tsx`

1. **Pendant l'envoi (soumission du formulaire)**
   - Icône `Loader2` (lucide-react, `animate-spin`, motif déjà utilisé sur `/app/billing/checkout`) ajoutée dans le bouton « Envoyer ma candidature », avant le libellé.
   - Overlay de chargement sur la card du formulaire : voile semi-transparent sur le contenu, spinner central + message « Envoi de votre candidature… » — la page reste visible, le formulaire est verrouillé (champs et bouton désactivés), impossible de double-cliquer.

2. **Pendant le chargement initial de la page**
   - Le simple texte « Chargement… » est remplacé par un spinner centré (même composant), plus rassurant sur les connexions lentes.

## Traductions — `src/lib/i18n.ts` (sections `careers` FR + EN)
- `sendingTitle` : « Envoi de votre candidature… » / « Sending your application… »
- Réutilisation des clés existantes : `loading`, `sending`.

## Contraintes respectées
- Tokens sémantiques uniquement (page publique, hors exceptions connues : aucune couleur codée en dur).
- Aucune logique métier modifiée : upload, validation, doublons, webhooks restent inchangés.
- FR/EN cohérents.
