# Badge OKR « Atteint » sans hover

## Objectif
Sur la page Objectifs en mode OKR, le badge « Atteint » (tous les résultats clés cochés) doit conserver le style vert/success mais ne doit pas avoir d'effet au survol.

## État actuel
Dans `src/routes/_authenticated.app.performance.okrs.tsx`, le badge « Atteint » est actuellement :
```tsx
<Badge className="bg-success/15 text-success-foreground">{t("okrs.achieved")}</Badge>
```
Comme aucune `variant` n'est passée, le composant `Badge` applique la variante par défaut (`default`) qui inclut `hover:bg-primary/80`. Au survol, le fond bascule donc vers la couleur primaire au lieu de rester vert.

## Correctif
Remplacer le badge « Atteint » par une version qui utilise explicitement la variante `success` et neutralise le hover :
```tsx
<Badge variant="success" className="bg-success/15 text-success-foreground hover:bg-success/15">
  {t("okrs.achieved")}
</Badge>
```
Cela conserve le fond vert clair (`bg-success/15`) et le texte blanc en mode sombre / contrasté en mode clair, sans changement visuel au survol.

## Fichier concerné
- `src/routes/_authenticated.app.performance.okrs.tsx`

## Non concerné
- Badge « En cours » : garder le style actuel (`bg-warning/10 text-warning`).
- Aucune modification de données, traduction ou logique métier.
