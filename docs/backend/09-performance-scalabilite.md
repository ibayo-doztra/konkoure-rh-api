# 09 — Performance et scalabilité

## 1. Objectifs

| Indicateur | Cible |
|---|---|
| Latence p50 lectures simples | < 80 ms |
| Latence p95 lectures | < 300 ms |
| Latence p95 écritures | < 500 ms |
| Latence p99 scan de pointage | < 400 ms |
| Débit soutenu | 500 req/s par réplica |
| Pic de pointage | 2 000 scans/min sans dégradation |
| Disponibilité | 99,5 % mensuel |
| Taux d'erreur 5xx | < 0,1 % |

Le scan de pointage est le chemin critique : il doit rester rapide même en
période de pic (8h–9h). Aucun appel synchrone externe n'y est autorisé.

## 2. Base de données

- **Pool** : `min 2`, `max 20` connexions par réplica. Au-delà de 4 réplicas,
  interposer **PgBouncer** en mode transaction (mode session interdit —
  incompatible avec `SET LOCAL`, à moins de le configurer par transaction).
- **Réplica de lecture** : les endpoints de reporting (`/dashboard`,
  `/platform/logs`, exports) utilisent une connexion `readReplica` déclarée dans
  `config/database.ts`. Jamais pour une lecture suivie d'écriture.
- **Timeouts** : `statement_timeout = 10s` pour le rôle web,
  `60s` pour le rôle worker, `idle_in_transaction_session_timeout = 15s`.
- **Transactions courtes** : aucune I/O externe (HTTP, mail, file) à l'intérieur
  d'une transaction. Les jobs sont mis en file **après** le commit.

## 3. Index critiques

```sql
-- Employés
CREATE INDEX ON employees (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX ON employees (organization_id, department_id);
CREATE INDEX ON employees (organization_id, manager_id);
CREATE INDEX employees_name_trgm ON employees
  USING gin ((lower(first_name || ' ' || last_name)) gin_trgm_ops);

-- Pointage (chemin critique)
CREATE UNIQUE INDEX ON nfc_badges (uid_hash) WHERE revoked_at IS NULL;
CREATE INDEX ON time_logs (organization_id, punched_at DESC);
CREATE INDEX ON time_logs (employee_id, punched_at DESC);
CREATE INDEX ON attendance_days (organization_id, day DESC);
CREATE UNIQUE INDEX ON attendance_days (employee_id, day);

-- Congés
CREATE INDEX ON leave_requests (organization_id, status, start_date DESC);
CREATE INDEX ON leave_requests (employee_id, start_date DESC);

-- Recrutement
CREATE INDEX ON candidates (organization_id, job_id, stage);
CREATE INDEX ON candidates (organization_id, ai_score DESC NULLS LAST);
CREATE UNIQUE INDEX ON jobs (organization_id, slug);
CREATE INDEX ON jobs (organization_id, status, published_at DESC);

-- Performance
CREATE INDEX ON goals (organization_id, employee_id, status);
CREATE INDEX ON okrs (organization_id, employee_id, quarter);
CREATE INDEX ON performance_reviews (organization_id, cycle_id, status);

-- Journaux et notifications
CREATE INDEX ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX ON audit_logs (organization_id, created_at DESC);
CREATE INDEX ON audit_logs (actor_user_id, created_at DESC);
CREATE INDEX ON usage_events (organization_id, created_at DESC);
```

