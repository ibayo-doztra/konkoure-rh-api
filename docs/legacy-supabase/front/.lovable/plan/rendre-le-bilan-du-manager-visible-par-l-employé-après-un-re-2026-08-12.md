# Rendre le bilan du manager visible par l'employé après un renvoi

## Constat vérifié

Les commentaires et la note du manager sont bien enregistrés et l'employé a le droit de les lire (les règles d'accès autorisent le propriétaire de l'évaluation à lire l'évaluation et les commentaires liés). Le problème est uniquement d'affichage : la page masque le bloc « Évaluation du manager » et les champs « Commentaire du manager » tant que l'évaluation est au statut *soumise* ou que le manager a *validé*. Or le bouton « Renvoyer » remet l'évaluation en cours et annule la soumission — l'employé retombe donc dans un état où rien du manager n'est affiché.

## Correctifs

1. **Toujours afficher le bilan du manager quand il existe.** Si une note manager, un commentaire global manager ou au moins un commentaire manager par objectif est renseigné, la section « Évaluation du manager » et les champs correspondants sont affichés à l'employé, en **lecture seule**.
2. **Bandeau de renvoi.** Quand l'évaluation a été renvoyée (elle a déjà un retour manager mais n'est plus soumise), un encart informe l'employé : évaluation renvoyée pour révision, tenir compte des remarques du manager ci-dessous, puis resoumettre.
3. **Aucune perte de données.** L'enregistrement/la resoumission par l'employé n'écrase pas les champs du manager (déjà le cas aujourd'hui, conservé).
4. Creer les statuts "revue" -> renvoyer, "signé" et "validé", le proprietaire doit signer l'evaluation apres qu'elle soit validée par le manager
5. Lorsque le statut est sur "revue" ou "validé" le proprietaire à droit de voir tous les commentaire du manager en lecture seule.

## Détails techniques

- `src/routes/_authenticated.app.performance.reviews.$id.tsx` :
  - calcul d'un indicateur `hasManagerFeedback` (note manager, commentaire global manager, ou un `mgrComments` non vide) ;
  - conditions d'affichage : section manager `(isSubmitted || canEditManager || hasManagerFeedback)`, champ « Commentaire du manager » par objectif `(isSubmitted || managerSubmitted || canEditManager || hasManagerFeedback)` ;
  - champs manager désactivés dès que `!canEditManager` (déjà le cas) ;
  - nouvel encart affiché si `isOwner && hasManagerFeedback && !isSubmitted`.
- Nouvelles clés de traduction `reviews.sentBackBanner*` dans `src/locales/fr/performance.ts` et `src/locales/en/performance.ts`.
- Aucun changement de base de données : les règles d'accès actuelles permettent déjà la lecture par le propriétaire.