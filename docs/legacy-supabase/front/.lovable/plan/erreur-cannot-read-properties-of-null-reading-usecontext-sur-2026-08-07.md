# Erreur « Cannot read properties of null (reading 'useContext') » sur /admin

## Ce que montre le diagnostic

J'ai rechargé `/admin` dans un navigateur de test, une fois déconnecté et une fois avec une session connectée :

- Déconnecté : redirection normale vers `/login`, aucune erreur.
- Connecté : le back-office s'affiche correctement (KPI, organisations, offres, journal), aucune erreur JavaScript.

Le code de `/admin` n'est donc pas en cause. Les traces de la console montrent deux versions différentes du même bundle React chargées en même temps (deux empreintes de cache distinctes), et le plantage se produit dans le composant de métadonnées de la page, pas dans le back-office. C'est le symptôme classique d'un cache de prévisualisation devenu obsolète après l'ajout des nouveaux écrans d'administration : l'onglet ouvert continue d'utiliser d'anciens fichiers pendant que le serveur en sert de nouveaux.

## Ce que je propose

1. Rechargement forcé de la prévisualisation (le cache local se reconstruit) — cela suffit dans la grande majorité des cas et je le vérifie ensuite en ouvrant `/admin` connecté.
2. Ajouter un filet de sécurité dans la racine de l'application (`src/routes/__root.tsx`) : un `errorComponent` propre en français, avec un bouton « Recharger la page », au lieu de l'écran brut « Something went wrong! ». Ainsi, si un décalage de cache se reproduit après un déploiement, l'utilisateur voit un message clair et se rétablit en un clic.
3. Vérifier que la garde d'accès de `/admin` affiche bien l'écran « Accès restreint » plutôt qu'une erreur lorsque le compte n'est pas super-administrateur.

## Détails techniques

- `src/routes/__root.tsx` : ajout d'un `errorComponent` sur `createRootRouteWithContext`, rendu avec les tokens sémantiques du thème, sans dépendance au contexte du routeur (afin de rester affichable même en cas d'échec d'hydratation).
- Aucun changement de configuration Vite : la déduplication React est déjà gérée par `@lovable.dev/vite-tanstack-config`; y ajouter des options créerait de vrais doublons.
- Aucune modification de la logique métier ni des fonctions serveur `src/lib/admin/*`.
