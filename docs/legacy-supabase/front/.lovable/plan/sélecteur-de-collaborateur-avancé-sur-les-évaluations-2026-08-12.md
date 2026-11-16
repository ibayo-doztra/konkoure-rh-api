# Sélecteur de collaborateur avancé sur les Évaluations

## Objectif

Remplacer le `<Select>` standard du choix de collaborateur sur la page **Évaluations de performance** par un sélecteur **searchable** affichant, pour chaque employé, sa **photo à gauche**, son **nom** et son **adresse e-mail en dessous**, afin de faciliter l'identification.

## Constat actuel

- Le composant actuel est un `Select` Radix classique (`src/components/ui/select.tsx`) : non searchable, pas d'avatar, pas d'e-mail, seul le nom est affiché.
- La requête employés sur la page ne récupère pas les colonnes `photo_url` et `email` nécessaires.
- Le projet dispose déjà de `command.tsx` (cmdk) et de `avatar.tsx` ; il n'a pas encore de composant `EmployeeCombobox` réutilisable.

## Correctifs prévus

1. **Requête de données** : dans `src/routes/_authenticated.app.performance.reviews.index.tsx`, étendre la sélection Supabase de la table `employees` avec `photo_url` et `email`.
2. **Composant `EmployeeCombobox`** : créer un petit composant local dédié (ou réutilisable) dans `src/components/employees/EmployeeCombobox.tsx` basé sur `<Command>` :
   - **Trigger** : affiche l'avatar, le nom complet et l'e-mail de l'employé sélectionné ; fallback textuel sur les initiales.
   - **Popover** : input de recherche en haut, suivi d'une option « Moi » puis de la liste des collaborateurs (hiérarchie descendante pour les managers, ou organisation entière pour les admins), triée par nom.
   - **Item** : layout horizontal avec `Avatar` (32 px), nom complet, et e-mail en `text-muted-foreground` ; hauteur fixe pour l'uniformité.
   - **Recherche** : filtre sur le nom, l'e-mail et le poste via `CommandInput`.
   - **Accessibilité** : gestion du clavier héritée de cmdk, `aria-label` pour le champ.
3. **Intégration** : remplacer le bloc `<Select>` existant par `<EmployeeCombobox>` dans `src/routes/_authenticated.app.performance.reviews.index.tsx`, en gardant la logique de hiérarchie (N-1, N-2, …) et le cas admin.
4. **Traductions** : ajouter les clés manquantes dans `src/locales/fr/performance.ts` et `src/locales/en/performance.ts` :
   - `reviews.searchCollaborator` : placeholder de la recherche (ex. *Rechercher un collaborateur…*).
   - `reviews.noCollaboratorFound` : message quand aucun résultat ne correspond.
5. **Vérification visuelle** : s'assurer que le sélecteur s'adapte au thème clair/sombre, que les longs noms/e-mails sont tronqués (`truncate`) et que la largeur reste responsive (`sm:max-w-xs` conservé).

## Détails techniques

- `src/routes/_authenticated.app.performance.reviews.index.tsx` :
  - modifier `.select("id,first_name,last_name,user_id,manager_id,position,status")` → ajouter `photo_url,email`.
  - remplacer le `<Select>` par `<EmployeeCombobox>`.
- `src/components/employees/EmployeeCombobox.tsx` (nouveau) :
  - utilise `Popover`, `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandItem`, `CommandGroup`, `Avatar`, `AvatarImage`, `AvatarFallback`, `cn`, `useTranslation`.
  - props : `value`, `onChange`, `options` (avec `id`, `first_name`, `last_name`, `email`, `photo_url`, `position`), `placeholder`, `meOption`.
- `src/locales/fr/performance.ts` et `src/locales/en/performance.ts` :
  - ajouter `searchCollaborator` et `noCollaboratorFound` dans `reviews`.
- Aucun changement de base de données ni de logique métier ; la hiérarchie descendante et les règles d'accès existantes restent inchangées.
