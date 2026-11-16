# Plan : bouton Supprimer des modales en style danger

## Problème

Le bouton d'action des modales de suppression n'est pas toujours stylé en rouge dangereux. L'utilisateur voit actuellement un bouton violet (variante par défaut) au lieu d'un bouton rouge a la page des objectifs la modale declanger par le bouton de suppression.

## Solution

1. Audit rapide de tous les appels `ConfirmDialog` / `useConfirm` pour identifier les confirmations de suppression.
2. Ajouter `actionVariant="destructive"` sur les modales de suppression qui n'en ont pas.
3. Vérifier que le variant `destructive` du composant `Button` est bien rouge via les tokens du thème actif.

## Fichiers concernés (priorité)

- `src/routes/_authenticated.app.departments.tsx` — confirmation de suppression d'un département (manque `actionVariant`).
- Révision des autres usages (back-office, contrats, jobs, performance, paramètres) déjà en `destructive` ; aucune modification attendue.

## Validation

- Ouvrir la modale de suppression d'un département sur `/app/departments`.
- Vérifier que le bouton `Supprimer` est bien rouge dans les thèmes clair et sombre.