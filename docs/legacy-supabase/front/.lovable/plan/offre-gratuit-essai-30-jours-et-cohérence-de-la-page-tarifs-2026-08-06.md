# Offre Gratuit : essai 30 jours et cohérence de la page tarifs

## Constat vérifié

En base, l'offre Gratuit n'inclut que Personnel, Départements, Pointage. La page tarifs annonce pourtant « Congés & jours fériés » dans l'offre Gratuit, et place « Pointage géolocalisé » comme nouveauté de l'offre Essentiel alors qu'il est déjà inclus dans Gratuit. La règle d'accès en base (`private.org_has_module`) ne connaît aucune notion d'essai limité dans le temps.

## Nouvelle règle de l'offre Gratuit

- Pendant 30 jours à compter de la création de l'organisation : tous les modules **sauf Recrutement et Talents** — soit Personnel, Départements, Pointage, Congés, Contrats, Performance, Intégrations.
- Après 30 jours : **Personnel et Départements uniquement**. Le Pointage, les Congés, les Contrats, la Performance et les Intégrations se bloquent tant que l'organisation ne souscrit pas.

## Ce qui sera fait

1. **Base de données**
   - L'offre Gratuit stocke deux listes : les modules d'essai (ci-dessus) et les modules après essai (Personnel, Départements).
   - `private.org_has_module` : pour une organisation sur l'offre Gratuit (ou sans offre, ou dont l'abonnement payant a expiré), choisit la liste d'essai si l'organisation a moins de 30 jours, sinon la liste réduite. Les offres payantes actives et la période de grâce après annulation restent inchangées.

2. **Application**
   - Le catalogue de modules côté app est aligné sur ces deux listes, avec le même calcul d'essai, pour la sidebar, le garde de routes et la page « Module non inclus ».
   - Un bandeau « Essai gratuit — X jours restants » sur la page Abonnement, et la mention de l'échéance dans la carte de l'offre actuelle.
   - La page Abonnement liste les modules d'essai en cours et ce qui restera à l'issue de l'essai.

3. **Page tarifs (landing) — cohérence**
   - Carte Gratuit : « Essai 30 jours — tous les modules sauf Recrutement et Talents », puis « ensuite Personnel et Départements, jusqu'à 5 employés ».
   - Carte Essentiel : reformulée sur ce qu'elle ajoute réellement par rapport au Gratuit hors essai (Pointage géolocalisé, Congés & jours fériés, Contrats), 25 employés.
   - Carte Professionnel : Recrutement + Performance (Performance retirée de l'essai n'est pas concernée : elle reste bien un module Professionnel après essai).
   - Carte Entreprise : Talents, Intégrations, support prioritaire.
   - FAQ « L'essai est-il vraiment gratuit ? » réécrite pour décrire l'essai 30 jours et le repli.
   - Mêmes corrections dans la version anglaise.
   - Les cartes de la page Abonnement affichent les mêmes libellés que la landing (source commune).

## Détails techniques

- Migration : mise à jour de `plans.features` pour `gratuit` (`modules` = liste d'essai, `modules_after_trial` = `["employees","departments"]`) et remplacement de `private.org_has_module` avec le test `organizations.created_at > now() - interval '30 days'`.
- `src/lib/entitlements.ts` : `TRIAL_MODULES`, `FREE_AFTER_TRIAL_MODULES`, helper `isTrialActive(createdAt)` ; `PLAN_MODULES.gratuit` dérive de ces constantes.
- `src/hooks/useSubscription.ts` : expose `trialActive` et `trialEndsAt` (depuis `organizations.created_at`), et applique le bon jeu de modules au repli Gratuit.
- `src/lib/entitlements.server.ts` : même règle côté serveur pour `requireModule`.
- `src/lib/landing/copy.ts` : mise à jour des cartes tarifaires et de la FAQ (fr + en).
- Aucune donnée supprimée ; les organisations existantes de plus de 30 jours sur l'offre Gratuit basculent immédiatement sur Personnel + Départements.
