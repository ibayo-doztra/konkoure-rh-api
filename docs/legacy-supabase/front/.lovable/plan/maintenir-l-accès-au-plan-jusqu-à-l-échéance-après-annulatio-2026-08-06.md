# Maintenir l'accès au plan jusqu'à l'échéance après annulation

## Situation actuelle

Aujourd'hui, dès qu'une organisation annule son abonnement, son statut passe à « annulé » et l'accès retombe immédiatement sur les modules de l'offre Gratuit — aux trois niveaux : règle en base de données, gardes serveur et interface. La date d'échéance (`periode_fin`) est pourtant conservée en base, mais elle n'est prise en compte nulle part.

Le message affiché à l'annulation promet pourtant « accès maintenu jusqu'à l'échéance » : le comportement actuel contredit cette promesse.

## Ce qui change

Une organisation qui annule garde l'intégralité de son offre (modules, plafond d'employés, crédits IA) jusqu'à la date d'échéance de la période déjà payée. Passé cette date, elle bascule automatiquement sur l'offre Gratuit — sans intervention manuelle.

- Annulation avec échéance future → tous les modules restent accessibles, aucun changement visible pour les utilisateurs.
- Échéance dépassée → menu, routes et écritures reviennent au périmètre Gratuit.
- Sur la page Abonnement : mention claire « Annulé — accès jusqu'au JJ/MM/AAAA », puis « Offre expirée » une fois la date passée.

Le cas « impayé » (`past_due`) n'est pas modifié par cette demande : il continue de retomber immédiatement sur Gratuit.

## Détails techniques

Introduire une notion unique d'« offre effective » : le plan est actif si `statut_abo` vaut `active`/`trialing`, **ou** si `statut_abo = 'canceled'` et `periode_fin > now()`.

1. **Base de données** (migration) — mettre à jour `private.org_has_module` pour appliquer cette condition avant de retomber sur les modules du plan `gratuit`. Toutes les règles restrictives déjà posées sur les 23 tables héritent du correctif, sans les modifier.
2. **Serveur** — `src/lib/entitlements.server.ts` : remplacer le test `ACTIVE.has(statut_abo)` par la même règle (lire aussi `periode_fin` dans la requête).
3. **Client** — `src/hooks/useSubscription.ts` : même règle pour le calcul de `modules` ; exposer un indicateur `expiresAt` / `isGraceCanceled` pour l'affichage.
4. **Interface** — `src/routes/_authenticated.app.billing.index.tsx` : libellé de statut enrichi (« Annulé — accès jusqu'au … » / « Offre expirée ») et badge d'état cohérent.
5. Aucun changement dans `cancelSubscription` : il conserve déjà `periode_fin` intacte.
