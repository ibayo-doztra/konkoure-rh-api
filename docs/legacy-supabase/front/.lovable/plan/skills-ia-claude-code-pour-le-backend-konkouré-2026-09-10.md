# Skills IA Claude Code pour le backend Konkouré

## Objectif

Transformer les spécifications existantes en véritables skills de coding-agent utilisables par Claude Code, distincts du module métier `skills` consacré aux compétences des employés.

Les documents `docs/backend/00` à `13` restent la source de vérité. Les skills en seront des guides opérationnels ciblés, sans dupliquer ni modifier les règles métier.

## Livrables

### 1. Socle de chargement automatique

- Ajouter un fichier d’instructions racine pour indiquer à Claude Code de consulter les spécifications backend et de charger automatiquement les skills pertinents selon la tâche.
- Créer les vrais fichiers `.claude/skills/<nom>/SKILL.md` avec une description précise servant de déclencheur contextuel.
- Préfixer tous les noms par `konkoure-` afin d’éviter toute confusion avec les compétences RH des employés.

### 2. Skills transversaux

Créer les skills activables suivants :

1. `konkoure-feature-workflow` — ordre complet migration → modèle → validator → repository → service → policy → controller → route → i18n → tests → documentation.
2. `konkoure-api-contracts` — conventions HTTP, validation VineJS, erreurs, pagination, idempotence et compatibilité du contrat.
3. `konkoure-database` — schéma PostgreSQL, migrations Lucid, modèles, index, contraintes, transactions, partitionnement et seeders.
4. `konkoure-auth-rbac` — authentification native AdonisJS, rotation des jetons, invitations, Bouncer et matrices de rôles.
5. `konkoure-tenant-security` — isolation des organisations, anti-IDOR, RLS résiduelle, données sensibles, audits, rate limits et webhooks sécurisés.
6. `konkoure-testing-quality` — tests Japa, isolation tenant obligatoire, tests de rôles, CI, couverture et définition de terminé.
7. `konkoure-performance-scale` — Redis, files, index, curseurs, agrégats, budgets de latence et tests de charge.
8. `konkoure-operations` — environnement, Docker, déploiement, sauvegardes, observabilité, incidents et retours arrière.

### 3. Skills par domaine métier

Créer les skills activables suivants :

1. `konkoure-hr` — organisations, utilisateurs, employés, départements, contrats, hiérarchie, import et compétences employés.
2. `konkoure-timeclock-nfc` — badges NFC, normalisation et hachage UID, zones, pointage mobile, mode hors-ligne et agrégats.
3. `konkoure-leaves` — demandes, calcul des jours, approbation, soldes, ledger et jours fériés guinéens.
4. `konkoure-recruitment` — offres, candidatures, documents, pipeline, notes, embauche et scoring IA.
5. `konkoure-performance` — objectifs classiques, OKR, résultats clés, check-ins, évaluations, signature, feedback, talents et 9-box.
6. `konkoure-billing` — plans, essais, entitlements, quotas, paiements Djomy, factures, réclamation avant inscription et réconciliation.
7. `konkoure-platform-admin` — back-office root/support, réglages, journaux, organisations, utilisateurs et actions sensibles.
8. `konkoure-integrations-jobs` — BullMQ, événements, Resend, stockage S3, IA, réseaux sociaux, webhooks et exports.
9. `konkoure-legacy-migration` — reprise des données existantes, ETL, transformations, contrôles, bascule et retour arrière.

## Contenu standard de chaque `SKILL.md`

Chaque skill comportera :

- un nom et une description de déclenchement automatique explicite ;
- les tâches pour lesquelles il doit être chargé et les cas hors périmètre ;
- les documents précis à lire avant de coder ;
- les invariants et interdictions non négociables ;
- la procédure d’implémentation étape par étape ;
- les décisions que Claude peut prendre seul et celles qui exigent une question ;
- les tests obligatoires, notamment rôle, validation et isolation tenant ;
- une checklist de fin de tâche ;
- des références aux sections canoniques plutôt qu’une copie divergente des règles.

## Catalogue documentaire

- Ajouter `docs/backend/14-skills-ia-claude-code.md` avec la différence entre skills IA et compétences employés, la liste des skills, leurs déclencheurs, leurs dépendances et des exemples de tâches.
- Mettre à jour `docs/backend/00-README.md` pour intégrer ce catalogue dans l’ordre de lecture.
- Mettre à jour `docs/backend/13-skills-claude.md` pour en faire le guide global d’orchestration et renvoyer vers les vrais `SKILL.md`.
- Documenter les combinaisons automatiques : une fonctionnalité métier charge son skill de domaine avec `feature-workflow`, `tenant-security`, `api-contracts` et `testing-quality`; les skills base, performance ou opérations s’ajoutent selon l’impact.

## Contrôles

- Vérifier que chaque domaine des spécifications possède au moins un skill responsable.
- Vérifier que toutes les descriptions sont assez distinctes pour un déclenchement contextuel fiable.
- Vérifier tous les liens internes entre catalogue, spécifications et skills.
- Rechercher les contradictions avec les documents `00` à `13`, notamment sur la Guinée, le multi-tenant, les autorisations serveur, les audits et les données sensibles.
- Confirmer qu’aucun code applicatif ni module RH de compétences employés n’est modifié.

## Limite de cette étape

Cette intervention produit uniquement les instructions Claude Code et leur documentation. Elle ne développe pas encore le backend AdonisJS et ne modifie pas l’application web existante.