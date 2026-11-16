# Plan : Ajouter le logo Konkouré sur la page de paiement

## Objectif
Afficher le logo Konkouré en haut à gauche de la page `/paiement` et le rendre cliquable vers la landing page (`/`).

## Implémentation technique
- Réutiliser le composant `Logo` existant exporté par `src/components/landing/SiteHeader.tsx`.
- L'insérer au-dessus du conteneur principal de `src/routes/paiement.index.tsx` (avant le titre), aligné à gauche.
- Supprimer les imports devenus inutiles si nécessaire (aucune suppression de logique fonctionnelle).
- Le composant `Logo` utilise déjà `<Link to="/">` et s'adapte au thème clair/sombre via les tokens sémantiques.

## Vérification
- Prévisualiser `/paiement` : le logo « K + Konkouré » doit apparaître en haut à gauche.
- Cliquer sur le logo doit rediriger vers `/` sans rechargement inutile.
- Vérifier que le rendu reste correct en mode clair et sombre.