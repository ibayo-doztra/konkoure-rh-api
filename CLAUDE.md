# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Backend API de **Konkouré**, SIRH SaaS B2B multi-tenant (Guinée : `Africa/Conakry`, GNF, FR par défaut + EN). AdonisJS v7 (kit officiel `api`), consommé par le frontend web TanStack Start, l'app Flutter de pointage et des intégrations (Djomy, n8n, Resend). Il remplace un backend Supabase existant, qui sert de référence fonctionnelle et non d'architecture.

**Les spécifications dans `docs/` font foi** sur le code. Point d'entrée : `docs/00-HANDOFF.md` (décisions déjà prises à ne pas rediscuter, glossaire, interdits), puis `docs/backend/00-README.md` → `15-*.md`. Ne jamais inventer un endpoint, un champ ou une règle métier absent de `docs/` : signaler le manque et demander. Les références à `docs/frontend/` et `docs/backend/skills/` pointent vers des dossiers qui n'existent pas encore dans ce dépôt.

## État actuel vs cible

Le dépôt est encore le scaffold du kit API, très en deçà de la cible décrite dans `docs/backend/` :

| Sujet | Actuellement | Cible (docs/backend/00 §3, 01) |
|---|---|---|
| Structure | `app/controllers`, `app/models`… à plat | modules verticaux `app/modules/<domaine>/{controllers,services,repositories,validators}` + `app/shared/` |
| Couches | controller → modèle directement | Controller → Service → Repository (scopé `organization_id`) → Model |
| Auth | tokens d'accès + session (starter) | guard `access_tokens`, refresh token, argon2, Bouncer, RBAC par organisation |
| Routes | `start/routes.ts` unique | `start/routes/<module>.ts`, préfixes `/api/v1/{auth,me,org,platform,public,webhooks}` |
| Absents | — | Redis, BullMQ, limiter, mail, drive, i18n, tenant/entitlement/idempotency middlewares |

Ajouter une dépendance externe, changer un contrat d'endpoint existant ou écrire une migration destructive : **demander d'abord** (docs/backend/13 §8).

## Commandes

Gestionnaire de paquets : **pnpm** (pas npm).

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
  - `database/schema.ts` : classes `*Schema` régénérées par `migration:run` (`schemaGeneration` dans `config/database.ts`, règles de typage dans `database/schema_rules.ts`). Les modèles **étendent** ces classes, par exemple `class User extends compose(UserSchema, withAuthFinder(hash))`, au lieu de déclarer les colonnes. Après une migration, relancer `migration:run` pour mettre à jour les types.
  - `.adonisjs/` : générés par les hooks `init` d'`adonisrc.ts` (`indexEntities`, `generateRegistry` de Tuyau). Les routes référencent les controllers via `controllers.X` importé de `#generated/controllers`, pas par import direct. `.adonisjs/client/registry` donne les types de routes au client Japa et au frontend (Tuyau).
- **Réponses** : `providers/api_provider.ts` ajoute `ctx.serialize()`, qui enveloppe toujours dans `{ data }` et valide les métadonnées de pagination Lucid. Les controllers renvoient `serialize(XTransformer.transform(model))`. Les transformers (`app/transformers/`) choisissent explicitement les champs exposés : c'est là qu'on empêche la fuite de champs sensibles.
- **Middleware** (`start/kernel.ts`) : `force_json_response` global, puis bodyparser/session/shield/auth (route), `silent_auth` sur toutes les routes, `middleware.auth()` nommé à appliquer par groupe.
- **Validation** : VineJS dans `app/validators/`. `start/validator.ts` convertit globalement les dates VineJS en `DateTime` Luxon.
- **Imports** : alias de sous-chemins `#controllers/*`, `#models/*`, `#services/*`, etc. (`package.json` → `imports`). Les nouveaux dossiers de la cible (`app/modules`, `app/shared`, `app/repositories`…) devront y être ajoutés.
- **Tests** : `tests/bootstrap.ts` (plugins assert, api-client, auth et session api-client, assertions DB). Le serveur HTTP ne démarre que pour la suite `functional`. Le client est typé par le registry Tuyau. `.env.test` force `SESSION_DRIVER=memory`.
- **Env** : toute variable est déclarée et validée dans `start/env.ts`. Pas de `process.env` ailleurs.

## Règles de la cible à appliquer à tout nouveau code

Détail dans `docs/backend/01`, `05`, `10`, `13` :

- Toute table métier porte `organization_id NOT NULL`. Toute requête passe par un repository scopé. Une ressource d'une autre organisation renvoie **404, jamais 403**.
- Autorisation uniquement dans des policies Bouncer, appelées depuis le controller avant toute mutation. Le controller ne contient ni requête Lucid ni logique métier.
- Identifiants `uuid` v7 générés applicativement, `timestamptz` en UTC, soft delete `deleted_at` sur les entités référencées.
- Erreurs au format `{ error: { code: 'E_…', message, requestId, details } }` (codes en docs/backend/01 §6). Pagination offset ou curseur selon le volume (§7). En-tête `Idempotency-Key` sur les mutations sensibles (§8).
- E-mails, appels HTTP et jobs déclenchés après commit (`trx.after('commit', …)`), jamais dans la transaction.
- Ordre de création d'une fonctionnalité, gabarits et checklist : `docs/backend/13`. Chaque endpoint a au minimum des tests succès, refus par rôle, **isolation tenant** et validation (`docs/backend/10` §2).
- Code et identifiants en anglais, messages utilisateur via i18n fr/en, commits conventionnels (`feat(leaves): …`).

## Skills projet

`.claude/skills/konkoure-*` encodent ces règles par domaine. Toute fonctionnalité combine `konkoure-feature-workflow` + le skill du domaine + `konkoure-tenant-security` + `konkoure-testing-quality`, plus `api-contracts` / `database` / `auth-rbac` / `performance-scale` / `integrations-jobs` / `operations` selon ce qui est touché (catalogue et exemples : `docs/backend/14`). Les skills ne remplacent pas les docs. En cas de divergence, le document backend le plus spécifique tranche.
