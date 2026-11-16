# Renommer l'espace `/admin` en `/konkoureoffice`

## Objectif

Changer l'URL publique de l'espace d'administration plateforme : toutes les routes actuellement sous `/admin/*` doivent devenir `/konkoureoffice/*`. Le menu déroulant de l'utilisateur affichera dorénavant le lien vers `/konkoureoffice`.

## Contexte actuel

- L'espace admin est constitué d'une route layout `src/routes/admin.tsx` et de ses feuilles :
  - `admin.index.tsx` → `/admin/`
  - `admin.organisations.tsx` → `/admin/organisations`
  - `admin.offres.tsx` → `/admin/offres`
  - `admin.utilisateurs.tsx` → `/admin/utilisateurs`
  - `admin.demandes.tsx` → `/admin/demandes`
  - `admin.paiements.tsx` → `/admin/paiements`
  - `admin.reglages.tsx` → `/admin/reglages`
  - `admin.journal.tsx` → `/admin/journal`
- Les liens de navigation internes sont codés en dur avec `/admin` dans `src/routes/admin.tsx` et `src/routes/admin.index.tsx`.
- Le lien du menu utilisateur est dans `src/components/AppHeader.tsx` (`to: "/admin"`).
- `src/routeTree.gen.ts` est généré automatiquement par TanStack Router : il ne doit pas être édité manuellement, mais il sera régénéré après renommage des fichiers.

## Étapes de mise en œuvre

1. **Renommer les fichiers de routes** : chaque fichier `src/routes/admin[.suffixe].tsx` devient `src/routes/konkoureoffice[.suffixe].tsx` :
   - `admin.tsx` → `konkoureoffice.tsx`
   - `admin.index.tsx` → `konkoureoffice.index.tsx`
   - `admin.organisations.tsx` → `konkoureoffice.organisations.tsx`
   - `admin.offres.tsx` → `konkoureoffice.offres.tsx`
   - `admin.utilisateurs.tsx` → `konkoureoffice.utilisateurs.tsx`
   - `admin.demandes.tsx` → `konkoureoffice.demandes.tsx`
   - `admin.paiements.tsx` → `konkoureoffice.paiements.tsx`
   - `admin.reglages.tsx` → `konkoureoffice.reglages.tsx`
   - `admin.journal.tsx` → `konkoureoffice.journal.tsx`

2. **Mettre à jour les déclarations `createFileRoute(...)**` dans chaque fichier renommé pour utiliser le chemin `/konkoureoffice` correspondant.

3. **Mettre à jour les liens internes** :
   - Dans `src/routes/konkoureoffice.tsx` : remplacer les 8 liens de navigation `NAV` (`/admin/*` → `/konkoureoffice/*`).
   - Dans `src/routes/konkoureoffice.index.tsx` : remplacer les 3 liens de la section « Répartition par offre » (`/admin/organisations`, `/admin/offres`, `/admin/journal`).
   - Dans `src/components/AppHeader.tsx` : remplacer le lien du menu utilisateur par `/konkoureoffice`.

4. **Régénérer l'arbre de routes** : supprimer `src/routeTree.gen.ts` pour forcer sa régénération par le plugin TanStack Router au prochain démarrage du serveur de développement.

5. **Vérifier** : s'assurer qu'il ne reste plus de référence `/admin` dans les fichiers sources (hors l'historique de `.lovable/plan` et la documentation non liée), et tester que les nouvelles URLs (`/konkoureoffice`, `/konkoureoffice/organisations`, etc.) fonctionnent.

## Notes

- Aucune logique métier, aucune fonction serveur ni aucune table ne changent : seule la route publique et les liens sont renommés.
- Les imports relatifs à `@/lib/admin/*` restent inchangés (ce sont des noms de modules internes, pas des URLs).
- Les balises `robots: noindex, nofollow` restent en place sur toutes les routes de l'espace admin.
