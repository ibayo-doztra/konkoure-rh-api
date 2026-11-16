# Fond blanc derrière le logo Doztra en mode sombre

## Objectif

Dans les deux pieds de page, le logo Doztra (fichier PNG) peut être difficile à lire en thème sombre. L'objectif est d'ajouter un fond blanc uniquement en mode sombre derrière ce logo, pour garantir sa lisibilité.

## Fichiers concernés

- `src/components/AppFooter.tsx` — pied de page de l'application connectée
- `src/components/landing/SiteFooter.tsx` — pied de page de la landing page

## Mise en œuvre

1. Dans `AppFooter.tsx`, envelopper l'image `doztra-logo.png` par un conteneur `span` avec :
   - `bg-white` (fond blanc technique pour la lisibilité du logo en mode sombre)
   - `dark:rounded-sm` (léger arrondi pour éviter les coins tranchants)
   - `dark:px-1` / `dark:py-0.5` (petite marge interne autour du logo)
   - `dark:inline-flex` (conserver le flux inline avec le texte adjacent)

2. Appliquer exactement le même traitement dans `SiteFooter.tsx` pour le même logo Doztra.

3. S'assurer que le wrapper est appliqué uniquement en mode sombre (`dark:`) afin que le rendu en mode clair reste inchangé.

4. Vérifier visuellement le rendu en mode clair et en mode sombre.

## Notes

- L'utilisation de `bg-white` est un cas technique de lisibilité de logo, similaire aux exceptions QR codes déjà établies dans le projet.
- Aucune modification de logique métier, de données ou de route n'est requise.
