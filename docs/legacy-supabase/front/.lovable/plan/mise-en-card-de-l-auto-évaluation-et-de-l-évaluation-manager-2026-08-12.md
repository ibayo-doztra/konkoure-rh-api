# Mise en card de l'auto-évaluation et de l'évaluation manager

Objectif : transformer les deux sections « Auto-évaluation » et « Évaluation manager » de la page de détail d'une évaluation en cartes visuellement séparées avec une ombre douce, afin de mieux les mettre en valeur dans le flux de la page.

## 1. Fichier concerné

- `src/routes/_authenticated.app.performance.reviews.$id.tsx`

## 2. Modifications prévues

### Section « Auto-évaluation » (actuellement `section` avec titre + textarea/score)

- Remplacer la balise `<section>` par un `<Card>` avec `shadow-sm` ou un token d'ombre sémantique du projet.
- Conserver le titre de section dans le `CardContent`, en gardant la même hiérarchie visuelle (`<h2>` ou en-tête de card).
- Conserver le `<Textarea>` éditable quand `canEditSelf` est vrai, et le paragraphe en lecture seule (`whitespace-pre-wrap`) sinon.
- Conserver le sélecteur de note et la légende des scores à l'intérieur de la carte.
- Maintenir l'espacement cohérent avec le reste de la page (`space-y-3` ou équivalent).

### Section « Évaluation manager » (actuellement `section` conditionnelle)

- Appliquer la même transformation : `<section>` → `<Card>` avec ombre douce.
- Conserver le titre, le textarea éditable pour le manager, le paragraphe en lecture seule pour l'employé, le sélecteur de note et le badge de soumission.
- Garder le rendu conditionnel (la section n'apparaît que si l'évaluation a été soumise ou s'il existe un retour manager).

## 3. Contraintes de style

- Utiliser uniquement les tokens sémantiques du projet (`bg-card`, `text-card-foreground`, `border`, `shadow-sm` ou variable d'ombre définie dans `src/styles.css`).
- Pas de couleur codée en dur.
- Pas de modification de la logique métier (états, permissions, mutations, notifications).
- S'assurer que les champs restent éditables dans les phases autorisées et lisibles en lecture seule.
- Vérifier le rendu responsive et en thème clair/sombre.

## 4. Validation

- Vérifier visuellement que les deux sections ressortent comme des cartes distinctes avec ombre douce.
- S'assurer que les textareas et les paragraphes restent fonctionnels et lisibles.
- Vérifier que les scores, badges et légendes ne sont pas décalés ou tronqués.
