# Dossier de reprise Konkouré pour Claude Code

## Objectif

Permettre à Claude Code de reconstruire Konkouré de bout en bout : un backend AdonisJS v7 qui remplace Lovable Cloud (Supabase), et le frontend actuel (TanStack Start) rebranché sur cette API, en plus de l'app mobile Flutter.

## Ce qui existe déjà (à mettre à jour)

- `docs/backend/00` à `14` : spécifications AdonisJS (architecture, schéma, auth, API, règles métier, jobs, tests, déploiement, migration des données, skills).
- `.claude/skills/` (17 skills) et son miroir `docs/backend/skills/`.
- `CLAUDE.md`, `roadmap.md`, `docs/mobile/flutter-app.md`, `docs/mobile/flutter-timeclock.md`.

## Nouveaux documents à créer

### `docs/00-HANDOFF.md` : point d'entrée unique

Présentation du produit, structure du dépôt cible (`apps/api` AdonisJS, `apps/web` TanStack Start, `docs/`), ordre de lecture, glossaire FR/EN, et décisions déjà prises (Guinée/GNF, scoring n8n uniquement, essai de 30 jours, CPM/SAP par défaut, téléphone `XXX XX XX XX`, CV limités à 2 Mo).

### `docs/frontend/` : reprise et intégration du frontend

- `01-inventaire.md` : liste de toutes les pages (77 routes) avec rôle requis, données lues et écrites, et module payant concerné.
- `02-architecture-front.md` : TanStack Start, TanStack Query, i18n (`konkoure.lang`), thèmes et jetons de couleur, standard des modales, composants partagés.
- `03-integration-api.md` : remplacement de chaque appel au backend actuel (requêtes directes, server functions `src/lib/*.functions.ts`, stockage, auth) par l'endpoint AdonisJS correspondant. Table de correspondance complète « appel actuel → endpoint API ».
- `04-auth-session-front.md` : connexion, invitations, réinitialisation, session expirée, Google, remplacement de `useAuth`.
- `05-ui-ux-regles.md` : règles visuelles et fonctionnelles établies (Kanban avec glisser-déposer, vue tableau des candidats, compteur animé du solde, modale d'analyse de CV, formats d'affichage).
- `06-migration-front-plan.md` : migration écran par écran, par lots, avec critères de validation.

### `docs/product/` : spécification fonctionnelle

- `modules.md` : RH, congés, pointage NFC/GPS, performance, recrutement et carrières, talents, réseaux sociaux, facturation, back office `/konkoureoffice`, démo.
- `parcours.md` : parcours de bout en bout (inscription, paiement avant inscription, onboarding, candidature publique, pointage mobile, demande et validation de congé).
- `plans-entitlements.md` : offres, modules par offre, essai gratuit, réglage `modules_open_for_testing` à désactiver avant le lancement commercial.

### `docs/backend/15-inventaire-supabase.md` : état actuel à reprendre

Extraction depuis les 112 migrations : tables, fonctions SQL, triggers, politiques RLS, buckets de stockage, server functions et routes publiques. Pour chaque élément, sa destination AdonisJS (modèle, policy, service, job).

### `docs/integrations/`

Djomy (OM, MTN, Visa), n8n (contrat du webhook de scoring, délais, ping), Resend (expéditeur `support@konkoure.doztra.cloud`, séparation e-mails d'auth et e-mails transactionnels), Google Maps (clé propre pour le domaine personnalisé), Search Console, publication sociale. Liste des secrets requis, sans aucune valeur.

## Documents existants à mettre à jour

- `00-README.md` : lien vers le dossier de reprise et rôle du frontend dans la cible.
- `02-schema-db.md`, `07-regles-metier.md` : ajouter les règles récentes (devise GNF par défaut, CPM/SAP par défaut, anti-doublon de candidature avant l'envoi des fichiers, rollback du code de paiement, solde de congé, étapes du recrutement).
- `06-api-reference.md` : endpoints manquants utilisés par le frontend (changement d'étape d'un candidat, solde de congé, URL signée du CV, attribution NFC, KPIs du tableau de bord, back office).
- `11-deploiement-ops.md` : déploiement du frontend avec l'API, CORS, domaine `konkoure.doztra.cloud`.
- `12-migration-donnees.md` : export des utilisateurs, mots de passe (réinitialisation forcée si nécessaire), fichiers de stockage.
- `CLAUDE.md` : ordre de lecture global (handoff → produit → backend → frontend), skills à charger.
- Nouveau skill `.claude/skills/konkoure-frontend-integration` (+ miroir) et mise à jour des catalogues 13/14.
- `docs/mobile/*` : bascule vers les endpoints AdonisJS.
- `roadmap.md` : feuille de route de reprise par phases.

## Méthode

Chaque document sera rédigé à partir du code et de la base réels (migrations, routes, fonctions serveur, traductions), et non de mémoire. Aucun secret ni donnée personnelle ne sera copié. Aucune modification du code de l'application.

## Hors périmètre

Écriture du code AdonisJS ou modification du frontend actuel.