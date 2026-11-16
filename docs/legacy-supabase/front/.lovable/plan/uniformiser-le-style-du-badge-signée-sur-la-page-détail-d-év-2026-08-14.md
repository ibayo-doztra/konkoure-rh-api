# Uniformiser le style du badge "Signée" sur la page détail d'évaluation

## Objectif
Appliquer au badge de statut de la page détail d'une évaluation le même style visuel que celui utilisé dans la liste des évaluations (`reviews.index.tsx`), notamment pour l'état `signed`.

## Constat actuel
- **Liste (`reviews.index.tsx`)** : le statut est rendu par un `span` avec la classe `REVIEW_STATUS_CLS[status]`, qui donne `signed` → `bg-success/15 text-success` (vert).
- **Détail (`reviews.$id.tsx`)** : le badge est `<Badge variant="secondary">{t(`reviews.statuses.${review.status}`)}</Badge>`, donc gris/secondaire pour tous les statuts, y compris `signed`.

## Correctifs
1. **Définir la même palette de classes** dans `src/routes/_authenticated.app.performance.reviews.$id.tsx`, au même niveau que `SCORE_VALUES` :
   ```text
   const REVIEW_STATUS_CLS: Record<string, string> = {
     not_started: "bg-muted text-muted-foreground",
     in_progress: "bg-warning/10 text-warning",
     sent_back: "bg-destructive/10 text-destructive",
     submitted: "bg-success/10 text-success",
     validated: "bg-success/15 text-success",
     signed: "bg-success/15 text-success",
   };
   ```
2. **Remplacer le badge secondaire** dans les `actions` du `PageHeader` par un `Badge` utilisant `REVIEW_STATUS_CLS[review.status]` :
   ```text
   <Badge className={REVIEW_STATUS_CLS[review.status] ?? REVIEW_STATUS_CLS.not_started}>
     {t(`reviews.statuses.${review.status}` as any)}
   </Badge>
   ```
3. **Vérification visuelle** : ouvrir une évaluation au statut `signed` et s'assurer que le badge est vert, comme dans la liste.

## Fichiers concernés
- `src/routes/_authenticated.app.performance.reviews.$id.tsx`

## Non concerné
- Aucune modification de logique métier, de base de données ou de traduction.
