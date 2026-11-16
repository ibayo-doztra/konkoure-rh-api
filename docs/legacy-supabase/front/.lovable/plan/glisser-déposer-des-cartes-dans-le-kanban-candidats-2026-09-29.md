# Glisser-déposer des cartes dans le Kanban Candidats

## Constat

Le Kanban ne contient aucune fonction de glisser-déposer : seul le bouton « Déplacer » change l'étape d'une carte.

## Ce qui sera ajouté

- Faire glisser une carte candidat vers une autre colonne pour changer son étape.
- Mettre en évidence la colonne survolée pendant le glissement (bordure et fond légèrement colorés) et rendre la carte déplacée semi-transparente.
- Au dépôt, utiliser la mise à jour d'étape existante : actualisation immédiate, enregistrement, journal d'activité et message de confirmation. Rien ne se passe si la carte est déposée dans sa colonne d'origine.
- Fonctionne à la souris et au doigt (mobile / tablette) : léger seuil de déplacement pour ne pas gêner le clic d'ouverture de la fiche ni le défilement horizontal.
- Le bouton « Déplacer » reste disponible (accessibilité clavier).

## Détails techniques

- Ajout de la bibliothèque `@dnd-kit/core` (légère, compatible tactile et clavier) : `DndContext` autour des colonnes, `useDroppable` par colonne, `useDraggable` par carte, `PointerSensor`/`TouchSensor` avec seuil de 6 px, `DragOverlay` pour l'aperçu.
- `onDragEnd` appelle la fonction `move(candidate, stage)` existante.
- Modifications limitées à la page Candidats ; aucun changement de données, droits ou backend.

## Vérification

- Glisser une carte de « Nouveau » vers « Entretien » et confirmer la mise à jour dans le Kanban, le tableau et la fiche.
- Vérifier que le clic ouvre toujours la fiche et que le défilement horizontal fonctionne sur mobile.
