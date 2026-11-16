# Solde de congé : fiche employé + page des congés

## Objectif

Afficher le solde de congé annuel (en jours) à deux endroits :

1. **Fiche employé** (`/app/employees/$id`) — visible par l'employé lui-même, son manager et les admins RH.
2. **Page des congés** (`/app/leaves`) — le solde de l'utilisateur connecté visible en haut de la liste, sans ouvrir le formulaire de demande.

## État actuel (vérifié)

- La fonction serveur `getEmployeeLeaveBalance` existe déjà (`src/lib/leaves.functions.ts`) et vérifie l'autorisation côté serveur (employé lui-même, manager ou admin).
- Le solde est déjà affiché **dans** la modale « Nouvelle demande » et dans la modale d'approbation, mais **pas** sur la page liste des congés ni sur la fiche employé.
- La fiche employé utilise des cartes `SectionCard` (ex. badge NFC via `NfcBadgeCard`).

## Changements prévus

### 1. Fiche employé — nouvelle carte « Solde de congé »

- Nouveau composant `src/components/employees/LeaveBalanceCard.tsx` :
  - Appelle `getEmployeeLeaveBalance` avec l'ID de l'employé affiché.
  - Affiche le solde en jours (ex. « 12,5 jours »), avec un état de chargement discret.
  - En cas d'erreur d'autorisation (cas rare, l'autorisation est déjà filtrée côté serveur), la carte affiche « — » sans casser la page.
  - Style cohérent avec `NfcBadgeCard` et les `SectionCard` existantes (tokens sémantiques, aucune couleur en dur).
- Intégration dans `src/routes/_authenticated.app.employees.$id.tsx`, à côté de la carte badge NFC.

### 2. Page des congés — solde visible en haut

- Dans `src/routes/_authenticated.app.leaves.index.tsx` :
  - Récupérer le solde de l'employé connecté (`useMyEmployee` + `getEmployeeLeaveBalance`, requête déjà utilisée dans la modale).
  - Afficher une carte récapitulative « Mon solde de congé » au-dessus de la liste des demandes : solde actuel en jours, avec le décompte des demandes en attente (jours demandés en attente d'approbation) si disponible depuis la liste déjà chargée.
  - Invalidation du cache `leave-balance` déjà en place après création/annulation d'une demande.

### 3. Traductions

- Ajouter les libellés dans `src/locales/fr/hrm.ts` et `src/locales/en/hrm.ts` :
  - `leaves.myBalance` : « Mon solde de congé » / « My leave balance »
  - `leaves.pendingDays` : « Jours en attente d'approbation » / « Days pending approval »
  - Réutiliser `leaves.acquiredBalance` et `leaves.leaveBalance` existants.

## Détails techniques

- Aucune migration base de données : la colonne `employees.leave_balance` et la fonction `get_employee_leave_balance` existent déjà.
- Aucune nouvelle fonction serveur : réutilisation de `getEmployeeLeaveBalance`.
- Requêtes via `useQuery` avec `queryKey: ["leave-balance", employeeId]` (clé déjà utilisée, cache partagé entre les écrans).
- Vérification : build OK, puis contrôle visuel de la fiche employé et de la page congés dans l'aperçu.
