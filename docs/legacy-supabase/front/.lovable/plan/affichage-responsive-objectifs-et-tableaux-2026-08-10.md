# Affichage responsive : objectifs et tableaux

Objectif : rendre les listes lisibles sur mobile et tablette, sans changer les données ni la logique métier. Uniquement présentation.

## 1. Un composant de tableau responsive partagé

Nouveau composant `src/components/ResponsiveTable.tsx` :

- Sur écran large (`md+`) : tableau classique (composants `ui/table`), avec défilement horizontal contrôlé si besoin.
- Sur mobile/tablette étroite : chaque ligne devient une carte empilée `label : valeur`, avec un champ « titre » mis en avant et les actions regroupées en bas à droite.
- Colonnes déclarées une seule fois : `{ key, header, cell, priority: "primary" | "normal" | "secondary", align }`. `secondary` = masqué en vue carte compacte, visible au dépliage.
- Gestion intégrée de l'état vide et d'un état de chargement (squelettes).

Règles responsive appliquées partout : `min-w-0` sur les conteneurs de texte, `truncate` sur les libellés d'une ligne, `shrink-0` sur icônes/badges, en-têtes en `grid-cols-[minmax(0,1fr)_auto]` puis `sm:flex`.

## 2. Page Objectifs (`/app/performance/goals`)

Réorganisation de la carte de groupe (aujourd'hui : titre, badges et deux boutons sur la même ligne, ce qui casse en colonne étroite) :

- En-tête de groupe en grille 2 colonnes sur mobile : bloc texte tronqué à gauche, chevron de dépliage à droite.
- Badges (statut du plan, propriétaire) regroupés sur une ligne dédiée qui passe à la ligne proprement.
- Métadonnées (période, compteurs d'objectifs) affichées en puces compactes, période sur une seule ligne `2026-06-01 → 2026-08-01` sans coupure.
- Actions (« Voir les objectifs », « Évaluer »/« Voir ») : pleine largeur empilées sur mobile, alignées à droite dès `sm`.
- Dans le détail d'un objectif : le `Select` de statut et le bouton supprimer passent sous le texte en mobile (`Select` pleine largeur) au lieu d'être serrés à droite.
- Barre de filtres en haut : `Tous les plans` + `Nouvel objectif` empilés en pleine largeur sur mobile, côte à côte dès `sm` (actuellement le bouton déborde de l'écran).

## 3. Pointages (`/app/timeclock/logs`)

Remplacement du `<table>` brut (aucun défilement, aucune adaptation) par `ResponsiveTable` :

- Colonnes : Employé (primaire), Arrivée, Départ, Durée, Statut.
- Vue mobile : une carte par session — nom + badge de statut en tête, puis Arrivée / Départ / Durée en paires libellé-valeur.
- Dates raccourcies en mobile (`jj/mm hh:mm`), format complet en desktop.

## 4. Passage sur tout le projet

Application du même composant / des mêmes règles aux listes existantes :

- RH : Départements, Congés, Jours fériés, Contrats, Employés.
- Recrutement : Offres, Candidats (le rail de colonnes horizontal reste, mais avec largeur de colonne adaptée au mobile).
- Performance : Revues, OKR, Feedback, Réalisations.
- Talents : Compétences, 9-box, Succession.
- Back-office KonkouréOffice : Organisations, Utilisateurs, Paiements, Journal, Demandes.
- Dialogue d'import d'employés : aperçu en tableau défilant contrôlé.

Chaque page conserve exactement ses colonnes, ses actions et ses données actuelles.

## Détails techniques

- Aucune modification de requêtes, de politiques d'accès ou de fonctions serveur.
- Tokens sémantiques uniquement (`bg-card`, `text-muted-foreground`, `border`), aucune couleur codée en dur.
- Les menus d'action existants (`ActionMenu`) sont réutilisés tels quels dans la vue carte.
- Vérification finale : build + captures en 390 px (mobile), 820 px (tablette) et 1280 px sur les pages Objectifs, Pointages, Départements et Organisations, en thèmes clair et sombre.
