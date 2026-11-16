# Pourquoi ibayo427@gmail.com semble charger le profil de bayo.ibrahima@doztra.com

## Ce que montrent les données (vérifié en base)

Ce ne sont pas les mêmes comptes, et le rôle est bien correct :

| Compte | Rôle | Organisation | Fiche employé liée |
|---|---|---|---|
| ibayo427@gmail.com | employee | Doztra | Fadima Diawara (Assistante) |
| bayo.ibrahima@doztra.com | owner | Doztra | Ibrahima Bayo (Directeur Général) |
| albert.kourouma@test.com | employee | Doztra | Albert Kourouma |

Deux causes se cumulent et donnent l'illusion d'être connecté au mauvais compte :

1. **Même nom affiché.** Dans la table des profils, ibayo427@gmail.com a aussi `full_name = "Ibrahima Bayo"`. L'en-tête affiche ce nom, donc les deux sessions affichent « Ibrahima Bayo ».
2. **Même organisation et aucun filtrage par rôle dans l'interface.** Les deux comptes sont membres de l'organisation Doztra, donc ils voient exactement les mêmes données. Et surtout : le menu latéral et les pages ne tiennent aujourd'hui aucun compte du rôle — tout le monde voit tous les modules (RH, recrutement, paramètres, facturation…). Seules certaines opérations sensibles côté serveur vérifient le rôle owner/hr_admin.

Donc le rôle « employee » est bien appliqué en base, mais l'interface ne le reflète pas.

## Ce que je propose de corriger

### 1. Rendre l'identité affichée sans ambiguïté
- Afficher dans l'en-tête le nom **et** l'e-mail du compte connecté, plus le rôle (badge : Propriétaire / RH / Manager / Employé).
- Corriger le nom du profil de ibayo427@gmail.com pour qu'il corresponde à sa fiche employé (Fadima Diawara), afin de ne plus confondre les deux comptes.

### 2. Appliquer réellement le rôle dans l'interface
- Créer un hook `useRole` qui charge le rôle de l'utilisateur dans l'organisation courante (owner, hr_admin, manager, employee, recruiter, security_agent).
- Filtrer le menu latéral selon le rôle :
  - **employee** : Tableau de bord, Mon profil, Congés (mes demandes), Pointage, Performance (mes objectifs/évaluations).
  - **manager** : + équipe (employés de son service, validation des congés).
  - **hr_admin / owner** : tout ; **owner** seul garde Facturation & Paramètres plateforme.
  - **recruiter** : Recrutement uniquement (+ tableau de bord).
- Bloquer l'accès direct par URL aux pages non autorisées (redirection vers le tableau de bord avec un message), pas seulement masquer le menu.
- Masquer les actions d'administration dans les pages (créer/importer/inviter un employé, assigner un badge, supprimer un département…) pour les rôles non autorisés.

### 3. Vider proprement le cache à la déconnexion
Le cache local de l'organisation (`konkoure.org`) est effacé à la déconnexion, mais on ajoutera un nettoyage systématique au changement d'utilisateur pour éviter tout affichage résiduel de la session précédente.

## Détails techniques

- Nouveau `src/hooks/useRole.tsx` (contexte, lecture de `user_roles` filtrée par `organization_id` + `user_id`), monté à côté de `OrgProvider`.
- `src/components/AppSidebar.tsx` : chaque entrée de menu reçoit une liste de rôles autorisés ; filtrage au rendu.
- `src/routes/_authenticated.tsx` : garde par rôle basée sur le chemin courant, avec écran de chargement tant que le rôle n'est pas connu (pas de flash).
- `src/components/AppHeader.tsx` : afficher `user.email` sous le nom + badge de rôle.
- Les permissions serveur existantes (fonctions serveur et RLS) restent la source de vérité ; le filtrage UI ne fait qu'éviter la confusion et les erreurs « permission denied ».

## Point à confirmer

La répartition des menus par rôle ci-dessus est une proposition ; dis-moi si tu veux ajuster ce que voit un « manager » ou un « employee ».
