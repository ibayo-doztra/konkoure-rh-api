# Interface bilingue FR/EN cohérente + langue persistante

Aujourd'hui seuls 21 fichiers sur ~120 utilisent le système de traduction : la landing, la connexion, l'inscription, les carrières, le tableau de bord et les employés. Tout le reste (congés, contrats, départements, pointage, performance, talents, réglages, facturation, démo, paiement, modales, menus d'action, messages toast) est écrit en français en dur.

De plus, la langue choisie ne survit pas au rafraîchissement : la configuration force `fr` au démarrage, ce qui écrase la préférence enregistrée dans le navigateur.

## Ce qui change

**1. Langue persistante (correctif immédiat)**
- La langue sélectionnée est mémorisée et réappliquée à chaque chargement, y compris après rafraîchissement ou reconnexion.
- Nouveau visiteur sans préférence : la langue du navigateur est détectée (FR ou EN), avec repli sur le français.
- L'attribut de langue de la page suit la langue active (bon pour le SEO et les lecteurs d'écran).

**2. Traduction complète (périmètre retenu : app RH + pages publiques)**

Écrans traduits, par lot :
- Lot A — Socle : navigation latérale, en-tête, fil d'Ariane, pied de page, écran de chargement, page 404, messages d'erreur globaux, boutons et libellés communs (menus d'action, confirmations, états vides, pagination, filtres).
- Lot B — RH : employés (liste, fiche, formulaires, import), départements, contrats, congés et jours fériés.
- Lot C — Pointage & Talents : zones de travail, scan, journal de pointage, compétences, matrice 9-Box, succession.
- Lot D — Performance : objectifs, OKR, activités, réalisations, feedback, évaluations.
- Lot E — Compte & Facturation : réglages, intégrations, onboarding organisation, invitation, abonnement, page de paiement et suivi.
- Lot F — Public : demande de démo, ressources, pages de paiement public, textes de la landing restants.

Le back-office `/konkoureoffice` reste en français (hors périmètre).

**3. Cohérence**
- Les dates, nombres et montants s'affichent selon la langue active.
- Les messages de validation de formulaire et les notifications (succès/erreur) suivent la langue active, y compris les erreurs renvoyées par le serveur (traduites par code d'erreur, pas par texte brut).
- Les libellés métier (statuts de congé, types de contrat, rôles, catégories) proviennent d'un dictionnaire unique traduit, plus de tableaux de libellés français en dur.

## Détails techniques

- `src/lib/i18n.ts` : retirer `lng: "fr"` (c'est lui qui écrase la préférence stockée), garder `fallbackLng: "fr"`, détection `["localStorage", "navigator"]` avec `caches: ["localStorage"]` et clé stable `konkoure.lang`. Ajouter `react: { useSuspense: false }` pour éviter tout écran vide au SSR/hydratation.
- Éclater le fichier monolithique de 988 lignes en modules par domaine sous `src/locales/{fr,en}/*.ts` (common, nav, hrm, leaves, contracts, timeclock, performance, talents, billing, settings, public), agrégés dans `src/lib/i18n.ts`. Mêmes clés des deux côtés ; un test simple vérifie la parité des clés FR/EN.
- Remplacer les constantes de libellés (`ROLE_LABELS` dans `src/lib/permissions.ts`, `CONTRACT_TYPE_LABEL`, `CATEGORY_LABEL`, statuts de congé) par des clés i18n résolues au rendu.
- Formatage via `Intl` avec la locale active (`fr-FR` / `en-GB`) dans `src/lib/format.ts` et `src/lib/currency.ts`.
- Côté serveur (`*.functions.ts`), on ne traduit pas : les handlers renvoient un code d'erreur stable, le client affiche le message traduit.
- `head()` des routes publiques : titre et description déclinés selon la langue active.
- Aucun changement de base de données, d'RLS ni de logique métier.

## Livraison

Les lots sont livrés dans l'ordre A → F ; après le lot A la persistance et toute la navigation sont déjà bilingues, chaque lot suivant complète un domaine fonctionnel.
