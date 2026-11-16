# Toast de validation d'évaluation

## Objectif

Lorsqu'un manager/admin clique sur « Valider » pour finaliser une évaluation, le toast affiché doit passer de « Évaluation manager soumise » à « Évaluation validée avec succès ».

## Modifications prévues

1. **Fichiers de locales**
   - `src/locales/fr/performance.ts` : modifier `reviews.managerReviewSubmitted` pour afficher **« Évaluation validée avec succès »**.
   - `src/locales/en/performance.ts` : modifier la même clé pour afficher **« Review validated successfully »** afin de maintenir la cohérence bilingue.

2. **Usage existant**
   - La clé est utilisée dans `src/routes/_authenticated.app.performance.reviews.$id.tsx` après la mutation qui passe le statut à `validated`. Aucun changement de code n'est nécessaire au-delà de la valeur de traduction.

## Vérification

- Rechercher les occurrences restantes de l'ancienne formulation dans les fichiers de locales et les routes.
- S'assurer que la clé n'est pas utilisée ailleurs avec un sens différent.
