# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Backend API de **Konkouré**, SIRH SaaS B2B multi-tenant (Guinée : `Africa/Conakry`, GNF, FR par défaut + EN). AdonisJS v7 (kit officiel `api`), consommé par le frontend web TanStack Start, l'app Flutter de pointage et des intégrations (Djomy, n8n, Resend). Il remplace un backend Supabase existant, qui sert de référence fonctionnelle et non d'architecture.

**Les spécifications dans `docs/` font foi** sur le code. Point d'entrée : `docs/00-HANDOFF.md` (décisions déjà prises à ne pas rediscuter, glossaire, interdits), puis `docs/backend/00-README.md` → `15-*.md`. Ne jamais inventer un endpoint, un champ ou une règle métier absent de `docs/` : signaler le manque et demander. Les références à `docs/frontend/` et `docs/backend/skills/` pointent vers des dossiers qui n'existent pas encore dans ce dépôt.

## État actuel vs cible

Livré : auth complète, `/me` (profil, sessions, organisations, droits par organisation, export RGPD `GET /me/export` et suppression du compte `DELETE /me`), création d'organisation avec essai de 30 jours, invitations, `/org` (détail, réglages, logo, suppression logique, purge à 30 jours `organizations:purge` et restauration par root, membres), départements, employés (documents, photo, import et export CSV/XLSX), contrats (dépôt du document, job `contracts:expiring`) et compétences (module RH), registre `files` (logos et pièces de congé compris, purge des orphelins `files:purge-orphans`), pointage (zones, badges NFC, scan, kiosque, pointage pour soi, synchronisation hors-ligne, historique et corrections, partitions mensuelles, agrégats `attendance_days` et tâches `attendance:*`, horaires de travail `work_schedules` avec services de nuit, retard et ponctualité, `GET /attendance`, `GET /today`, export des pointages), congés (demandes, décisions, soldes et ledger, ajustement, calendrier, pièce jointe, e-mails, tâches planifiées `leaves:*`) et jours fériés, `/org/entitlements`, notifications in-app (`/me/notifications`, émises par les congés, contrats et badges, purge à 180 jours), tableau de bord `GET /org/dashboard` (dont recrutement, masse salariale et période précédente), performance (cycles, plans, objectifs et activités, OKR avec résultats clés et check-ins, évaluations et leurs e-mails, feedback et réalisations, bloc performance du tableau de bord, tâches `goals:mark-late`, `okr:checkin-reminder` et `reviews:reminders`), annuaire des employés, recrutement (offres, QR, pages carrières publiques, tâche `jobs:auto-close`, candidatures publiques et pré-contrôle, candidats, pipeline, notes, historique, embauche, webhook n8n et scoring IA des CV, journal `webhook_receipts`), talents (plans de succession, matrice de compétences, scores et grille 9-box), facturation (lecture de l'abonnement, des offres, de l'usage, des paiements et factures, annulation et réactivation, tâche `subscriptions:lifecycle`, paiement Djomy par Orange Money, MTN MoMo et carte avec montée au prorata et descente programmée, webhook signé et vérification serveur, factures PDF, tâches `payments:*`, paiement avant inscription et rattachement), publication sociale (page entreprise LinkedIn et pages Facebook, OAuth, publication des offres, suggestion IA, tâche `social:refresh-tokens`), IA (passerelle OpenAI, crédits mensuels, journal `usage_events`, suggestion d'OKR, synthèse d'évaluation, génération d'annonce, quota du scoring n8n), back-office plateforme (`/platform` : accès admin `support`/`root`, tableau de bord, organisations, abonnements, suspension, offres, comptes et rôles, bannissement, impersonation, admins plateforme, réglages et `modules_open_for_testing`, paiements et rapprochement, demandes de démo, journaux audit/système/usage, santé), sondes `/health` et `/health/ready`, métriques Prometheus `/metrics` sur un port interne (`METRICS_ENABLED`, `METRICS_PORT`, `start/metrics.ts`). Socle : tenant, `TenantRepository`, RLS, rôles SQL (`konkoure_app`, `konkoure_worker`, `konkoure_readonly`, purge des tables en insertion seule par `purge_append_only_rows`), index et partitions (`0130`, `0131`, `usage_events` partitionnée par `0141`), Bouncer, entitlements, idempotence, BullMQ, Drive, Docker, CI.

Reste à faire : plus rien de ce que `docs/` décrit. Toute nouvelle fonctionnalité doit d'abord être spécifiée dans `docs/`.

Ajouter une dépendance externe, changer un contrat d'endpoint existant ou écrire une migration destructive : **demander d'abord** (docs/backend/13 §8).

## Branches

Toute branche (`feat/…`, `fix/…`, `chore/…`) part de `develop` à jour (`git fetch && git checkout -b feat/x origin/develop`) et sa PR vise **`develop`**. Seule `develop` est fusionnée dans `main`, par une PR `develop` → `main`. `main` est protégée (PR obligatoire, CI verte) et le workflow `Branch policy` (`.github/workflows/branch-policy.yml`) fait échouer toute PR vers `main` qui ne vient pas de `develop`.

