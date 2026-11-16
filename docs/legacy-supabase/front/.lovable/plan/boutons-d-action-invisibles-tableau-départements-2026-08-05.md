# Boutons d'action invisibles (tableau Départements)

## Constat

Dans le tableau des départements, la colonne « Actions » n'affiche qu'un rectangle pâle : les icônes Modifier / Supprimer ne sont pas visibles.

Cause : le style de base des boutons impose un padding horizontal fixe (`px-6`) qui n'est pas remis à zéro par la taille `icon` (`h-9 w-9`). Le padding consomme toute la largeur du bouton, l'icône est donc rognée / poussée hors du cadre.

## Correctifs

1. **Composant bouton** — la taille `icon` remet le padding à zéro (`p-0`) et centre l'icône. Cela corrige tous les boutons-icônes de la plateforme, pas uniquement cette page.
2. **Page Départements** — remplacer les deux boutons-icônes par le menu d'actions déjà utilisé ailleurs (`ActionMenu` : Modifier / Supprimer), pour rester cohérent avec les pages Recrutement et Contrats.
3. Vérification visuelle de la colonne Actions en thème clair et sombre.

## Détails techniques

- `src/components/ui/button.tsx` : variante `size.icon` → `h-9 w-9 p-0` (le `px-6` de la base est neutralisé).
- `src/routes/_authenticated.app.departments.tsx` : import de `ActionMenu`, cellule Actions rendue via `items` (Modifier → `openEdit`, Supprimer → `setToDelete`, variante destructive).
- Aucun changement de logique métier ni de requêtes.
