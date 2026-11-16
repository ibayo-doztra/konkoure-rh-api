# Logo cliquable dans l'en-tête de toutes les pages

## Objectif

Afficher le logo Konkouré (« K » + texte), cliquable vers la landing page, en haut à gauche de chaque page : landing, pages d'authentification (/login et /signup), pages publiques de paiement et espace applicatif — avec le même rendu clair/sombre partout.

## Ce qui change

1. **Composant partagé** : extraire le logo actuellement défini dans `src/components/landing/SiteHeader.tsx` vers `src/components/brand/Logo.tsx` (source unique). `SiteHeader`, `SiteFooter` et `paiement.index.tsx` réexportent/importent depuis ce nouveau fichier, sans changement visuel.
2. **Pages d'authentification** (`/login`, `/signup`, `/reset-password`, `/invitation`, `/onboarding/organization`) : ajouter un en-tête léger contenant le logo aligné à gauche, au-dessus de la carte du formulaire.
3. **Pages de paiement publiques** (`/paiement/suivi`, `/paiement/retour`) : même logo en haut, comme déjà fait sur `/paiement`.
4. **Espace applicatif** (`src/components/AppHeader.tsx`) : afficher le logo Konkouré à côté du bouton de bascule de la barre latérale, cliquable vers `/`. Le logo de l'organisation reste affiché dans la barre latérale (inchangé).

## Détails techniques

- Le composant utilise `<Link to="/">` de TanStack Router et les tokens sémantiques existants (`gradient-primary`, `text-primary-foreground`), donc le thème clair/sombre est déjà géré ; aucune couleur codée en dur.
- Ajout d'une variante compacte (icône seule sur très petits écrans dans l'en-tête app) via classes responsives, sans nouvelle logique.
- Aucun changement de logique métier, de données ou de routes.

## Vérification

- Chaque page listée affiche le logo en haut à gauche et le clic ramène à `/`.
- Rendu correct en clair et sombre, et sur mobile (pas de débordement dans l'en-tête app).