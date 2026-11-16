# Bloc de signature de l'évaluation

## Objectif
Afficher, en bas de la page d'évaluation, une signature visible par tous une fois l'évaluation signée, et supprimer le badge de date de soumission du manager.

## Ce qui change
1. **Bloc signature (visible par tous)** — Quand `status = signed`, ajouter en bas de page une carte discrète avec :
   - libellé « Signé électroniquement par »
   - nom complet du propriétaire de l'évaluation (prénom + nom de l'employé)
   - date (et heure) de signature à partir de `signed_at`
   - visible pour le propriétaire, le manager, les admins et tout autre lecteur (aucune condition de rôle)

2. **Retrait du badge** — Supprimer le `Badge` « Soumise le …» affiché sous la section « Évaluation manager » (dépendant de `manager_submitted_at`).

## Détails techniques
- Fichier : `src/routes/_authenticated.app.performance.reviews.$id.tsx`
  - Supprimer le bloc `{managerSubmitted && (<Badge …>)}` (lignes ~547-549).
  - Ajouter un bloc de signature après la carte « Évaluation manager », rendu si `review.status === "signed" && review.signed_at`, en tokens sémantiques (`border`, `text-muted-foreground`, `font-medium`).
- Traductions : ajouter les clés `reviews.signatureLabel` (« Signé électroniquement par » / « Electronically signed by ») et `reviews.signatureOn` (date) dans `src/locales/fr/performance.ts` et `src/locales/en/performance.ts`. La clé `reviews.submittedOnBadge` devient inutilisée et sera retirée.
