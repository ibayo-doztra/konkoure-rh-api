# 14 — Skills IA pour Claude Code

## 1. Objectif et distinction

Les **skills IA Claude Code** sont des instructions de développement stockées dans `.claude/skills/<nom>/SKILL.md`. Claude Code les charge selon le contexte pour appliquer correctement l'architecture, la sécurité, les règles métier et les tests du backend Konkouré.

> **Accès facile** : un miroir de consultation est disponible dans `docs/backend/skills/konkoure-*/SKILL.md`. Seul le dossier `.claude/skills/` est actif pour le chargement automatique ; le miroir doit être tenu à jour si un skill est modifié.

Ils ne doivent jamais être confondus avec les **compétences des employés** du produit :

| Notion | Emplacement actif | Emplacement de consultation | Fonction |
|---|---|---|---|
| Skill IA Claude Code | `.claude/skills/konkoure-*/SKILL.md` | `docs/backend/skills/konkoure-*/SKILL.md` | Guide l'agent qui code le backend |
| Compétence employé | module `hr` / `talents`, tables `skills` et `employee_skills` | — | Donnée RH visible et gérée par les utilisateurs |

Tous les skills d'agent sont préfixés `konkoure-` pour supprimer cette ambiguïté.

## 2. Principe de déclenchement automatique

Le champ `description` de chaque `SKILL.md` énumère précisément les actions et notions qui doivent le déclencher. Claude Code charge les skills dont la description correspond à la tâche demandée.

Une tâche fonctionnelle utilise plusieurs skills complémentaires :

```text
skill du domaine
  + konkoure-feature-workflow
  + konkoure-tenant-security
  + konkoure-api-contracts       si contrat HTTP touché
  + konkoure-database            si persistance touchée
  + konkoure-auth-rbac           si droits touchés
  + konkoure-testing-quality     toujours avant achèvement
  + performance / intégrations / opérations selon l'impact
```

Les règles se cumulent. Les fichiers `docs/backend/00` à `13` restent la source canonique ; les skills les transforment en procédures et checklists sans les remplacer.

## 3. Skills transversaux

| Skill | Déclencheurs principaux | Références |
|---|---|---|
| `konkoure-feature-workflow` | ajouter, modifier, corriger ou revoir une fonctionnalité backend | 00, 01, 13 |
| `konkoure-api-contracts` | route, controller, validator, réponse, erreur, pagination, webhook public | 01, 05, 06 |
| `konkoure-database` | table, migration Lucid, modèle, repository, index, trigger, transaction | 02, 03, 05, 09 |
| `konkoure-auth-rbac` | login, tokens, mot de passe, invitation, session, rôle, Bouncer | 04, 05, 06 |
| `konkoure-tenant-security` | `organization_id`, isolation tenant, RLS, audit, donnée sensible, SSRF, secret | 00, 04, 05 |
| `konkoure-testing-quality` | test Japa, factory, CI, couverture, revue ou fin de fonctionnalité | 07, 10, 13 |
| `konkoure-performance-scale` | volume, latence, cache Redis, index, file, export, partition, charge | 01, 03, 08, 09 |
| `konkoure-operations` | environnement, Docker, déploiement, logs, métriques, backup, incident | 05, 09, 11 |

## 4. Skills métier

| Skill | Déclencheurs principaux | Références |
|---|---|---|
| `konkoure-hr` | organisation, membre, employé, département, contrat, hiérarchie, import, compétence employé | 02, 04, 06, 07 §1 |
| `konkoure-timeclock-nfc` | pointage, punch, badge, UID NFC, zone, géolocalisation, kiosque, Flutter hors-ligne | 02, 04, 05, 06, 07 §2 |
| `konkoure-leaves` | congé, solde, ledger, approbation, refus, chevauchement, jour férié | 02, 04, 06, 07 §3/§9 |
| `konkoure-recruitment` | offre, carrière, candidat, format téléphone guinéen, CV, pipeline, note, embauche, scoring IA n8n, validité du CV, alerte de fraude | 02, 04, 06, 07 §4, 08 |
| `konkoure-performance` | objectif, OKR, résultat clé, check-in, évaluation, signature, feedback, 9-box | 02, 04, 06, 07 §5 |
| `konkoure-billing` | plan, essai, entitlement, quota, abonnement, Djomy, paiement, facture, réclamation | 02, 04, 06, 07 §§6–7, 08 |
| `konkoure-platform-admin` | back-office, root, support, réglage plateforme, logs globaux, impersonation | 02, 04, 05, 06 §13 |
| `konkoure-integrations-jobs` | BullMQ, événement, cron, Resend, S3, IA, n8n, social, webhook, export | 05, 07, 08, 09 |
| `konkoure-legacy-migration` | reprise Supabase, ETL, mapping, import, bascule, contrôle, rollback | 02, 03, 11, 12 |

## 5. Exemples de composition

### Ajouter l'approbation en lot de congés

Charger : `konkoure-leaves`, `konkoure-feature-workflow`, `konkoure-api-contracts`, `konkoure-database`, `konkoure-auth-rbac`, `konkoure-tenant-security`, `konkoure-testing-quality`.

Avant de coder, vérifier que le contrat et la règle d'approbation en lot sont documentés. Sinon, demander une décision et compléter d'abord les spécifications.

### Optimiser le pointage NFC de l'application Flutter

Charger : `konkoure-timeclock-nfc`, `konkoure-performance-scale`, `konkoure-tenant-security`, `konkoure-testing-quality` et `konkoure-database` si un index ou le schéma change.

Conserver le hachage UID, l'isolation organisation, l'idempotence hors-ligne et l'absence d'appel fournisseur synchrone sur le chemin critique.

### Ajouter un webhook de facturation

Charger : `konkoure-billing`, `konkoure-integrations-jobs`, `konkoure-api-contracts`, `konkoure-tenant-security`, `konkoure-testing-quality` et `konkoure-operations` si un secret ou une alerte est ajouté.

La signature, l'anti-rejeu, la vérification serveur du montant et l'idempotence sont obligatoires.

### Reprendre les données vers le nouveau backend

Charger : `konkoure-legacy-migration`, `konkoure-database`, `konkoure-tenant-security`, `konkoure-operations` et `konkoure-testing-quality`.

Les mots de passe historiques ne sont pas récupérables : les utilisateurs importés doivent réinitialiser leur mot de passe.

## 6. Maintenance des skills

- Une règle métier se modifie d'abord dans le document canonique concerné.
- Mettre ensuite à jour les skills dont la checklist ou le déclencheur est affecté.
- Ne pas recopier de longs contrats dans un skill : référencer le document et ne conserver que les invariants opérationnels.
- Lorsqu'un nouveau domaine est ajouté, créer son skill, l'ajouter à ce catalogue et à la composition automatique de `CLAUDE.md`.
- Si un skill est modifié dans `.claude/skills/`, reporter la même modification dans le miroir `docs/backend/skills/` pour garder la consultation à jour.
- Vérifier régulièrement que chaque section des spécifications possède un skill responsable et qu'aucune description n'est trop générique.


## Complément : intégration du frontend

`konkoure-frontend-integration` — migration et maintenance de `apps/web` contre l'API AdonisJS. Charger avec `konkoure-api-contracts`, le skill du domaine et `konkoure-testing-quality`. Références : `docs/frontend/`.