## Commandes

Gestionnaire de paquets : **pnpm** (pas npm).

Redis : `docker compose up -d redis` (Docker Desktop doit tourner). **Les tests en ont besoin** (idempotence, cache des droits, BullMQ), même si le limiteur y est en mémoire. Sans `RESEND_API_KEY`, les e-mails échouent et sont seulement journalisés.

Fichiers : `FILE_STORAGE_DISK=fs` (hors production uniquement) stocke les envois sur le disque local `storage/` au lieu de S3 et sert les liens signés sous `/uploads` ; utile sans S3 (e2e du front). Le code passe toujours par `diskFor()` (`#shared/files/storage_disks`), jamais par `drive.use('s3')` en dur.

Files : `QUEUE_DRIVER=sync` (défaut hors production) exécute les jobs dans le processus ; avec `bullmq`, lancer `node ace queue:work`, qui déclare aussi les tâches planifiées (job schedulers BullMQ, `SCHEDULES` de `app/shared/queue/jobs.ts`). En `sync`, rien n'est planifié : `node ace schedule:run <job>` (ex. `leaves.end`) lance une tâche à la main.

Base : **PostgreSQL** (serveur local, PostgreSQL 18 en dev) configuré via les variables `DB_*` de `.env`. Bases `konkoure` (dev) et `konkoure_test` (sélectionnée par `.env.test`). Pour migrer la base de test : `NODE_ENV=test node ace migration:run`. Sur la machine de dev Windows, Smart App Control bloque aussi `citext.dll` du PostgreSQL natif : les tests tournent sur le PostgreSQL 18 de Docker (`docker compose up -d postgres`, port 5433, bases `konkoure` et `konkoure_test`), sélectionné par `.env.test.local` (ignoré par git : `DB_PORT=5433`, `DB_PASSWORD=postgres`). Tout script qui lit `.env` doit passer par le parseur d'AdonisJS (`EnvParser`) : `$` y est interpolé et les échappements sont interprétés, un parsing naïf donne de mauvaises valeurs.

```bash
pnpm dev                     # node ace serve --hmr → http://localhost:3333
pnpm test                    # tous les tests Japa (suites unit + functional)
node ace test unit           # une seule suite
node ace test --files=tests/functional/auth/login.spec.ts   # un fichier
node ace test --tests="titre du test"                       # un test par titre (aussi --groups, --tags)
pnpm typecheck               # tsc --noEmit
pnpm lint                    # eslint
pnpm format                  # prettier
pnpm build && pnpm start     # build de prod puis node bin/server.js
node ace migration:run       # migre ET régénère database/schema.ts (exclu d'ESLint/Prettier)
node ace make:<controller|model|migration|validator|transformer|test|…> <nom>
node ace list:routes
node ace subscription:grant <organizationId> pro --days=30   # plan actif hors paiement (e2e, support local), refusé en production
node ace platform:grant <email> <support|root> [--revoke]    # admin plateforme hors back-office (e2e, support local), refusé en production
```

`node ace check`, cité dans `docs/backend/10` et `13`, **n'existe pas** : utiliser `pnpm typecheck && pnpm lint`.

## Contournement swc / Smart App Control (ne pas supprimer)

Sur la machine de dev Windows, Smart App Control bloque le binaire natif `@swc/core`, utilisé par `@poppinss/ts-exec` pour exécuter le TypeScript (`ace`, serveur, tests). `pnpm-workspace.yaml` remplace donc `@swc/core` par `tools/swc-wasm-shim/`, une couche qui délègue à `@swc/wasm` et retire les options `undefined` que la version wasm rejette. Symptômes en cas de régression : `Failed to load native binding` ou `invalid type: unit value, expected path string`. Sur une machine sans ce blocage (CI, Docker), l'override peut être retiré.

## Architecture du code existant

- **Fichiers générés, à ne pas éditer** :
  - `database/schema.ts` : classes `*Schema` régénérées par `migration:run` (ou `node ace schema:generate`). Les modèles (`app/models/`) **étendent** ces classes et ajoutent `static table`, `selfAssignPrimaryKey = true` et un hook `@beforeCreate` qui pose `newId()` (uuid v7). Les enums PostgreSQL, `citext` et `jsonb` sont typés par `database/schema_rules.ts` : y ajouter chaque nouvelle colonne de ce type, sinon elle sort en `any`.
  - `.adonisjs/` : générés par les hooks `init` d'`adonisrc.ts`. Les controllers des modules sont importés paresseusement dans `start/routes/<module>.ts` (`() => import('#modules/…')`), pas via `#generated/controllers`.
