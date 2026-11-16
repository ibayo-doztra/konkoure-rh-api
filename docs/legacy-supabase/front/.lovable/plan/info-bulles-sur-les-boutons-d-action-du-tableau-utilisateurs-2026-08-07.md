# Info-bulles sur les boutons d'action du tableau Utilisateurs

## Objectif

Dans le back-office `/konkoureoffice/utilisateurs`, la colonne « Actions » affiche 3 boutons icônes (réinitialiser mot de passe, basculer super-admin, activer/désactiver) sans indication textuelle au survol. L'objectif est d'ajouter une info au survol claire pour chaque action.

## Approche recommandée

Deux options possibles, de la plus simple à la plus cohérente avec le reste de la plateforme :

1. **Tooltip Radix par bouton** — envelopper chaque `Button` dans le composant `Tooltip` existant (`src/components/ui/tooltip.tsx`). C'est la solution la plus directe, elle ajoute un texte au survol sans changer le layout.
2. **Regroupement dans un `ActionMenu**` — remplacer les 3 boutons icônes par le menu d'actions déjà utilisé ailleurs (Recrutement, Contrats, Départements). Cela affiche les labels textuels à l'ouverture du menu et évite les boutons icones isolés. C'est l'option privilégiée pour l'uniformité UX.

## Plan de mise en œuvre

### Option A : Tooltip individuel (fallback rapide)

- Fichier : `src/routes/konkoureoffice.utilisateurs.tsx`
- Importer `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent` depuis `@/components/ui/tooltip`.
- Envelopper chaque bouton d'action par un `<Tooltip>` avec `<TooltipTrigger asChild>` et un `<TooltipContent>` contenant le libellé de l'action :
  - « Réinitialiser le mot de passe »
  - « Donner / Retirer les droits super-admin »
  - « Activer le compte » ou « Désactiver le compte »
- Ajouter `TooltipProvider` au niveau du tableau ou vérifier qu'il existe déjà dans `__root.tsx`.
- Aucun changement de logique métier.

### Option B : ActionMenu (recommandée pour la cohérence)

- Fichier : `src/routes/konkoureoffice.utilisateurs.tsx`
- Importer `ActionMenu` et les icônes associées depuis `lucide-react`.
- Remplacer les 3 boutons d'action par un `<ActionMenu>` dans la cellule « Actions » avec les items suivants :
  - « Réinitialiser le mot de passe » → icône `KeyRound`
  - « Donner les droits super-admin » ou « Retirer les droits super-admin » selon l'état actuel → icône `ShieldCheck`
  - Séparateur
  - « Désactiver le compte » / « Réactiver le compte » selon l'état actuel → icône `UserX` / `UserCheck`, variante `destructive` si désactivation
- Conserver les mutations `reset`, `grant`, `ban` existantes.
- Supprimer les `Button` et `aria-label` individuels.
- Vérifier que le bouton du menu déclencheur est bien accessible (`aria-label="Actions"`).
- Toutes les actions doivent être confirmé avant execution tout en indiquant leurs effet dans la boit de diallogue.

## Vérification

- Afficher la page `/konkoureoffice/utilisateurs` en thème clair et sombre.
- Passer la souris sur chaque bouton/action et vérifier que le texte explicite apparaît.
- Vérifier que les actions fonctionnent toujours (réinitialisation, changement de droits, activation/désactivation).
- S'assurer que le rendu reste responsive (pas de débordement de la colonne Actions).