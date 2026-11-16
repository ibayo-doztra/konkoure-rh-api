# Afficher toutes les colonnes du kanban au défilement

## Objectif

Garantir que les six colonnes du pipeline Candidats restent accessibles par défilement horizontal sur mobile, tablette et ordinateur, sans élargir ni déplacer toute la page.

## Correction

- Contraindre les conteneurs principaux de l’espace connecté à pouvoir rétrécir à la largeur disponible, notamment à côté de la barre latérale.
- Donner au kanban un conteneur de défilement dédié, limité à la largeur visible de la page.
- Placer les colonnes dans une rangée interne dont la largeur correspond réellement à l’ensemble des six colonnes et de leurs espacements.
- Conserver la largeur stable de chaque colonne et ajouter un espace final afin que la colonne « Refusé » soit entièrement visible en fin de défilement.
- Préserver le défilement vertical interne des candidatures et empêcher le défilement horizontal global de la page.

## Vérification

- Vérifier le début et la fin du défilement aux largeurs mobile, tablette et ordinateur.
- Confirmer que « Nouveau » est entièrement visible au début et « Refusé » entièrement visible à la fin.
- Confirmer que l’en-tête, les filtres, la barre latérale et le pied de page ne débordent pas horizontalement.
- Vérifier que les cartes candidat, les menus « Déplacer » et l’ouverture du détail restent fonctionnels.

## Détails techniques

- Modifications limitées aux classes de mise en page du conteneur connecté et de la page Candidats.
- Structure prévue : enveloppe `overflow-x-auto` + rangée interne `w-max min-w-full` + colonnes `shrink-0`.
- Aucun changement de données, de droits d’accès ou de logique métier.