- **Modules** : `app/modules/<domaine>/{controllers,services,repositories,validators,transformers,mails}` (alias `#modules/*`), code transverse dans `app/shared/` (alias `#shared/*`). Les services et repositories sont des classes exportées aussi en singleton par défaut (`export default new XService()`).
- **Erreurs** : lever `new AppException('E_…')` (`#shared/exceptions/app_exception`), le statut HTTP est fixé par le code. Pour une erreur de champ : `AppException.validation(field, rule, 'validation.<clé i18n>')`. `app/exceptions/handler.ts` rend toujours `{ error: { code, message, requestId, details } }`, traduit `errors.<code>` et les messages `validation.*`, et ne renvoie jamais de pile.
- **Réponses** : `ctx.serialize(objet)` enveloppe dans `{ data }`, mais **pas les tableaux** (renvoyés bruts) : pour une liste, renvoyer `{ data: [...] }`. Les DTO de sortie sont des fonctions explicites (ex. `app/modules/users/transformers/me_transformer.ts`) : on ne sérialise jamais un modèle directement.
- **Middleware** (`start/kernel.ts`) : côté serveur, `request_context` (uuid v7 en `X-Request-Id`, logger enfant), JSON forcé, langue (`Accept-Language`, fr par défaut), CORS ; côté routeur, bodyparser, shield, auth. `middleware.auth()` renvoie `E_TOKEN_EXPIRED` pour un jeton expiré et refuse les comptes inactifs. Limiteurs globaux dans `start/limiter.ts` (300/min/IP, 600/min/utilisateur) ; les budgets propres à un endpoint sont dans les services.
- **Tenant et RLS** : toute table tenant appelle `SELECT enable_tenant_rls('<table>')` dans sa migration. Toute lecture ou écriture passe par `withTenant(orgId, trx => …)` et un repository qui étend `TenantRepository` (`#shared/base/tenant_repository`). Le superutilisateur contourne la RLS : `DB_APP_ROLE=konkoure_app` (activé dans les e2e du frontend) l'applique au serveur HTTP. Les tests Japa vérifient la RLS avec `SET LOCAL ROLE konkoure_app`.
- **Droits** : `entitlementService` (`#modules/billing/services/entitlement_service`, cache 60 s, à invalider à chaque changement d'abonnement) et `middleware.entitlement({ module })` après `tenant`.
- **Audit et e-mails** : `auditService.record(trx, contexte, entrée)` dans la transaction de la mutation (`audit_logs` en insertion seule) ; e-mails via `dispatchMail()` après le commit, par BullMQ en production (un échec est journalisé, jamais remonté). Nouveau job : l'ajouter à `#shared/queue/jobs`.
- **Pas de session** : le paquet `@adonisjs/session` a été retiré ; le seul cookie est le refresh token web (`konkoure_refresh`).
- **Validation** : VineJS dans `app/modules/*/validators/`. Messages traduits par `resources/lang/{fr,en}/validator.json` ; autres traductions : `errors.json`, `emails.json`, `validation.json`. `start/validator.ts` convertit les dates VineJS en `DateTime` Luxon.
- **Tests** : `tests/bootstrap.ts` simule le mailer pour toute la suite. Utilitaires : `tests/helpers/auth.ts` (`createUser`, `createOrganization`, `grantRoles`, `apiLogin` qui ouvre une vraie session) et `tests/helpers/http.ts` (`expectStatus(requête, code)`, à préférer à `(await …).assertStatus()` que le lint refuse). Chaque groupe : `testUtils.db().withGlobalTransaction()` et `limiter.clear(['memory'])`.
- **Prettier** ignore `docs/` et `*.md` : `pnpm format` ne doit jamais reformater les spécifications.
- **Env** : toute variable est déclarée et validée dans `start/env.ts`. Pas de `process.env` ailleurs.

## Règles de la cible à appliquer à tout nouveau code

Détail dans `docs/backend/01`, `05`, `10`, `13` :

- Toute table métier porte `organization_id NOT NULL`. Toute requête passe par un repository scopé. Une ressource d'une autre organisation renvoie **404, jamais 403**.
- Autorisation uniquement dans des policies Bouncer, appelées depuis le controller avant toute mutation. Le controller ne contient ni requête Lucid ni logique métier.
- Identifiants `uuid` v7 générés applicativement, `timestamptz` en UTC, soft delete `deleted_at` sur les entités référencées.
- Erreurs au format `{ error: { code: 'E_…', message, requestId, details } }` (codes en docs/backend/01 §6). Pagination offset ou curseur selon le volume (§7). En-tête `Idempotency-Key` sur les mutations sensibles (§8).
- E-mails, appels HTTP et jobs déclenchés après commit, jamais dans la transaction.
- Ordre de création d'une fonctionnalité, gabarits et checklist : `docs/backend/13`. Chaque endpoint a au minimum des tests succès, refus par rôle, **isolation tenant** et validation (`docs/backend/10` §2).
- Code et identifiants en anglais, messages utilisateur via i18n fr/en, commits conventionnels (`feat(leaves): …`).

## Skills projet

`.claude/skills/konkoure-*` encodent ces règles par domaine. Toute fonctionnalité combine `konkoure-feature-workflow` + le skill du domaine + `konkoure-tenant-security` + `konkoure-testing-quality`, plus `api-contracts` / `database` / `auth-rbac` / `performance-scale` / `integrations-jobs` / `operations` selon ce qui est touché (catalogue et exemples : `docs/backend/14`). Les skills ne remplacent pas les docs. En cas de divergence, le document backend le plus spécifique tranche.
