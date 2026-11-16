# Barre d'actions de l'évaluation : largeur ajustée + bouton « Renvoyer »

## 1. Conteneur des boutons

La barre d'actions collante en bas de la page d'évaluation occupe toute la largeur de la page alors qu'elle ne contient que 2 boutons alignés à droite. Elle sera réduite à la largeur de son contenu et restera alignée à droite (sur mobile, elle pourra occuper toute la largeur pour rester utilisable).

## 2. Nouveau bouton « Renvoyer »

Placé juste après « Enregistrer », dans la barre d'actions du **manager** (celui qui relit l'évaluation soumise). Effet :

- renvoie l'évaluation à son propriétaire (l'employé) pour révision/amélioration ;
- l'évaluation redevient modifiable par l'employé (statut « En cours », soumission annulée) ;
- les commentaires et notes déjà saisis (employé et manager) sont conservés ;
- l'employé reçoit une notification « Évaluation renvoyée pour révision » avec le lien vers l'évaluation ;
- une boîte de confirmation (standard du projet) demande validation avant l'envoi, avec un champ facultatif de motif ajouté au message de notification.

Après renvoi, le manager repasse en lecture seule tant que l'employé n'a pas resoumis.

## Détails techniques

- `src/routes/_authenticated.app.performance.reviews.$id.tsx` :
  - barre d'actions : `w-fit ml-auto` (pleine largeur en dessous de `sm`), même style visuel.
  - nouvelle action `sendBack()` : `status = 'in_progress'`, `submitted_at = null`, insertion d'une notification pour `employee.user_id`, puis `load()`.
  - confirmation via le hook existant `useConfirm`.
- Traductions ajoutées dans `src/locales/fr/performance.ts` et `src/locales/en/performance.ts` (`reviews.sendBack`, `sendBackConfirm*`, `sendBackReason`, `sendBackSuccess`, `notifSentBack*`).
- Vérification côté base : les règles d'accès / le trigger `performance_reviews_guard_manager_fields` doivent autoriser le manager à remettre `status`/`submitted_at`. Si ce n'est pas le cas, l'action passera par une fonction serveur dédiée (`createServerFn` authentifiée) qui vérifie que l'appelant est bien le manager (ou un admin) avant la mise à jour.
