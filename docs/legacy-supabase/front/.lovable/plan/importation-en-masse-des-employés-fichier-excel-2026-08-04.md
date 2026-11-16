# Importation en masse des employés (fichier Excel)

## Objectif

Permettre d'ajouter plusieurs employés d'un coup à partir d'un fichier Excel, avec un modèle prêt à remplir contenant uniquement les informations indispensables. Les autres données (salaire, badge NFC, documents, manager, etc.) restent à compléter plus tard depuis la fiche employé.

## Colonnes du modèle

Reprises des champs obligatoires du formulaire de création actuel :


| Colonne         | Obligatoire | Format                                             |
| --------------- | ----------- | -------------------------------------------------- |
| Prénom          | oui         | texte                                              |
| Nom             | oui         | texte                                              |
| Email           | oui         | email valide                                       |
| Téléphone       | oui         | texte (ex. +224 6XX XX XX XX)                      |
| Poste           | oui         | texte                                              |
| Département     | oui         | doit correspondre au nom d'un département existant |
| Date d'embauche | oui         | JJ/MM/AAAA                                         |
| Statut          | non         | Actif / En congé / Sorti — « Actif » par défaut    |


Le fichier modèle contient : une ligne d'en-têtes mise en forme, une ligne d'exemple, les largeurs de colonnes ajustées, une liste déroulante pour le statut, et un second onglet « Instructions » listant les départements existants de l'organisation.

## Parcours utilisateur

1. Sur la page Employés, un menu d'actions regroupe « Télécharger le modèle », « Importer un fichier » et l'export existant.
2. « Télécharger le modèle » génère le fichier `modele-import-employes.xlsx` (départements de l'organisation inclus).
3. « Importer » ouvre une boîte de dialogue : dépôt du fichier `.xlsx`, puis **prévisualisation** avant tout enregistrement.
4. La prévisualisation affiche un tableau ligne par ligne : lignes valides en vert, lignes en erreur avec le motif précis (email invalide, département inconnu, champ manquant, date illisible, doublon d'email dans l'organisation ou dans le fichier).
5. Le bouton de confirmation n'importe que les lignes valides et indique le nombre importé / ignoré. La liste se rafraîchit ensuite.

## Règles de validation

- Mêmes règles que le formulaire unitaire (longueurs, email, téléphone min. 6 caractères).
- Département résolu par correspondance de nom, insensible à la casse et aux accents ; nom inconnu = ligne rejetée (pas de création automatique de département).
- Dates acceptées au format JJ/MM/AAAA, AAAA-MM-JJ, ou date native Excel.
- Emails déjà présents dans l'organisation ou dupliqués dans le fichier : ligne ignorée avec motif.
- Limite de 500 lignes par import.
- Le quota d'employés de l'offre est déjà appliqué côté base : si le plafond est atteint pendant l'import, le message d'erreur du plan est affiché et les lignes restantes sont annulées.

## Détails techniques

- Bibliothèque `exceljs` (compatible navigateur, permet mise en forme et validation de données du modèle) ajoutée en dépendance ; génération et lecture 100 % côté client.
- Nouveau composant `src/components/employees/EmployeeImportDialog.tsx` (dialogue, parsing, prévisualisation) et `src/lib/employee-import.ts` (génération du modèle, normalisation, validation — logique pure, testable, réutilisée par le dialogue).
- Insertion via `supabase.from("employees").insert([...])` par lots de 50, avec `organization_id` courant et `profile_details: {}` ; les erreurs de lot sont remontées ligne par ligne.
- Réutilisation des composants UI existants (Dialog, Table, Badge, ActionMenu) et des tokens sémantiques du thème ; libellés en français via i18n, cohérents avec le reste de la page.
- Aucun changement de schéma ni de politique de sécurité n'est nécessaire.

Lorsque l'utilisateur veux telecharger le fichier d'importation, lui suggerer de creer d'abord les departements de son organisation (s'ils n'existent pas) et créer une liste deroulante des departements pour eviter les erreur de saisie.

Tenir compte de la liaison clefs etrangeres du departement dans la table employé.