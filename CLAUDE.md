# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Backend API de **Konkouré**, SIRH SaaS B2B multi-tenant (Guinée : `Africa/Conakry`, GNF, FR par défaut + EN). AdonisJS v7 (kit officiel `api`), consommé par le frontend web TanStack Start, l'app Flutter de pointage et des intégrations (Djomy, n8n, Resend). Il remplace un backend Supabase existant, qui sert de référence fonctionnelle et non d'architecture.

**Les spécifications dans `docs/` font foi** sur le code. Point d'entrée : `docs/00-HANDOFF.md` (décisions déjà prises à ne pas rediscuter, glossaire, interdits), puis `docs/backend/00-README.md` → `15-*.md`. Ne jamais inventer un endpoint, un champ ou une règle métier absent de `docs/` : signaler le manque et demander. Les références à `docs/frontend/` et `docs/backend/skills/` pointent vers des dossiers qui n'existent pas encore dans ce dépôt.

## État actuel vs cible

Phase 1 en cours : le **socle auth et `/me`** est livré (`/api/v1/auth/*` sauf invitations, `/api/v1/me`, `/me/password`, `/me/sessions`, `/me/organizations`). Reste à faire pour la cible de `docs/backend/` :

| Sujet | État | Reste à faire |
|---|---|---|
| Tables | `users`, jetons d'accès/refresh, `password_reset_tokens`, `organizations`, `user_roles`, `audit_logs` (partition DEFAULT), `platform_admins` | tout le reste de 03 §1 (invitations, RH, abonnements…), RLS et rôles SQL (0140) |
| Tenant | — | middleware `X-Organization-Id`, `TenantRepository`, `withTenant()`, Bouncer, entitlements, idempotence |
| `/me` | `employee`, `subscription`, `modules` renvoyés à `null`/`[]` | à remplir quand RH et facturation existeront |
| Absents | — | BullMQ (les e-mails partent par le messager en mémoire de `@adonisjs/mail`), drive, `POST /organizations` |

Ajouter une dépendance externe, changer un contrat d'endpoint existant ou écrire une migration destructive : **demander d'abord** (docs/backend/13 §8).

## Commandes

Gestionnaire de paquets : **pnpm** (pas npm).

Redis (limiteur) : `docker compose up -d redis` (Docker Desktop doit tourner). Les tests n'en ont pas besoin (`LIMITER_STORE=memory` dans `.env.test`). Sans `RESEND_API_KEY`, les e-mails échouent et sont seulement journalisés (`mail.dispatch_failed`).

Base : **PostgreSQL** (serveur local, PostgreSQL 18 en dev) configuré via les variables `DB_*` de `.env`. Bases `konkoure` (dev) et `konkoure_test` (sélectionnée par `.env.test`). Pour migrer la base de test : `NODE_ENV=test node ace migration:run`. Tout script qui lit `.env` doit passer par le parseur d'AdonisJS (`EnvParser`) : `$` y est interpolé et les échappements sont interprétés, un parsing naïf donne de mauvaises valeurs.

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
- **Audit et e-mails** : `auditService.record(trx, contexte, entrée)` dans la transaction de la mutation (`audit_logs` en insertion seule) ; e-mails via `dispatchMail()` après le commit (un échec est journalisé, jamais remonté).
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
