# Tableau Candidats : points forts et étape du processus

## Objectif

Faire évoluer la vue Tableau sans modifier le Kanban ni les règles métier : remplacer les badges « Mots clés » par un texte « Points forts », puis permettre de consulter, modifier et filtrer l’étape de chaque candidature.

## Modifications prévues

### Colonne Points forts

- Renommer **Mots clés** en **Points forts** en français et **Keywords** en **Strengths** en anglais.
- Afficher les points forts détectés par l’analyse sous forme de texte lisible, dans le même style que la justification et avec une hauteur limitée pour préserver des lignes compactes.
- Afficher un tiret lorsqu’aucun point fort n’est disponible.

### Colonne Étape

- Ajouter une colonne **Étape** / **Stage** au tableau, avant la colonne CV.
- Afficher une liste déroulante par candidat avec les étapes existantes : Nouveau, Pré-sélection, Entretien, Offre, Embauché et Refusé.
- Reprendre le repère visuel coloré déjà utilisé dans le Kanban pour identifier rapidement chaque étape.
- Lors d’un changement, utiliser la mise à jour existante : actualisation immédiate, enregistrement, journal d’activité et message de confirmation.
- Empêcher le clic sur cette liste d’ouvrir involontairement la fiche détaillée du candidat.

### Filtre par étape

- Ajouter à la barre de filtres une liste **Toutes les étapes** suivie des six étapes du processus.
- Appliquer ce filtre à la vue Tableau et au Kanban, avec les filtres actuels de recherche, d’offre et de score.
- Conserver le compteur de candidats basé sur les résultats réellement filtrés.

## Adaptation de l’affichage

- Ajuster la largeur minimale et les colonnes du tableau pour accueillir la nouvelle information sans provoquer de débordement global.
- Mettre à jour les lignes de chargement et l’état vide pour le nouveau nombre de colonnes.
- Conserver le défilement horizontal propre au tableau sur les écrans étroits.

## Détails techniques

- Changements limités à la page Candidats et aux traductions françaises et anglaises.
- Réutilisation de la fonction de changement d’étape et des composants de liste déroulante existants.
- Aucun changement du scoring, des données, des autorisations ou du backend.

## Vérification

- Vérifier le texte des points forts, y compris l’état vide.
- Changer l’étape depuis le tableau et confirmer que le Kanban, la fiche détaillée et le journal d’activité reflètent la nouvelle valeur.
- Tester le filtre d’étape seul et combiné aux autres filtres dans les deux vues.
- Contrôler les versions française et anglaise ainsi que l’affichage sur ordinateur et mobile.
