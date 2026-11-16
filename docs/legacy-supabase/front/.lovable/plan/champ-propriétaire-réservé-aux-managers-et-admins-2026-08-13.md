# Champ « Propriétaire » réservé aux managers et admins

## Comportement demandé

Dans la modale de création d'un objectif, la liste déroulante « Propriétaire » ne s'affiche que si l'utilisateur connecté est manager, RH ou propriétaire de l'organisation. Pour tous les autres, l'objectif est automatiquement créé pour eux-mêmes.

## Ce qui change

- Employé / recruteur / agent de sécurité : le champ « Propriétaire » disparaît, le champ « Statut » occupe alors toute la largeur. L'objectif est enregistré au nom de l'utilisateur courant (comportement actuel de l'option « Moi-même »).
- Manager, RH, Propriétaire : aucun changement visible, ils gardent la liste complète.
- Sécurité côté enregistrement : si un utilisateur non autorisé tente malgré tout d'envoyer un autre propriétaire (via l'outil de développement), la sauvegarde force le propriétaire à l'utilisateur courant.

## Détails techniques

- `src/routes/_authenticated.app.performance.goals.tsx` : utiliser `useRole()` pour calculer `canAssignOwner = role === "owner" | "hr_admin" | "manager"`. Rendu conditionnel du bloc « Propriétaire » et grille passant de 2 à 1 colonne quand il est masqué. Dans `save()`, ignorer `form.owner_id` lorsque `canAssignOwner` est faux.
- Aucun changement de base de données ni de traduction.
