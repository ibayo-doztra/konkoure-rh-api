# En-tête et fil d'Ariane fixes au défilement

## Objectif

Sur toutes les pages de l'application, la barre d'en-tête (recherche, langue, thème, notifications, profil) et le fil d'Ariane doivent rester visibles en haut de l'écran lorsqu'on fait défiler le contenu.

## Ce qui change

1. **En-tête** : reste collé en haut de la zone de contenu, avec son fond translucide et son flou déjà en place, au-dessus du contenu qui défile dessous.
2. **Fil d'Ariane** : reste collé juste sous l'en-tête (il ne disparaît plus au défilement), avec un fond opaque pour éviter la superposition du texte, et sa bordure de séparation conservée.
3. Le comportement s'applique automatiquement à toutes les pages, puisque les deux éléments sont dans la mise en page commune de l'espace connecté.
4. Sur mobile comme sur desktop : hauteurs respectées, aucun contenu masqué au premier affichage.

## Détails techniques

- `src/routes/_authenticated.tsx` : la colonne de contenu défile normalement dans la page ; l'en-tête reçoit `sticky top-0 z-30`, et le fil d'Ariane est sorti du padding du `main` pour être placé dans un conteneur `sticky top-16 z-20` avec `bg-background`.
- `src/components/AppHeader.tsx` : ajout de `sticky top-0 z-30` (le fond `bg-background/80 backdrop-blur-md` existant est conservé, `shrink-0` ajouté).
- `src/components/AppBreadcrumbs.tsx` : marges internes ajustées pour fonctionner comme bandeau fixe (padding vertical + horizontal alignés sur le `p-6` du contenu) ; retour `null` inchangé quand il y a moins de deux niveaux, sans laisser d'espace vide.
- Aucun changement de logique métier, de requêtes ou de traductions.
