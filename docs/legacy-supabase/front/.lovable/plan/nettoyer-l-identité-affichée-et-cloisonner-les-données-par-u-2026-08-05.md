# Nettoyer l'identité affichée et cloisonner les données par utilisateur

## 1. En-tête et salutation

- Retirer l'emoji 👋 du titre du tableau de bord.
- Saluer l'utilisateur réellement connecté : le prénom vient de la table des profils (`profiles.full_name`) et non des métadonnées d'authentification, qui peuvent être périmées. Repli : la partie avant `@` de l'e-mail.
- Supprimer le badge de rôle affiché à côté du nom dans l'en-tête (il reste visible dans le menu déroulant du compte).
- Corriger les initiales de l'avatar : elles sont aujourd'hui calculées sur l'e-mail (« IB » pour ibayo427@…). Elles doivent venir du nom du profil (première lettre du prénom + première lettre du nom), avec repli sur l'e-mail si aucun nom.

Pour éviter la duplication, la lecture du profil (nom + avatar) est centralisée dans un petit hook `useProfile` réutilisé par l'en-tête et le tableau de bord.

## 2. Profil employé : actions contextuelles

Dans la fiche employé (`/app/employees/:id`) :

- « Inviter à rejoindre » : visible uniquement pour un administrateur (propriétaire / RH) et jamais sur sa propre fiche.
- « Envoyer un message » : masqué sur sa propre fiche (on ne s'écrit pas à soi-même).

Un employé qui consulte sa propre fiche ne voit donc plus aucun de ces deux boutons.

## 3. Cloisonnement des données (soi + ses N-1)

Règle appliquée : propriétaire et RH voient toute l'organisation ; un manager voit sa propre fiche et celles de ses subordonnés directs (employés dont il est le manager, plus les membres du service qu'il dirige) ; un employé ne voit que sa propre fiche.

- Liste des employés : filtrage du jeu de données selon cette règle (et non seulement masquage visuel).
- Fiche employé par URL directe : accès refusé avec message si l'employé consulté n'est ni soi-même, ni un subordonné, sauf pour propriétaire/RH.
- Le filtrage est appliqué côté serveur (fonction serveur dédiée pour la liste + politique de lecture correspondante), l'interface ne faisant que refléter ce périmètre.

## Détails techniques

- `src/routes/_authenticated.app.index.tsx` : suppression de l'emoji, prénom issu du profil.
- `src/components/AppHeader.tsx` : suppression du `<Badge>` de rôle du déclencheur, initiales dérivées de `full_name`.
- Nouveau `src/hooks/useProfile.tsx` : requête unique `profiles` (full_name, avatar_url) partagée.
- `src/routes/_authenticated.app.employees.$id.tsx` : conditions d'affichage des boutons via `useRole` + `useMyEmployee`, garde d'accès sur la fiche.
- `src/lib/employees.functions.ts` : nouvelle fonction serveur `listVisibleEmployees` (portée selon rôle et lien hiérarchique), utilisée par la page liste ; ajustement des politiques de lecture sur `employees` pour refléter la même portée.

## Point à confirmer

Je considère « N-1 » comme les subordonnés directs (l'utilisateur est leur manager, ou il dirige leur service). Dis-moi si un manager doit aussi voir toute sa hiérarchie descendante (N-2, N-3…).

Oui le manager peut voir les data de toute sa hierarchie descendante (N-2, N-3 ...).