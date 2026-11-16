# Sélecteur de collaborateur : affichage compact et repositionnement

## Constat

Sur la page **Évaluations de performance**, le sélecteur de collaborateur actuel affiche, dans sa zone de sélection, l’avatar, le nom complet **et** l’adresse e-mail. Le formulaire doit être simplifié pour ne montrer que le nom complet de la personne sélectionnée. De plus, le sélecteur doit être repositionné entre les onglets (filtres) et la carte/liste des évaluations, plutôt qu’au-dessus des onglets.

## Correctifs prévus

1. **Composant `EmployeeCombobox`** — ajouter une prop `triggerVariant` (valeurs possibles : `full` par défaut, `minimal`) qui, en mode `minimal`, masque l’avatar et l’e-mail dans le trigger pour ne laisser que le nom complet de l’employé sélectionné. L’affichage détaillé (avatar + nom + e-mail) est conservé dans la liste déroulante.
2. **Page Évaluations** — utiliser `triggerVariant="minimal"` pour le sélecteur de collaborateur.
3. **Repositionnement** — déplacer le bloc `<EmployeeCombobox>` de son emplacement actuel (au-dessus des onglets) à l’intérieur du `TabsContent value="mine"`, juste au-dessus de la liste des cards d’évaluation. Il reste masqué si l’utilisateur n’a pas de subordonnés.
4. **Vérification visuelle** — s’assurer que le sélecteur s’intègre proprement entre les onglets et le contenu, sans débordement, et que le trigger minimal reste lisible en thème clair et sombre.

## Détails techniques

- `src/components/employees/EmployeeCombobox.tsx` :
  - ajouter `triggerVariant?: "full" | "minimal"` aux props ;
  - dans `SelectedEmployeePreview`, si `triggerVariant === "minimal"`, ne rendre que le nom complet dans une simple balise de texte, sans `Avatar` ni e-mail.
- `src/routes/_authenticated.app.performance.reviews.index.tsx` :
  - supprimer le bloc `<div className="mb-4 sm:max-w-xs">` situé avant `<Tabs>` ;
  - insérer le même bloc au début du `TabsContent value="mine"`, avant le `visibleReviews.length === 0` ou la grille de cards ;
  - passer `triggerVariant="minimal"` au composant.
- Aucun changement de logique métier, de base de données ni de requêtes.
