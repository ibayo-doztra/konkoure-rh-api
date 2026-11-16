# Rôle du manager sur les OKR + utilité du module Feedback

## Réponse courte

**Aujourd'hui (état réel du code)**
- Un OKR se compose d'un objectif, d'un trimestre, de résultats clés cochables, d'une progression calculée et d'un propriétaire (`employee_id`). Il n'y a **aucune étape manager** : pas de validation, pas de commentaire, pas de check-in, pas de lien avec l'évaluation.
- Le module **Feedback** affiche seulement une liste en lecture seule des enregistrements de la table `feedbacks` (type + message). Il n'existe **aucun formulaire pour en créer**, donc la page est vide en permanence — c'est pour cela qu'elle « ne sert à rien ».

**Ce que le manager devrait faire dans un cycle OKR**
1. Cadrage : valider/aligner l'objectif proposé par le collaborateur en début de trimestre.
2. Suivi : check-ins réguliers (mensuels) — commenter la progression, signaler les risques.
3. Clôture : constater le résultat en fin de trimestre et le reprendre dans l'évaluation de performance.
4. Reconnaissance continue : féliciter / recadrer via le feedback, sans attendre l'entretien annuel.

## Ce que je propose de construire

### 1. Cycle de validation des OKR
- Statuts du cycle : `brouillon` → `en attente de validation` → `validé` (ou `à revoir` avec commentaire du manager).
- Le collaborateur crée son OKR en brouillon puis le soumet ; le manager (N+1) et les admins voient une file « OKR à valider ».
- Le manager peut valider, ou renvoyer avec un motif (même logique que le renvoi d'évaluation déjà en place).
- Badges d'état sur les cartes OKR, cohérents avec les badges existants (success / warning).

### 2. Check-ins trimestriels
- Le manager (et le propriétaire) peut ajouter un commentaire de suivi daté sur un OKR, affiché en fil chronologique sur la carte.
- Notification au propriétaire à chaque commentaire manager, comme pour les évaluations.

### 3. Lien OKR → Évaluation
- Sur la page de détail d'une évaluation, afficher en lecture seule les OKR du collaborateur pour le trimestre concerné, avec leur progression, pour appuyer la notation.

### 4. Rendre le module Feedback utilisable
- Bouton « Donner un feedback » : destinataire (sélecteur collaborateur existant), type (félicitation / suggestion / point d'attention), message.
- Onglets : « Reçus » / « Envoyés » / « Équipe » (visible manager & admin uniquement).
- Notification au destinataire, feedbacks affichés avec auteur, date et badge de type.
- Option : possibilité de rattacher un feedback à un OKR ou à un objectif.

## Détails techniques

- Base : ajouter à `okrs` les colonnes de cycle (`review_status`, `submitted_at`, `validated_at`, `manager_comment`, `validated_by`) et une table `okr_checkins` (okr_id, author_employee_id, message, progress_snapshot, created_at). GRANT + RLS : lecture par le propriétaire, son N+1 et les RH/admins ; écriture manager réservée au N+1/admin.
- `feedbacks` : la table existe déjà (from/to/kind/message). Ajouter éventuellement `okr_id`/`goal_id` nullable ; écrire les policies d'insertion (auteur = employé courant) et de lecture (destinataire, auteur, N+1, RH/admin) + GRANT.
- Front : `src/routes/_authenticated.app.performance.okrs.tsx` (soumission, validation, renvoi, check-ins), `src/routes/_authenticated.app.performance.feedback.tsx` (formulaire + onglets), réutilisation de `EmployeeCombobox`, `ConfirmDialog`/`useConfirm`, `ActionMenu`, standard de modales (DialogBody / DialogFormGrid / DialogActions).
- i18n : nouvelles clés dans `src/locales/fr/performance.ts` et `src/locales/en/performance.ts`.
- Notifications : même mécanisme que les évaluations (renvoi / validation).

## Périmètre

Si tu veux avancer par étapes, je propose l'ordre : (1) validation manager des OKR, (2) check-ins, (3) module Feedback, (4) lien OKR ↔ évaluation.
