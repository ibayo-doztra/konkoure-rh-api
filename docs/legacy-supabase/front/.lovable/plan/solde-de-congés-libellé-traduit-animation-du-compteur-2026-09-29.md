# Solde de congés : libellé traduit + animation du compteur

## Constat
- Le libellé brut « LEAVES.MYBALANCE » visible sur la capture vient d'un aperçu non rafraîchi : la clé `leaves.myBalance` existe déjà dans les traductions FR (« Mon solde de congé ») et EN (« My leave balance »), et la page `/app/leaves` affiche bien le libellé traduit (vérifié dans le live preview).
- Reste à faire : l'animation du nombre de jours, qui compte de 0 jusqu'au solde réel à l'apparition.

## Modifications

1. **Nouveau hook `src/hooks/useCountUp.ts`**
   - `useCountUp(target: number | null, options)` : anime la valeur affichée de 0 vers `target` avec `requestAnimationFrame`, easing ease-out, durée ~900 ms.
   - Démarre à 0, ne tourne que côté client (aucun décalage SSR), et se rejoue quand `target` change.
   - Retour : nombre arrondi pour l'affichage (décimales possibles pour les fractions de jour, ex. 4,5).

2. **Page des congés `src/routes/_authenticated.app.leaves.index.tsx`**
   - Le solde « Mon solde de congé » s'anime de 0 au solde réel quand la donnée arrive (et quand elle change).
   - Même animation pour « Jours en attente d'approubation » quand il est affiché, pour la cohérence visuelle.
   - Formatage via `Intl.NumberFormat` respectant la langue active.

3. **Carte `src/components/employees/LeaveBalanceCard.tsx` (fiche employé)**
   - Même compteur animé sur le solde affiché, pour que les deux écrans se comportent à l'identique.

## Détails techniques
- Un seul hook partagé, aucun besoin de dépendance externe (pas de framer-motion requis) : `requestAnimationFrame` + interpolation.
- Rien ne change côté données : `getEmployeeLeaveBalance` est déjà appelé par les deux écrans.
- Aucun changement de backend, de RLS ni de traductions nécessaires (les clés FR/EN existent).

## Vérification
- Playwright sur `/app/leaves` : libellé traduit visible, valeur animée de 0 au solde réel (captures à ~200 ms et après la fin de l'animation).
- Build OK.
