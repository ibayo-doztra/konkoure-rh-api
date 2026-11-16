# Deux logos côte à côte dans la barre latérale

## Objectif

Retirer le logo Konkouré de l'en-tête de l'application et l'afficher dans l'en-tête de la barre latérale, à droite du logo de l'organisation (là où figure actuellement « Doztra / SIRH »).

## Ce qui change

1. **En-tête app** (`src/components/AppHeader.tsx`) : suppression du `<Logo responsive />` (le bouton de bascule de la barre latérale et la recherche restent inchangés).
2. **Barre latérale** (`src/components/AppSidebar.tsx`) : dans le `SidebarHeader`, la ligne devient :
   - à gauche, le cercle du logo de l'organisation (inchangé : image `logo_url` ou initiale sur dégradé) ;
   - à droite, le logo complet Konkouré (`<Logo variant="full" />`), à la place du bloc texte « Nom org / SIRH ».
   - En mode réduit (sidebar collapsed), seul le cercle de l'organisation reste visible.
3. Le nom de l'organisation reste accessible via l'attribut `title`/`alt` du cercle, pour ne pas perdre l'information.

## Détails techniques

- Réutilisation du composant existant `@/components/brand/Logo` (plaque blanche automatique en thème sombre déjà gérée), hauteur réduite pour tenir dans l'en-tête de la sidebar.
- Le logo Konkouré reste un lien vers `/` ; le cercle organisation garde son lien actuel — les deux liens sont séparés pour éviter un lien imbriqué.
- Aucun changement de données ni de logique métier.

## Vérification

- Les deux logos apparaissent côte à côte en haut de la barre latérale, en clair et en sombre, sans débordement en 1280px et en mobile.
- Plus aucun logo Konkouré dans l'en-tête haut de l'application.
