# Correction du texte blanc au survol du sélecteur de collaborateur

## Constat

Au survol du champ du sélecteur de collaborateur (et de tout bouton `outline` de la plateforme), le texte devient blanc sur un fond violet, ce qui le rend illisible. L'image montre le trigger du sélecteur avec ce comportement.

Cause : la variante `outline` du composant `Button` utilise des couleurs codées en dur (`hover:bg-[#6C5FFC]`, `hover:text-white`, `hover:border-[#6C5FFC]`) au lieu des tokens sémantiques du thème. Cela force le texte en blanc au survol et ignore le mode sombre.

## Correctifs prévus

1. **Composant `Button`** : remplacer dans `src/components/ui/button.tsx` les valeurs hardcodées de la variante `outline` par les tokens sémantiques `primary` / `primary-foreground` / `border` :
   - `hover:bg-primary` au lieu de `hover:bg-[#6C5FFC]`
   - `hover:text-primary-foreground` au lieu de `hover:text-white`
   - `hover:border-primary` au lieu de `hover:border-[#6C5FFC]`
2. **Vérification** : s'assurer que le trigger du sélecteur de collaborateur reste lisible au survol en thème clair et sombre.
3. **Aucune autre modification** : le composant `EmployeeCombobox` et la page Évaluations ne changent pas.

## Détails techniques

- `src/components/ui/button.tsx` : variante `outline` du `cva`.
- Respect des tokens sémantiques du projet (pas de `bg-[#...]`, `text-white` hardcodés dans les composants).
- Vérification visuelle via preview sur le sélecteur de collaborateur de la page `/app/performance/reviews`.
