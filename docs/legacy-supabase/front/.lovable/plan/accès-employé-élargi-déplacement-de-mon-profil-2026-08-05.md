# Accès employé élargi + déplacement de « Mon profil »

## 1. Ce que voit un employé (rôle `employee`)

En plus des données qu'il crée, un employé pourra consulter :

- **Son contrat** : nouvelle entrée « Contrats » accessible aux employés, mais la page n'affiche que le(s) contrat(s) rattaché(s) à sa propre fiche. Aucune action (créer, modifier, clôturer) — lecture seule, sans les alertes de conformité ni les statistiques globales.
- **Son historique de pointage** : nouvelle entrée « Pointage » accessible aux employés, limitée à ses propres pointages (entrées/sorties, dates, heures). Pas d'accès aux zones de travail ni aux pointages des collègues.

Les managers et RH gardent la vue complète actuelle. La base de données autorise déjà chaque employé à lire son contrat et ses pointages : le travail porte donc sur les règles de menu et le filtrage des pages.

## 2. « Mon profil » déplacé dans l'en-tête

- Retrait de l'entrée « Mon profil » du groupe RH de la barre latérale.
- Ajout de « Mon profil » dans le menu déroulant qui s'ouvre au clic sur le nom de l'utilisateur, **au-dessus** de « Paramètres » et « Déconnexion ». L'entrée n'apparaît que si l'utilisateur a une fiche employé.

## Détails techniques

- `src/lib/permissions.ts` :
  - `/app/contracts` → ajouter `employee` (et `manager`) à la liste des rôles autorisés.
  - `/app/timeclock/logs` → nouvelle règle plus spécifique incluant `employee`, placée avant la règle générale `/app/timeclock`.
- `src/routes/_authenticated.app.contracts.tsx` : si le rôle n'est pas admin/manager, filtrer la requête sur `employee_id = myEmployee.id`, masquer les boutons d'action, le bouton de création et le bandeau de conformité.
- `src/routes/_authenticated.app.timeclock.logs.tsx` : même logique — filtrer sur `employee_id = myEmployee.id` pour un employé simple, masquer les filtres/sélecteurs d'employé.
- `src/components/AppSidebar.tsx` : supprimer l'élément « Mon profil » construit à partir de `myEmployee.id`.
- `src/components/AppHeader.tsx` : utiliser `useMyEmployee()` et ajouter un `DropdownMenuItem` « Mon profil » naviguant vers `/app/employees/$id`, avant « Paramètres ».
