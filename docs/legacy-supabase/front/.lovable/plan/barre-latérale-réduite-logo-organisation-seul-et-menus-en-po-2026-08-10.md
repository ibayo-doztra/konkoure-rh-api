# Barre latérale réduite : logo organisation seul et menus en pop-out

## Objectif

Quand la barre latérale est réduite (mode icônes), n'afficher que le logo de l'organisation, correctement dimensionné pour la largeur du rail, et permettre d'ouvrir les groupes de navigation dans un petit panneau flottant à droite, qui se referme dès qu'on clique sur un élément.

## Ce qui change

1. **En-tête de la barre latérale**
   - Le logo Konkouré (wordmark) reste visible uniquement en mode déployé (déjà le cas).
   - En mode réduit, le cercle du logo de l'organisation est centré dans le rail et sa taille est ajustée pour ne pas déborder (carré aligné sur la largeur d'icône, sans marge latérale excédentaire).

2. **Groupes de navigation en pop-out**
   - En mode réduit, cliquer sur l'icône d'un groupe (RH, Recrutement, Performance, Pointage, Congés, Talents, Réglages) ouvre un panneau flottant à droite du rail, listant les sous-éléments du groupe avec leur libellé.
   - Le panneau se ferme automatiquement après le clic sur un sous-élément (navigation), ainsi qu'au clic à l'extérieur ou avec Échap.
   - Le groupe actif reste mis en évidence sur l'icône.
   - En mode déployé, le comportement actuel (accordéon dépliant) est conservé.

3. **Mobile** : inchangé (la barre latérale s'ouvre en tiroir déployé).

## Détails techniques

- `src/components/AppSidebar.tsx` : rendu conditionnel sur `collapsed`.
  - Mode déployé : `Collapsible` + `SidebarMenuSub` (existant).
  - Mode réduit : `Popover` (`@/components/ui/popover`) avec `side="right"`, `align="start"`, contenu réutilisant la même liste `g.items` (`Link` + libellé + badge éventuel), état contrôlé par groupe pour fermer via `onClick` du lien.
  - Le tooltip du bouton est désactivé en mode réduit lorsque le popover est ouvert pour éviter la superposition.
- En-tête : classes du conteneur adaptées (`justify-center` et suppression du padding horizontal en mode réduit), taille du cercle logo réduite (`h-8 w-8`) pour tenir dans le rail d'icônes.
- Aucun changement de données ni de logique métier.

## Vérification

- Sidebar réduite : seul le cercle organisation apparaît en haut, sans débordement ni scroll horizontal.
- Clic sur une icône de groupe : panneau flottant lisible en thème clair et sombre ; clic sur un lien = navigation + fermeture.
- Sidebar déployée : comportement d'origine intact.
