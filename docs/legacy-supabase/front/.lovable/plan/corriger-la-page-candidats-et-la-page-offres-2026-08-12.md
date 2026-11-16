# Corriger la page Candidats et la page Offres

## 1. Erreur « permission denied for function is_recruitment_staff »

La fonction de sécurité `private.is_recruitment_staff` est utilisée par les règles d'accès des tables `candidates`, `candidate_notes`, `candidate_activities`, etc., mais les droits d'exécution lui ont été retirés pour les utilisateurs connectés (contrairement aux autres fonctions équivalentes comme `is_org_admin`, qui elles ont bien ce droit). Résultat : toute lecture de candidats échoue.

Correction : migration ajoutant le droit d'exécution de cette fonction aux rôles `authenticated` et `service_role`, comme pour les autres fonctions de sécurité du projet. Aucune règle d'accès n'est assouplie — la fonction reste en `SECURITY DEFINER` et vérifie toujours le rôle dans l'organisation.

Le module recrutement est disponible uniquement par les admin et les rh.

## 2. Débordement horizontal de la page Candidats

Le pipeline (colonnes Kanban) est en défilement horizontal, mais son conteneur n'est pas contraint à la largeur disponible : il pousse toute la page au-delà de l'écran (barre de défilement visible sur toute la page, en-tête et barre de recherche coupés).

Correction dans `src/routes/_authenticated.app.recruitment.candidates.tsx` :

- contraindre le conteneur de page (`w-full`, `max-w-full`, `min-w-0`) et le conteneur du Kanban (`min-w-0`) pour que le défilement reste interne aux colonnes ;
- rendre la barre de filtres réellement responsive (champ de recherche `min-w-0`, listes déroulantes en pleine largeur sur mobile puis largeur fixe à partir de `sm:`) afin d'éviter tout dépassement sur petits écrans.

## 3. Préfixes « jobs. » affichés sur la page Offres

Les textes existent bien dans les fichiers de traduction, mais sous `recruitment.jobs.*`, alors que les pages appellent `t("jobs.…")`. La clé n'étant pas trouvée, i18next affiche la clé brute.

Correction : remplacer tous les appels `t("jobs.…")` par `t("recruitment.jobs.…")` dans :

- `src/routes/_authenticated.app.recruitment.jobs.index.tsx`
- `src/routes/_authenticated.app.recruitment.jobs.new.tsx`
- `src/routes/_authenticated.app.recruitment.jobs.$id.edit.tsx`

Les clés éventuellement manquantes (FR et EN) seront ajoutées dans les fichiers de traduction correspondants pour qu'aucun libellé brut ne subsiste.

## Vérification

- Recharger la page Candidats connecté en tant qu'admin : les candidats se chargent sans erreur de permission.
- Capture d'écran automatisée des pages Candidats et Offres pour confirmer l'absence de débordement et de clés brutes.