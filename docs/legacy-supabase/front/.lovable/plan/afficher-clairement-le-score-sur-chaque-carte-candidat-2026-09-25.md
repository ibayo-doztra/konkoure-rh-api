# Afficher clairement le score sur chaque carte candidat

## Objectif

Rendre le score obtenu immédiatement lisible sur chaque carte du tableau Kanban, sans ouvrir le détail du candidat.

## Modification

- Conserver le score dans la zone supérieure droite de chaque carte, à côté de l’icône du CV.
- Afficher la valeur sous la forme `32/100` plutôt qu’un nombre isolé, afin que sa signification soit évidente.
- Garder le code couleur existant : rouge sous 40, orange de 40 à 69, vert à partir de 70.
- Ne rien afficher lorsqu’un candidat n’a pas encore reçu de score du workflow IA.
- Ajouter un libellé accessible indiquant qu’il s’agit du score d’adéquation du candidat.

## Vérification

- Vérifier les cartes avec un score faible, moyen et élevé.
- Vérifier qu’une carte sans score ne présente pas de valeur trompeuse.
- Confirmer que le score reste lisible sur mobile, tablette et ordinateur, sans perturber le défilement horizontal du Kanban.

## Détails techniques

- Modification limitée à `src/routes/_authenticated.app.recruitment.candidates.tsx` et, si nécessaire, aux traductions FR/EN du recrutement.
- La donnée `ai_score` est déjà disponible et actuellement rendue sous forme de nombre seul sur les cartes ; aucun changement de base de données ni de scoring n’est requis.
