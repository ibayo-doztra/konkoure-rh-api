# Confirmation de refus, filtres congés responsives, sidebar tablette

## 1. Confirmation avant refus d'une demande de congés

Aujourd'hui le bouton « refuser » exécute l'action immédiatement, contrairement à la validation qui passe par une boîte de dialogue.

- Ajouter une boîte de confirmation de refus dans la page Congés, au même standard visuel que les autres modales (DialogContent > DialogHeader + DialogBody, actions dans DialogActions).
- Contenu : nom de l'employé, type de congé, période et nombre de jours demandés, plus un rappel que l'action est définitive.
- Actions : « Annuler » et « Confirmer le refus » (bouton destructif), avec état de soumission pour éviter le double clic.
- Le refus n'est envoyé qu'après confirmation.

## 2. Filtres de la liste des demandes

Les onglets « Toutes / En attente / Mes demandes » débordent de la carte sur petits écrans.

- L'en-tête de carte passe en colonne sur mobile et en ligne à partir de `sm`.
- La barre d'onglets devient défilable horizontalement et contrainte à la largeur du parent (largeur pleine sur mobile, automatique au-dessus), sans barre de défilement visible.
- Libellés légèrement compactés sur mobile pour tenir dans la largeur.

## 3. Sidebar responsive jusqu'aux tablettes

- Le seuil « mobile » du composant sidebar passe de 768 px à 1024 px : en dessous, la sidebar s'affiche en panneau superposé (offcanvas) déclenché par le bouton du header, et ne prend plus de place dans la mise en page. Au-dessus, comportement actuel inchangé.
- Les classes de bascule internes du composant sidebar (`md:`) sont alignées sur ce même seuil (`lg:`) pour que l'affichage fixe et l'affichage superposé ne se chevauchent pas.
- La fermeture automatique au clic sur un lien de navigation existe déjà et s'appliquera donc désormais aussi aux tablettes ; vérification que tous les liens (logo, éléments de groupes, sous-éléments, liens du bas) déclenchent bien cette fermeture.

## Détails techniques

- `src/routes/_authenticated.app.leaves.index.tsx` : nouveau composant `RejectLeaveDialog`, état `toReject`, en-tête de carte et `TabsList` responsives.
- `src/hooks/use-mobile.tsx` : `MOBILE_BREAKPOINT` à 1024 (hook utilisé uniquement par la sidebar).
- `src/components/ui/sidebar.tsx` : remplacement des variantes `md:` liées à l'affichage desktop de la sidebar par `lg:`.
- `src/components/AppSidebar.tsx` : vérification que `handleNavClick` est bien branché sur chaque lien.

Aucun changement en base de données.
