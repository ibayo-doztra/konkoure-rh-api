# Plan : Adapter le bouton d'invitation à toutes les largeurs

## Contexte
Dans la liste des employés (`/app/employees`), chaque carte contient deux boutons côte à côte :
- **Voir**
- **Inviter à rejoindre** / **Renvoyer l'invitation**

Lorsque la largeur disponible est faible, le texte long du bouton d'invitation dépasse son propre bouton, et le bouton risque de déborder de la carte.

## Objectif
Faire en sorte que le texte du bouton d'invitation reste à l'intérieur du bouton (retour à la ligne si nécessaire), et que le bouton lui-même ne déborde jamais de la carte parente.

## Changements prévus

1. Modifier `src/routes/_authenticated.app.employees.index.tsx` dans la zone des deux boutons d'action (lignes ~454-477).
   - Remplacer la ligne de boutons simple `flex w-full ... gap-2` par une disposition `grid` responsive qui passe en pile sur mobile et en ligne sur plus d'espace :
     - Mobile : `grid-cols-1`
     - À partir de `sm` : `sm:grid-cols-2` (ou `sm:flex` si l'espace le permet)
   - Ajouter `min-w-0` au conteneur de chaque bouton pour permettre au texte de rétrécir.
   - Sur chaque bouton, ajouter :
     - `min-w-0` (pas de `min-w-20` fixe qui force le débordement)
     - `whitespace-normal` pour autoriser le retour à la ligne
     - `break-words` pour couper les mots si nécessaire
     - `w-full` pour occuper toute la largeur de sa cellule
     - `h-auto` et `py-2` pour laisser la hauteur s'adapter au texte sur plusieurs lignes
   - Isoler l'icône `Send` dans un conteneur `shrink-0` pour qu'elle ne soit pas écrasée par le texte.

2. Conserver les comportements existants :
   - Label dynamique : "Inviter à rejoindre" / "Renvoyer l'invitation"
   - `disabled={inviting === e.id}`
   - `onClick={() => void invite(e.id)}`
   - Variant `outline` et taille `sm`.

3. Vérifier visuellement dans le preview que :
   - Sur largeur desktop, les deux boutons restent côte à côte.
   - Sur largeur mobile/tablette, le texte passe à la ligne et reste dans le bouton.
   - La carte ne voit jamais son contenu horizontal dépasser.

## Non concerné
- La logique d'invitation (`invite`, `accountStates`, `inviting`, `canInvite`) reste inchangée.
- Le bouton "Voir" reste présent avec le même comportement ; seule sa gestion de la largeur est adaptée.
- Aucun changement serveur, base de données ou traduction.
