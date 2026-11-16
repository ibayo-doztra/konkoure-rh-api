# Texte blanc sur les badges Approuvé / Validé

## Objectif
Améliorer la lisibilité des badges de statut approuvé (congés) et validé/signé (évaluations) en passant leur texte en blanc sur fond vert.

## Ce qui change
1. **Token sémantique `success-foreground` en mode sombre** — Passer la valeur de `oklch(0.15 0.04 270)` (texte foncé) à `oklch(0.99 0 0)` (blanc) pour que le texte des badges/ boutons verts soit blanc sur fond vert, en cohérence avec le mode clair.
2. **Badges d’évaluation en mode clair** — Dans `src/routes/_authenticated.app.performance.reviews.index.tsx`, remplacer `text-success` par `text-success-foreground` dans `REVIEW_STATUS_CLS` pour les statuts `submitted`, `validated` et `signed`, afin d’obtenir du blanc sur `bg-success/10` et `bg-success/15`.

## Détails techniques
- `src/styles.css` : modifier la ligne `--success-foreground: oklch(0.15 0.04 270);` du bloc `.dark` en `--success-foreground: oklch(0.99 0 0);`.
- `src/routes/_authenticated.app.performance.reviews.index.tsx` : dans `REVIEW_STATUS_CLS` :
  - `submitted: "bg-success/10 text-success"` → `submitted: "bg-success/10 text-success-foreground"`
  - `validated: "bg-success/15 text-success"` → `validated: "bg-success/15 text-success-foreground"`
  - `signed: "bg-success/15 text-success"` → `signed: "bg-success/15 text-success-foreground"`
- Vérification visuelle des badges de la liste des congés, du panneau de détail congés, de la liste des évaluations et de la page détail d’évaluation.

## Non concernés
- Les autres statuts (`not_started`, `in_progress`, `sent_back`) conservent leur couleur actuelle.
- Les autres composants (import d’employés, bouton Filtres) bénéficient automatiquement de la correction du token.
