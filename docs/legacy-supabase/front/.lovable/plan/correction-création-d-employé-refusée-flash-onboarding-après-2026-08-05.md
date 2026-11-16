# Correction : création d'employé refusée + flash onboarding après connexion

## 1. « permission denied for table employees » à la création

Cause confirmée (vérifiée en base) : le rôle `authenticated` n'a plus de droit
table-level sur `employees`, seulement des droits **colonne par colonne**. Les
colonnes sensibles ont été volontairement retirées lors des correctifs de
sécurité : `profile_details`, `base_salary`, `leave_balance`, colonnes badge NFC.

Or le formulaire de création envoie `profile_details` (genre + date de
naissance) dans l'insert client. Postgres refuse donc tout l'insert.

Correctif retenu — aligner la création sur l'import (déjà sécurisé) :

- Ajouter une fonction serveur `createEmployee` dans
  `src/lib/employees.functions.ts`, protégée par `requireSupabaseAuth` :
  - validation Zod des champs du formulaire (dont `profile_details` limité à
    `gender` et `birthday`) ;
  - vérification que l'appelant est `owner` ou `hr_admin` de l'organisation
    ciblée, et que le département appartient bien à cette organisation ;
  - insertion via le client serveur privilégié, comme `importEmployees`.
- Dans `src/routes/_authenticated.app.employees.index.tsx`, remplacer
  `supabase.from("employees").insert(payload)` par l'appel à cette fonction
  serveur (`useServerFn`), en conservant le même formulaire, les mêmes
  messages et le rafraîchissement de la liste.
- Le message d'erreur du quota de l'offre (déclencheur en base) reste remonté
  tel quel à l'utilisateur.

Aucune modification de schéma ni de droits : les colonnes sensibles restent
inaccessibles au rôle authentifié.

## 2. Flash de la page d'onboarding après connexion en production

Cause confirmée dans `src/hooks/useOrg.tsx` : `fetchFor()` ne repasse jamais
`loading` à `true`. Après un premier passage sans session (`setLoading(false)`),
la connexion déclenche un nouveau chargement pendant lequel l'état est
`org = null` et `loading = false`. Le garde de `src/routes/_authenticated.tsx`
lit alors « pas d'organisation, chargement terminé » et redirige vers
`/onboarding/organization` avant que la vraie organisation n'arrive.

Correctif :

- Dans `useOrg`, passer `loading` à `true` au début de `fetchFor` pour un
  identifiant utilisateur non nul (et le remettre à `false` à la fin, y compris
  en cas d'erreur).
- Dans le garde `_authenticated`, ne déclencher la redirection onboarding que
  lorsque l'utilisateur est connu, le chargement organisation terminé **et**
  qu'aucune organisation n'a été résolue — en affichant le splash sinon.

Résultat attendu : après connexion, splash puis dashboard directement, sans
apparition de l'écran d'onboarding.
