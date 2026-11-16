# Afficher toutes les offres dans le filtre des candidats

## Objectif

Afficher dans le filtre par offre toutes les offres de l’organisation, y compris celles qui n’ont encore reçu aucune candidature.

## Modification

- Charger la liste des offres séparément de la liste des candidats.
- Alimenter le sélecteur avec cette liste complète plutôt qu’avec les seules offres présentes dans les candidatures.
- Conserver l’option « Toutes les offres » et le filtrage actuel du Kanban.
- Exclure les offres en brouillons

## Vérification

- Confirmer que les quatre offres actuelles sont proposées, dont les deux sans candidat.
- Sélectionner une offre sans candidat et vérifier que le Kanban affiche des colonnes vides sans erreur.
- Vérifier que le retour à « Toutes les offres » réaffiche tous les candidats.

## Détails techniques

- Modification limitée à la page Candidats.
- Aucune modification de données, de droits ou de logique de recrutement.