Règle : tout nouvel endpoint de liste doit être accompagné d'un `EXPLAIN
ANALYZE` prouvant l'absence de `Seq Scan` sur une table > 10 000 lignes.

## 4. Partitionnement

`time_logs`, `audit_logs` et `usage_events` sont partitionnées **par mois** sur
leur colonne temporelle. Le job `partitions:ensure` maintient 3 mois d'avance.
**État au 2026-11-26** : les trois tables sont partitionnées. `0131` a créé les 12 mois
à venir de `time_logs` et `audit_logs` (les lignes de ces mois déjà rangées dans
`DEFAULT` y sont déplacées) ; `0141` a recréé `usage_events` en table partitionnée
(clé primaire `(id, created_at)`, lignes copiées) ; `partitions:ensure` couvre les trois.
Les partitions de plus de 24 mois sont détachées puis exportées en stockage
froid (Parquet/CSV compressé) avant suppression.

Bénéfices : élagage automatique des partitions à la lecture, purges par `DROP
TABLE` instantanées, index plus petits.

## 5. Cache Redis

| Clé | TTL | Invalidation |
|---|---|---|
| `ent:<orgId>` (modules et quotas) | 60 s | changement d'abonnement ou de plan |
| `mgr:<orgId>:<employeeId>` (descendance) | 5 min | changement de `manager_id`/département |
| `dash:<orgId>:<period>:<scope>` | 5 min | écriture métier majeure (invalidation par tag) |
| `careers:<orgSlug>` | 60 s | publication/fermeture d'offre |
| `plans:public` | 10 min | modification du catalogue |
| `holidays:<orgId>:<year>` | 24 h | modification des jours fériés |
| `idem:<key>` | 24 h | — |
| `rl:*` (rate limit) | fenêtre | — |

Règles : jamais de donnée personnelle dans une clé de cache partagée ; la clé
inclut toujours `organizationId` **et** la portée de rôle quand le contenu en
dépend ; stratégie `cache-aside` avec verrou anti-stampede (`SET NX` 10 s).

## 6. Requêtes et sérialisation

- **N+1 interdit** : tout accès à une relation dans une boucle est un défaut
  bloquant. Utiliser `preload` / `withCount` / `whereHas`.
- Les listes ne préchargent que les relations réellement rendues.
- Les compteurs de tableau de bord viennent d'agrégats (`attendance_days`,
  `usage_counters`, `leave_balances`), jamais d'un `COUNT(*)` sur `time_logs`.
- `SELECT` explicite des colonnes sur les grandes tables ; pas de `select *`.
- Pagination par curseur obligatoire au-delà de 5 000 lignes attendues :
  `OFFSET` élevé est proscrit.
- Réponses volumineuses (> 1 Mo) : pagination imposée ou export asynchrone.

## 7. Traitement asynchrone

Tout traitement > 200 ms qui n'est pas nécessaire à la réponse part en file :
e-mails, notifications, appels IA, webhooks sortants, agrégats, exports,
écriture de `usage_events`.
Les écritures d'audit restent **synchrones** (intégrité transactionnelle).

## 8. Dimensionnement

| Composant | Départ | Palier suivant |
|---|---|---|
| API HTTP | 2 réplicas × 1 vCPU / 1 Go | autoscale CPU > 65 %, max 10 |
| Workers | 1 réplica × 1 vCPU / 1 Go | par file, selon la profondeur |
| PostgreSQL | 2 vCPU / 8 Go / SSD | 4 vCPU / 16 Go + réplica de lecture |
| Redis | 1 Go | 4 Go, éviction `allkeys-lru` sur le cache uniquement |

La base Redis des files ne doit **jamais** avoir de politique d'éviction :
utiliser deux bases logiques distinctes (cache et files).

## 9. Surveillance

Métriques exposées : latence par route (histogramme), taux d'erreur par code,
connexions DB actives/attente, profondeur et âge des files, jobs en échec,
hit ratio du cache, scans de pointage par minute, appels IA et crédits
consommés, paiements en attente.

**Implémentation (décision du 2026-11-26)** : `prom-client`, serveur HTTP séparé du
processus web (`METRICS_ENABLED=true`, `METRICS_PORT` défaut 9464, `METRICS_HOST` défaut
`127.0.0.1`, `0.0.0.0` dans un conteneur), `GET /metrics` seulement, sans
authentification : il n'est jamais publié par le proxy. Un port occupé est journalisé
(`metrics.listen_failed`) sans empêcher l'API de démarrer. Séries (préfixe `konkoure_`,
label `app`) :
- `http_request_duration_seconds` (histogramme, `method`, `route` = motif de route ou
  `unmatched`, `status_code` final) : latence et taux d'erreur ;
- `db_pool_connections` (`connection`, `state` used/free/pending) ;
- `queue_jobs` (`queue`, `state` waiting/active/delayed/failed) et
  `queue_oldest_waiting_seconds`, lus dans Redis à chaque collecte (BullMQ seulement) ;
- `cache_lookups_total` (`cache` entitlements/dashboard, `result` hit/miss) ;
- `timeclock_punches_total` (`source`) ; `ai_calls_total` (`task`, `outcome`) et
  `ai_credits_consumed_total` ; `webhook_rejections_total` (`provider` djomy/n8n) ;
- `payments_pending` (`kind` count/oldest_seconds, paiements `pending` ou `processing`) ;
- métriques du processus Node (`process_*`, `nodejs_*`).
Les compteurs sont ceux du processus web ; le worker n'expose pas de métriques (files et
jobs en échec se lisent dans Redis depuis l'API).

Alertes : p95 > 1 s pendant 5 min · erreurs 5xx > 1 % pendant 5 min ·
file `critical` > 100 en attente · job en échec définitif · connexions DB > 80 %
· paiement `pending` > 1 h · échec de webhook > 10 en 15 min ·
espace disque > 80 %.

Traçage distribué OpenTelemetry optionnel (`OTEL_EXPORTER_OTLP_ENDPOINT`),
propagation de `X-Request-Id` de bout en bout.

## 10. Budget de performance par endpoint

| Endpoint | Budget p95 | Requêtes SQL max |
|---|---|---|
| `POST /org/timeclock/scan` | 200 ms | 4 |
| `GET /org/employees` (25) | 250 ms | 3 |
| `GET /org/dashboard` | 400 ms (cache : 30 ms) | 8 |
| `GET /org/leaves` (25) | 250 ms | 3 |
| `POST /org/leaves` | 400 ms | 7 |
| `GET /public/careers/:slug` | 150 ms (cache) | 2 |
| `POST /auth/login` | 400 ms (argon2 inclus) | 3 |

Un dépassement constaté en test de charge bloque la mise en production de
l'endpoint concerné.

## 11. Tests de charge

Scénarios k6 obligatoires avant chaque mise en production majeure :
1. **Pic de pointage** : 2 000 scans/min pendant 10 min, 50 organisations.
2. **Navigation RH** : 200 utilisateurs simultanés listant et ouvrant des fiches.
3. **Campagne d'évaluation** : 500 soumissions en 5 min.
4. **Rafale de candidatures** : 100 candidatures/min avec upload de 1 Mo.

Critères de succès : p95 dans le budget, 0 erreur 5xx, aucune file dont l'âge
dépasse 60 s, CPU base < 70 %.
