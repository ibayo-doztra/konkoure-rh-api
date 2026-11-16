# Standard visuel unique pour toutes les modales

## Objectif
Figer le modèle de modale visible sur la capture (Nouvel employé) comme référence obligatoire pour toutes les boîtes de dialogue, présentes et futures, et aligner les modales existantes qui s'en écartent.

## Le standard retenu
- Conteneur : coins arrondis, bordure, fond en surface secondaire, largeur max ~3xl, hauteur max 90vh, contenu défilant.
- En-tête : titre à gauche, séparateur bas, bouton de fermeture (X) en haut à droite.
- Corps : carte intérieure claire avec marge autour, padding généreux.
- Formulaires : grille 1 colonne sur mobile, 2 colonnes à partir du desktop, libellé au-dessus du champ, astérisque rouge pour les champs obligatoires, message d'erreur en petit texte sous le champ.
- Actions :
  - un seul bouton d'action -> pleine largeur, en bas du corps, avec marge supérieure ;
  - plusieurs boutons -> alignés à droite, largeur proportionnelle à leur contenu, espacement régulier entre eux, action secondaire (Annuler) à gauche de l'action principale ;
  - sur mobile, les groupes de boutons s'empilent.
- Toujours des tokens sémantiques, jamais de couleurs codées en dur.

## Ce qui sera fait
1. Enregistrer la règle en mémoire projet (fichier de mémoire dédié « modales ») + référence dans l'index, pour qu'elle s'applique automatiquement à chaque nouvelle modale.
2. Vérifier et compléter les primitives existantes de `dialog` afin que le standard soit atteignable sans classes ad hoc : notamment un conteneur d'actions réutilisable gérant les deux cas (pleine largeur / plusieurs boutons à droite).
3. Passer en revue les modales du projet et corriger uniquement celles qui s'écartent du standard (structure en-tête/corps, grille de formulaire, disposition et espacement des boutons).

## Détails techniques
- `src/components/ui/dialog.tsx` : conserver `DialogContent`, `DialogHeader`, `DialogBody`, `DialogFormGrid` ; ajouter une primitive d'actions (variantes « pleine largeur » et « alignées à droite ») afin d'uniformiser l'espacement.
- Modales à auditer : employés (création, import), départements, contrats, recrutement (offres, candidats, QR code, publication réseaux), congés (demande, confirmation), pointage (zones), paramètres/facturation.
- Aucun changement de logique métier : uniquement structure et présentation.
