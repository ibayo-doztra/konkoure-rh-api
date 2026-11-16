# Badges d'état sur les objectifs OKR

## Objectif
Sur la page Objectifs en mode OKR, afficher un badge d'état sur chaque carte :
- **En cours** dès qu'au moins un résultat clé est coché, sans que tous le soient.
- **Atteint** lorsque tous les résultats clés sont cochés, avec le même style vert que le badge « Signée » des évaluations.

## Ce qui change
1. Sur la carte d'un objectif, à côté du titre :
   - 0 résultat coché → aucun badge (comme aujourd'hui).
   - Au moins 1 coché, progression < 100 % → badge « En cours » (style ambre/avertissement, cohérent avec l'état `in_progress` des évaluations).
   - 100 % → badge « Atteint » en vert (fond vert clair, texte blanc), identique au badge « Signée ».
2. Le badge se met à jour immédiatement au clic sur une case à cocher (mise à jour optimiste déjà en place).
3. Ajout de la traduction « En cours » / « In progress » pour les OKR (FR + EN).

## Détails techniques
- `src/routes/_authenticated.app.performance.okrs.tsx` : remplacer `{o.progress === 100 && <Badge variant="secondary">…}` par un calcul du nombre de résultats cochés et deux badges :
  - en cours : `bg-warning/10 text-warning`
  - atteint : `bg-success/15 text-success-foreground` (même classes que `signed` dans `REVIEW_STATUS_CLS`).
- `src/locales/fr/performance.ts` et `src/locales/en/performance.ts` : ajouter la clé `okrs.inProgress`.

## Non concerné
- Aucun changement de base de données, de statut enregistré ni de logique de progression.
