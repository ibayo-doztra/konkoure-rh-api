# Deux modes d’affichage sur la page Candidats

## Objectif

Conserver le pipeline Kanban actuel et ajouter une vue Tableau pour comparer rapidement les résultats de l’analyse des candidatures. Les filtres, le nombre de résultats, la fiche détaillée et l’aperçu du CV restent communs aux deux vues.

## Affichage

- Ajouter dans la barre des filtres un sélecteur compact à deux icônes : **Pipeline** et **Tableau**, avec libellés accessibles et info-bulles en français et en anglais.
- Mémoriser le dernier mode choisi sur l’appareil et le restaurer lors des prochaines visites. En l’absence de préférence enregistrée, afficher le pipeline actuel.
- Ne rendre qu’un mode à la fois afin de garder la page rapide et lisible.

## Nouvelle vue Tableau

Afficher les candidatures filtrées, dans le même ordre que les données actuelles, avec ces colonnes :

1. **Nom complet** — ouvre la fiche détaillée du candidat.
2. **Téléphone** — valeur existante, ou un tiret si elle est absente.
3. **Profil** — offre d’emploi visée.
4. **Score** — badge `/100` avec le code couleur existant ; état « Non analysé » si aucun score n’est disponible.
5. **Justification** — aperçu lisible et limité en hauteur pour éviter des lignes excessivement longues.
6. **Mots clés** — points forts détectés par l’IA, présentés sous forme de badges ; état vide explicite si aucun point fort n’est disponible.
7. **CV** — bouton icône ouvrant l’aperçu actuel sans quitter la page ; état indisponible si aucun CV n’est attaché.

Le tableau aura son propre défilement horizontal sur les petits écrans, sans élargir toute la page. Une ligne vide et des lignes de chargement cohérentes seront prévues.

## Comportements conservés

- Recherche, filtre par offre et filtre par score appliqués aux deux modes.
- Clic sur une ligne pour ouvrir la fiche détaillée.
- Aperçu sécurisé du CV dans la fenêtre existante.
- Pipeline et changement d’étape inchangés.
- Aucune modification du scoring, des données, des autorisations ou du backend.

## Détails techniques

- Ajouter l’état du mode dans la page Candidats et persister uniquement la valeur `pipeline` ou `table` dans le stockage local après hydratation.
- Réutiliser les composants de tableau, boutons, badges, info-bulles et squelettes du design existant, avec les couleurs sémantiques du projet.
- Ajouter les nouveaux libellés dans les traductions françaises et anglaises.
- Conserver la fenêtre de détail et `CvPreviewDialog` comme points d’entrée uniques pour les actions existantes.

## Vérification

- Tester le basculement dans les deux sens et la restauration du dernier choix après rechargement.
- Vérifier les deux langues, les états sans score/sans mots clés/sans CV, et l’ouverture de la fiche ou du CV.
- Contrôler l’affichage sur ordinateur et mobile, notamment l’absence de débordement global.
- Vérifier que la page compile sans erreur et que les autres fonctions du pipeline restent opérationnelles.
