# Backend Konkouré — Spécifications techniques AdonisJS v7

> **Statut : source de vérité.** Ce dossier décrit intégralement le backend API à
> construire. Toute décision d'implémentation doit s'y référer. En cas de doute
> entre le code existant (frontend TanStack Start + Supabase) et ce dossier,
> **ce dossier fait foi**.

## 1. Contexte

Konkouré est une plateforme SIRH B2B multi-tenant destinée au marché africain
(référence géographique par défaut : **Guinée**, Conakry, `lat 9.6412`,
`lng -13.5784`, devise **GNF**, fuseau **Africa/Conakry (UTC+0)**).

L'existant est une application TanStack Start avec Supabase (PostgreSQL + RLS +
server functions). Le nouveau backend est un **service API AdonisJS v7 autonome**,
consommé par :

- le frontend web (TanStack Start, réécrit pour appeler l'API) ;
- l'application mobile **Flutter** (pointage NFC / géolocalisé) ;
- des intégrations externes (Djomy pour les paiements, n8n pour le scoring IA,
  Resend pour l'e-mail, réseaux sociaux).

Volumétrie cible : plusieurs centaines d'organisations, pics de pointage
concentrés (8h–9h et 17h–18h), soit plusieurs milliers de requêtes/minute avec
des rafales. L'architecture doit être **stateless et horizontalement scalable**.

## 2. Ordre de lecture

| # | Fichier | Contenu |
|---|---------|---------|
| 01 | [`01-architecture.md`](./01-architecture.md) | Structure du projet, couches, conventions HTTP |
| 02 | [`02-schema-db.md`](./02-schema-db.md) | Schéma PostgreSQL repensé, table par table |
| 03 | [`03-migrations-models.md`](./03-migrations-models.md) | Migrations Lucid, modèles, seeders, factories |
| 04 | [`04-auth-rbac.md`](./04-auth-rbac.md) | Auth native AdonisJS, tokens, matrice de rôles |
| 05 | [`05-multi-tenant-securite.md`](./05-multi-tenant-securite.md) | Isolation tenant, règles de sécurité |
| 06 | [`06-api-reference.md`](./06-api-reference.md) | Contrat d'API endpoint par endpoint |
| 07 | [`07-regles-metier.md`](./07-regles-metier.md) | Règles fonctionnelles détaillées |
| 08 | [`08-jobs-events-integrations.md`](./08-jobs-events-integrations.md) | Jobs, événements, intégrations tierces |
| 09 | [`09-performance-scalabilite.md`](./09-performance-scalabilite.md) | Cache, index, montée en charge |
| 10 | [`10-tests-qualite-ci.md`](./10-tests-qualite-ci.md) | Tests Japa, lint, CI |
| 11 | [`11-deploiement-ops.md`](./11-deploiement-ops.md) | Env, Docker, exploitation |
| 12 | [`12-migration-donnees.md`](./12-migration-donnees.md) | Reprise depuis Supabase |
| 13 | [`13-skills-claude.md`](./13-skills-claude.md) | Règles de travail pour Claude Code |
| 14 | [`14-skills-ia-claude-code.md`](./14-skills-ia-claude-code.md) | Catalogue des skills IA activables et règles de composition |
| 15 | [`15-inventaire-supabase.md`](./15-inventaire-supabase.md) | Inventaire de l'existant Supabase et destination |

## 3. Stack imposée

| Besoin | Choix | Version |
|--------|-------|---------|
| Framework | AdonisJS (API starter kit, ESM, TS strict) | v7.x |
| Runtime | Node.js LTS | ≥ 24 |
| ORM | Lucid (`@adonisjs/lucid`) | v21+ |
| Base | PostgreSQL | ≥ 16 |
| Validation | VineJS (`@vinejs/vine`) | v3+ |
| Autorisation | Bouncer (`@adonisjs/bouncer`) | v3+ |
| Auth | `@adonisjs/auth` — guard `access_tokens` | v9+ |
| Hash | `@adonisjs/core/hash` — driver **argon2** | — |
| Cache / files / rate limit | Redis (`@adonisjs/redis`, `@adonisjs/limiter`) | v7 / v2+ |
| Files d'attente | BullMQ | v5+ |
| Mail | `@adonisjs/mail` + transport Resend HTTP | v9+ |
| Stockage fichiers | `@adonisjs/drive` — driver S3 compatible | v3+ |
| Tests | Japa (`@japa/runner`, `@japa/api-client`) | v3+ |
| Logs | Pino (intégré Adonis) format JSON | — |
| i18n | `@adonisjs/i18n` (fr par défaut, en) | v2+ |

**Interdits** : ORM alternatif, requêtes SQL brutes hors migrations et
rapports agrégés justifiés, `any` non annoté, JavaScript non typé.

## 4. Conventions transverses

- **Langue du code** : anglais (identifiants, tables, colonnes, routes).
  **Langue des messages utilisateur** : fr/en via i18n. Les commentaires peuvent
  être en français.
- **Nommage** : tables `snake_case` pluriel, colonnes `snake_case`,
  classes `PascalCase`, fichiers `snake_case.ts` (convention Adonis v7),
  routes `kebab-case`.
- **Identifiants** : `uuid` v7 générés applicativement (`uuidv7()`), jamais de
  `serial` exposé.
- **Dates** : toutes les colonnes horodatées sont `timestamptz`, stockées en UTC.
  Les dates métier sans heure (embauche, congés) sont `date`.
- **Argent** : `numeric(14,2)`, devise ISO 4217 sur 3 lettres, GNF par défaut
  (0 décimale à l'affichage, mais stockage décimal conservé).
- **Toute table métier porte `organization_id NOT NULL`.** Sans exception.
- **Soft delete** : `deleted_at timestamptz NULL` sur les entités référencées
  (employees, departments, jobs, contracts, plans). Purge physique via job.

## 5. Glossaire métier FR / EN

| Français | Anglais / code | Définition |
|---|---|---|
| Organisation | `organization` | Client B2B, racine du tenant |
| Employé | `employee` | Fiche RH, peut être liée ou non à un compte utilisateur |
| Utilisateur | `user` | Compte d'authentification |
| Rôle | `role` | `owner`, `hr_admin`, `manager`, `employee`, `recruiter`, `security_agent` |
| Département | `department` | Unité organisationnelle, a un responsable |
| Contrat | `contract` | CDI, CDD, stage, freelance, apprentissage, journalier |
| Pointage | `time log` / `punch` | Arrivée (`IN`) ou départ (`OUT`) |
| Zone de travail | `work zone` | Périmètre géographique autorisé (cercle ou polygone) |
| Badge NFC | `nfc badge` | UID physique associé à un employé |
| Congé | `leave request` | Demande de congé annuel/maladie/maternité/sans solde |
| Jour férié | `public holiday` | Jour chômé, propre à l'organisation |
| Offre | `job` | Offre d'emploi publiée sur la page carrières |
| Candidat | `candidate` | Candidature à une offre |
| Objectif | `goal` | Objectif individuel (modèle classique) |
| OKR | `okr` | Objectif + résultats clés (modèle SAP/OKR) |
| Check-in | `okr_checkin` | Point d'avancement sur un OKR |
| Évaluation | `performance review` | Auto-évaluation + évaluation manager |
| Cycle | `performance cycle` | Période d'évaluation |
| Plan de performance | `performance plan` | Regroupement d'objectifs sur une période |
| Feedback | `feedback` | Retour continu : kudos, suggestion, préoccupation |
| Plan d'abonnement | `plan` | Offre commerciale (code, prix GNF, modules) |
| Back-office | `platform admin` | Console interne Konkouré (`root` / `support`) |

## 6. Non négociable

1. **Aucune requête base ne s'exécute sans filtre d'organisation** (sauf
   contextes plateforme explicitement marqués `@platformScope`).
2. **Aucune décision d'autorisation côté client.** Toute règle est vérifiée
   dans une policy Bouncer côté serveur.
3. **Aucun secret en dur.** Tout passe par `env.ts` validé au démarrage.
4. **Toute mutation sensible écrit une ligne d'audit** (voir 05, §7).
5. **Toute entrée est validée par un validator VineJS** avant d'atteindre un
   service. Un controller ne parse jamais `request.body()` à la main.
6. **Les réponses n'exposent jamais** : hash de mot de passe, tokens, UID de
   badge NFC (hors rôles autorisés), secrets d'intégration, salaires (hors
   rôles autorisés).
7. **Chaque endpoint est couvert par un test fonctionnel** incluant un test
   d'isolation tenant (un utilisateur de l'org A ne peut pas lire l'org B).

## Reprise complète (backend + frontend)
Ce dossier fait partie du dossier de reprise global : commencer par [`../00-HANDOFF.md`](../00-HANDOFF.md).
Le frontend TanStack Start existant devient `apps/web` et consomme cette API (voir `../frontend/`).
L'inventaire de l'existant Supabase à reprendre est dans [`15-inventaire-supabase.md`](./15-inventaire-supabase.md).
