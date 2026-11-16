# Style unique pour toutes les modales et confirmations

## Le modèle de référence (capture jointe)

Boîte centrée, coins arrondis, fond carte, ombre douce :
- Titre en gras
- Sous-titre en évidence (nom de l'élément concerné)
- Texte explicatif en gris (conséquences de l'action)
- Deux boutons en bas à droite : « Annuler » (contour) et l'action principale (plein, violet ou rouge selon la gravité)

Nouveauté demandée : le bouton « Annuler » devient rouge (contour, texte et fond léger) au survol et au clic.

## Ce qui sera fait

1. **Composant de confirmation unique**
   Le composant `ConfirmDialog` existant est enrichi pour coller à la capture : titre, sous-titre optionnel (nom de l'élément), description, et zone d'actions alignée à droite. Version compacte (largeur réduite) pour les confirmations, contrairement aux grandes modales de formulaire.

2. **Bouton Annuler en style « danger au survol »**
   Nouvelle variante de bouton `cancel` : apparence neutre au repos, bordure/texte/fond rouges au survol, au clic et au focus clavier. Appliquée à tous les boutons « Annuler » / « Retour » des modales.

3. **Remplacement des alertes natives du navigateur**
   Les 10 `confirm()` natifs sont remplacés par la boîte de confirmation :
   - Réglages : déconnexion d'une intégration, ouverture/clôture d'un cycle, suppression d'un plan
   - Performance : suppression d'un objectif, d'un OKR, d'une activité, d'une réalisation
   - Abonnement : annulation de l'abonnement
   - Badge NFC : révocation d'un badge

4. **Unification des `AlertDialog` restants**
   Les confirmations construites avec `AlertDialog` (départements, contrats, offres d'emploi, back-office offres) passent sur le même composant, pour un rendu strictement identique partout.

5. **Modales de formulaire**
   Les grandes modales gardent leur structure actuelle (en-tête + corps + actions) ; seul le bouton « Annuler » change de comportement au survol.

Tous les textes restent bilingues FR/EN ; les libellés manquants sont ajoutés aux fichiers de traduction.

## Détails techniques

- `src/components/ui/button.tsx` : ajout de la variante `cancel`.
- `src/components/ConfirmDialog.tsx` : props `subtitle`, `size="sm"`, actions via `DialogActions`, bouton d'annulation en variante `cancel`.
- `src/components/ui/dialog.tsx` : petit ajustement de largeur pour les confirmations (classe utilitaire, pas de refonte).
- Fichiers touchés pour les `confirm()` : `settings.integrations`, `settings.index`, `performance.okrs`, `performance.goals`, `performance.activities`, `performance.achievements`, `billing.index`, `employees/NfcBadgeCard`.
- Fichiers touchés pour les `AlertDialog` : `app.departments`, `app.contracts`, `recruitment.jobs.index`, `konkoureoffice.offres`.
- Aucune modification de logique métier ni de base de données.
