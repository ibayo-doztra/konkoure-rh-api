# Spécifications techniques du backend AdonisJS (source de vérité pour Claude Code)

Objectif : produire un dossier `docs/backend/` complet et sans zone d'ombre, décrivant un backend API AdonisJS v6 multi-tenant B2B, avec un schéma de base repensé, une authentification native AdonisJS (access + refresh tokens) et l'ensemble des modules actuels de Konkouré.

Aucun code applicatif ne sera modifié : la livraison est purement documentaire.

## Périmètre fonctionnel couvert

Organisations et abonnements, utilisateurs et rôles, RH (employés, départements, contrats, compétences), pointage (zones, badges NFC, journaux), congés et jours fériés, recrutement (offres, candidats, notes, activités, webhooks de scoring), performance (cycles, plans, objectifs, OKR, check-ins, évaluations, feedback, achievements, 9-box, succession), facturation (plans, paiements Djomy, cycle de vie, réconciliation), back-office plateforme (admins, réglages, journaux d'audit/système/usage, demandes de démo), notifications, réseaux sociaux, intégrations.

## Fichiers à créer dans `docs/backend/`

1. `00-README.md` — carte du dossier, ordre de lecture, conventions, glossaire métier FR/EN, ce que Claude Code doit considérer comme non négociable.
2. `01-architecture.md` — AdonisJS v6 en mode API-only, structure `app/modules/<domaine>` (controllers, services, repositories, validators, policies, events, jobs), couche transport vs couche métier, injection de dépendances, configuration par environnement, structure des réponses et des erreurs, versionnement `/api/v1`.
3. `02-schema-db.md` — schéma repensé complet : chaque table avec colonnes, types, contraintes, valeurs par défaut, clés étrangères, index (dont index composites `organization_id + …`), énumérations, tables de jointure, colonnes d'audit, soft delete. Diagramme relationnel en ASCII. Justification des changements par rapport au schéma actuel (44 tables recensées).
4. `03-migrations-models.md` — ordre des migrations Lucid, squelettes de migrations, modèles Lucid avec relations, hooks, sérialisation (masquage des champs sensibles), scopes multi-tenant obligatoires, seeders (plans, rôles, jours fériés Guinée), factories de test.
5. `04-auth-rbac.md` — authentification native AdonisJS : access tokens courts + refresh tokens rotatifs avec révocation, hachage Argon2, vérification e-mail, réinitialisation de mot de passe, invitations, sessions multi-appareils, verrouillage après tentatives échouées. Matrice complète des rôles (`owner`, `hr_admin`, `manager`, `employee`, `recruiter`, `security_agent`, admin plateforme `root`/`support`) × ressources × actions, transposée en Bouncer policies. Plan de reprise des comptes existants (obligation de réinitialisation du mot de passe).
6. `05-multi-tenant-securite.md` — isolation par organisation appliquée dans le middleware et les repositories (remplacement des RLS Postgres par des garde-fous applicatifs + RLS résiduelle en défense en profondeur), règles anti-IDOR, chiffrement des secrets, gestion des UID de badges NFC, validation stricte des URLs de webhook (anti-SSRF), en-têtes de sécurité, CORS, rate limiting par IP/organisation/utilisateur, quotas et anti-abus, journalisation d'audit obligatoire, conformité RGPD/rétention.
7. `06-api-reference.md` — contrat complet endpoint par endpoint pour tous les modules : méthode, chemin, permissions, paramètres, schéma de requête VineJS, schéma de réponse, codes d'erreur, pagination, tri, filtres, idempotence, exemples. Inclut les endpoints publics (carrières, candidature, pointage mobile, webhooks Djomy, demandes de démo) avec leurs règles de protection spécifiques.
8. `07-regles-metier.md` — règles fonctionnelles détaillées : calcul des soldes de congés et solde négatif autorisé, motif de rejet, jours fériés, géofencing du pointage (rayon, fuseau, hors-ligne, doublons), cycle de vie OKR (`draft` → `pending` → `validated` / `needs_revision`) et check-ins, workflow d'évaluation (auto-évaluation, évaluation manager, renvoi, validation, signature), pipeline de recrutement et scoring IA, droits par plan d'abonnement (essai gratuit 30 jours hors recrutement et talents), cycle de vie d'un abonnement et des paiements Djomy.
9. `08-jobs-events-integrations.md` — file de traitement asynchrone, tâches planifiées (réconciliation des paiements, expiration d'essai, rappels d'évaluation, purge des journaux), événements et listeners, e-mails transactionnels Resend avec gabarits, webhooks entrants (Djomy, n8n) avec vérification de signature et rejeu, webhooks sortants, stockage de fichiers (logos, CV, passeports) avec URLs signées, IA (génération d'offres, scoring CV, suggestions OKR, résumés).
10. `09-performance-scalabilite.md` — objectifs de charge B2B, stratégie de cache Redis, pagination par curseur, requêtes N+1 interdites, index critiques, pooling de connexions, lecture/écriture, files d'attente, dimensionnement, monitoring, health checks, métriques, traces, budgets de latence.
11. `10-tests-qualite-ci.md` — pyramide de tests Japa (unitaires, fonctionnels, tests de policies et d'isolation multi-tenant), couverture minimale, jeux de données, lint et typage stricts, CI, revue, définition de « terminé ».
12. `11-deploiement-ops.md` — variables d'environnement exhaustives et validation au démarrage, Docker, migrations en production, sauvegardes et restauration, rollback, secrets, journalisation structurée, alertes, runbook d'incident.
13. `12-migration-donnees.md` — reprise depuis la base actuelle vers le nouveau schéma : correspondance table par table, transformations, gestion des identités, ordre d'exécution, vérifications de cohérence, bascule progressive du frontend web et de l'app mobile Flutter, plan de retour arrière.
14. `13-skills-claude.md` — « skills » et règles de travail pour Claude Code : conventions de nommage, gabarits de fichiers, checklist avant chaque commit, interdictions formelles (pas de requête sans filtre d'organisation, pas de secret en dur, pas de contrôle d'accès côté client), procédure d'ajout d'un nouveau module de bout en bout.

## Détails techniques

- AdonisJS v6 (ESM, TypeScript strict), Lucid ORM sur PostgreSQL, VineJS pour la validation, Bouncer pour l'autorisation, `@adonisjs/auth` access tokens, Redis pour cache et limitation de débit, Japa pour les tests.
- Le schéma repensé conserve la sémantique métier actuelle mais normalise : identifiants UUID v7, `organization_id` non nul sur toutes les tables métier, énumérations Postgres explicites, colonnes `created_at` / `updated_at` / `deleted_at` / `created_by`, /updated_by, tables d'audit unifiées, séparation stricte des rôles dans `user_roles`.
- Les documents citent les conventions officielles AdonisJS (structure IoC, providers, middlewares, exception handler) issues de la documentation fournie.
- Chaque fichier reste autonome et référencé depuis `00-README.md` pour être ingéré par Claude Code sans contexte supplémentaire.

## Ce qui n'est pas fait ici

Aucune implémentation, aucune migration exécutée, aucun changement du frontend actuel. La documentation prépare le développement, elle ne le démarre pas.