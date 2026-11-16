# Évaluations : sélecteur de collaborateur (N-1, N-2 …)

## Objectif

Sur la page « Évaluations de performance », un manager (ou un admin RH / propriétaire) doit pouvoir choisir un collaborateur de son équipe dans une liste déroulante et consulter ses évaluations, au lieu de ne voir que les siennes.

## Comportement

- Un sélecteur « Collaborateur » apparaît au-dessus des onglets, uniquement pour les managers et les admins. Un employé sans subordonné ne le voit pas (aucun changement pour lui).
- Valeur par défaut : « Moi ». La liste contient ensuite toute la hiérarchie descendante du manager (N-1, N-2, N-3 …), triée par nom, avec le poste en libellé secondaire.
- Pour un propriétaire / RH, la liste contient tous les employés actifs de l'organisation.
- L'onglet « Mes évaluations » se renomme dynamiquement : « Mes évaluations » quand on est sur soi, « Évaluations de {Prénom Nom} » sinon, et affiche les évaluations de la personne choisie.
- Les cartes d'évaluation restent cliquables ; en mode consultation d'un collaborateur, le bouton indique « Consulter » (la page de détail applique déjà ses propres règles d'écriture manager/employé).
- Message vide adapté : « Aucune évaluation pour ce collaborateur ».
- Onglet « Par plan » inchangé.

## Détails techniques

- `src/routes/_authenticated.app.performance.reviews.index.tsx` :
  - état `selectedEmployeeId` (défaut : fiche employé de l'utilisateur), `Select` shadcn alimenté par la liste calculée.
  - la liste `employees` déjà chargée (id, prénom, nom, user_id) est étendue à `manager_id`, `position`, `status` pour construire l'arbre.
  - calcul de la descendance en mémoire : parcours itératif depuis la fiche de l'utilisateur en suivant `manager_id`, sans limite de profondeur (protection anti-cycle par `Set`).
  - `myReviews` devient `visibleReviews` filtré sur `selectedEmployeeId`.
- Rôles : `useRole()` (`isAdmin`) + présence de subordonnés pour décider de l'affichage du sélecteur.
- Traductions ajoutées en FR et EN dans `src/locales/*/performance.ts` : libellé du sélecteur, option « Moi », titre d'onglet dynamique, état vide, bouton « Consulter ».
- Aucune modification de base de données : la lecture des évaluations de l'organisation est déjà filtrée par les règles d'accès existantes ; un manager ne verra donc que ce que la base l'autorise à voir.
