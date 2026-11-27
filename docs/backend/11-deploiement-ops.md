# 11 — Déploiement et exploitation

## 1. Variables d'environnement

Toutes déclarées et validées dans `start/env.ts`. Un démarrage avec une
variable manquante ou invalide échoue immédiatement.

### Cœur
| Variable | Type | Défaut | Notes |
|---|---|---|---|
| `NODE_ENV` | enum | — | `development` \| `test` \| `production` |
| `PORT` | number | `3333` | |
| `HOST` | string | `0.0.0.0` | |
| `APP_KEY` | string ≥ 32 | — | chiffrement et signature |
| `NFC_UID_PEPPER` | secret | — | pepper des empreintes d'UID NFC (05 §6) ; ne jamais le changer en service |
| `APP_URL` | url | — | URL publique de l'API |
| `WEB_APP_URL` | url | — | front, pour les liens des e-mails |
| `LOG_LEVEL` | enum | `info` | |
| `TZ` | string | `UTC` | le processus tourne en UTC |
| `DEFAULT_TIMEZONE` | string | `Africa/Conakry` | |
| `DEFAULT_LOCALE` | enum | `fr` | |
| `DEFAULT_CURRENCY` | string(3) | `GNF` | |

### Base de données
`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`,
`DB_SSL` (bool), `DB_POOL_MIN` (2), `DB_POOL_MAX` (20),
`DB_READ_REPLICA_HOST` (optionnel), `DB_STATEMENT_TIMEOUT_MS` (10000).
En production, `DB_USER=konkoure_app` pour l'API et `konkoure_worker` pour le worker.
`DB_APP_ROLE=konkoure_app` fait prendre ce rôle au serveur HTTP quand `DB_USER` est
un autre compte (développement, e2e).

### Redis
`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS`,
`REDIS_DB_CACHE` (0), `REDIS_DB_QUEUE` (1), `REDIS_DB_LIMITER` (2).
`QUEUE_DRIVER` : `bullmq` (défaut en production) ou `sync`.
`LIMITER_STORE` : `redis` partout, `memory` uniquement pour les tests
(`.env.test`). En local : `docker compose up -d redis`.
`RATE_LIMIT_GLOBAL_IP_PER_MINUTE` (défaut 300) : réservé aux suites de test et e2e, dont
toutes les requêtes partent d'une même IP ; l'application refuse de démarrer si elle est
définie avec `NODE_ENV=production`. Les en-têtes `Retry-After`, `X-RateLimit-Limit` et
`X-RateLimit-Remaining` sont exposés en CORS.

### Authentification
`ACCESS_TOKEN_TTL` (`15m`), `REFRESH_TOKEN_TTL` (`30d`),
`REFRESH_TOKEN_TTL_MOBILE` (`90d`), `EMAIL_VERIFICATION_TTL` (`24h`),
`PASSWORD_RESET_TTL` (`1h`), `INVITATION_TTL` (`7d`),
`MAX_LOGIN_ATTEMPTS` (5), `LOCKOUT_DURATION` (`15m`),
`REFRESH_COOKIE_DOMAIN`.

### Sécurité
`CORS_ORIGINS` (liste séparée par des virgules), `NFC_UID_PEPPER` (≥ 32),
`PUBLIC_CAPTCHA_ENABLED` (bool),
`CAPTCHA_SECRET` (si activé), `FILE_SCAN_ENABLED` (bool).

### Stockage
`DRIVE_DISK` (`fs`, `s3`, `s3Public`), `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
`S3_BUCKET_PUBLIC`, `S3_BUCKET_PRIVATE`, `S3_PUBLIC_BASE_URL`,
`UPLOAD_MAX_BYTES` (10485760).

### E-mail
`MAIL_MAILER` (`resend`), `RESEND_API_KEY`,
`MAIL_FROM_ADDRESS` (`support@konkoure.doztra.cloud`, 00-HANDOFF §4),
`MAIL_FROM_NAME` (`Konkouré`), `SUPPORT_EMAIL`,
`DEMO_REQUEST_RECIPIENT` (`bayo.ibrahima@doztra.com`),
`RESEND_WEBHOOK_SECRET`.

### Paiements
`DJOMY_BASE_URL`, `DJOMY_API_KEY`, `DJOMY_MERCHANT_ID`,
`DJOMY_WEBHOOK_SECRET`, `DJOMY_TIMEOUT_MS` (20000),
`PAYMENT_PENDING_TTL_MINUTES` (30), `CLAIM_TOKEN_TTL_DAYS` (7).

### IA
`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS` (45000),
`AI_ENABLED` (bool).

### Réseaux sociaux (optionnels)
`FACEBOOK_APP_ID`/`_SECRET`, `LINKEDIN_CLIENT_ID`/`_SECRET`,
`TWITTER_CLIENT_ID`/`_SECRET`, `OAUTH_REDIRECT_BASE_URL`.

### Cartographie
`GOOGLE_MAPS_API_KEY` (serveur, géocodage inverse — optionnel).

### Observabilité
`OTEL_EXPORTER_OTLP_ENDPOINT`, `SENTRY_DSN`, `METRICS_ENABLED`, `METRICS_HOST`
(défaut `127.0.0.1`, `0.0.0.0` dans un conteneur), `METRICS_PORT` (défaut 9464, jamais
publié par le proxy : seul Prometheus, sur le réseau interne, y accède).

> Aucune variable ne porte de valeur par défaut secrète. Aucun `.env` n'est
> déployé en production : les valeurs viennent du gestionnaire de secrets.

## 2. Conteneurisation

Le `Dockerfile` à la racine construit l'image sur Node 24 avec pnpm, en deux étapes,
et l'exécute avec un utilisateur non root. Le worker utilise la même image avec
`node ace.js queue:work`.
Image non-root, sans outils de build, sans secrets. Scan de vulnérabilités
(Trivy) en CI.

## 3. Déploiement

Séquence pour chaque livraison :

1. Build et push de l'image, taguée par SHA de commit.
2. **Migrations d'abord** (`node ace migration:run --force`) dans un job
   dédié, à réplica unique, avec verrou d'avance.
3. Déploiement progressif de l'API (rolling, `maxSurge 1`, `maxUnavailable 0`),
   readiness sur `/health/ready`.
4. Déploiement des workers après l'API.
5. Vérification post-déploiement : `/health/ready`, taux d'erreur, latence
   pendant 10 minutes.

**Compatibilité descendante obligatoire** : une migration ne doit jamais casser
la version précédente encore en ligne. Suppression de colonne en trois étapes
(arrêter d'écrire → déployer → supprimer dans une livraison ultérieure).

## 4. Sauvegardes et restauration

- Sauvegarde complète quotidienne, WAL archivés en continu (PITR à la minute).
- Rétention : 7 jours de quotidiennes, 4 hebdomadaires, 12 mensuelles.
- **Test de restauration mensuel obligatoire** dans un environnement isolé,
  chronométré, consigné.
- Objectifs : RPO ≤ 5 min, RTO ≤ 2 h.
- Le stockage objet est versionné avec suppression différée (30 jours).

## 5. Retour arrière

- Application : redéploiement de l'image précédente (immédiat).
- Migrations : `migration:rollback` uniquement si la migration est réversible et
  n'a pas détruit de données ; sinon, correction par une nouvelle migration.
- Toute migration destructive doit être précédée d'une sauvegarde ponctuelle
  explicite et validée par un responsable.

## 6. Journalisation

Pino JSON vers la sortie standard, collecté par la plateforme.
Champs : `time`, `level`, `requestId`, `userId`, `organizationId`, `route`,
`method`, `statusCode`, `durationMs`, `msg`.
Filtre de masquage sur `password`, `token`, `secret`, `authorization`,
`apiKey`, `uid`, `cvUrl`.
Les erreurs 5xx incluent la stack **dans les logs uniquement**, jamais dans la
réponse HTTP.

## 7. Alertes et astreinte

| Alerte | Seuil | Gravité |
|---|---|---|
| Erreurs 5xx | > 1 % sur 5 min | critique |
| Latence p95 | > 1 s sur 5 min | majeure |
| `/health/ready` en échec | 2 sondes | critique |
| File `critical` en attente | > 100 ou âge > 5 min | majeure |
| Jobs en échec définitif | > 5 / h | majeure |
| Connexions DB | > 80 % du pool | majeure |
| Paiements `pending` | > 1 h | majeure |
| Échecs de webhook sortant | > 10 / 15 min | mineure |
| Disque base | > 80 % | majeure |
| Certificat TLS | < 15 jours | mineure |

## 8. Runbook d'incident

1. **Qualifier** : périmètre (une organisation ou toutes), impact, début.
2. **Communiquer** : bannière d'état, information des `owner` si > 15 min.
3. **Diagnostiquer** : `/health/ready`, logs filtrés par `requestId`,
   métriques, `pg_stat_activity` pour les requêtes bloquantes, profondeur
   des files.
4. **Actions immédiates** :
   - saturation base : `SELECT pg_cancel_backend(pid)` sur les requêtes > 30 s ;
   - régression applicative : retour à l'image précédente ;
   - dépendance externe (Djomy, IA) : basculer le module en mode dégradé
     (`platform_settings.maintenance_<module> = true`) ;
   - abus : durcir le rate limit pour l'IP ou l'organisation concernée.
5. **Rétablir**, vérifier 30 min, lever l'alerte.
6. **Post-mortem sans blâme** sous 72 h : chronologie, cause racine, actions
   correctives datées, ajout d'un test de non-régression.

## 9. Mode maintenance

`platform_settings.maintenance_mode = true` : l'API répond `503` avec
`Retry-After` sur toutes les routes métier, sauf `/health`, `/auth/login`
pour les admins plateforme et `/platform/*`. Les workers continuent à drainer
les files.

## 10. Environnements

| Environnement | Base | Données | Accès |
|---|---|---|---|
| `development` | locale Docker | seeders de démo | développeurs |
| `staging` | isolée | copie **anonymisée** de la production | équipe |
| `production` | dédiée | réelles | déploiement automatisé uniquement |

Aucune donnée personnelle réelle en développement ni en staging : le script
d'anonymisation remplace noms, e-mails, téléphones, salaires et documents.

## Déploiement conjoint avec le frontend
- `apps/web` (TanStack Start) déployé séparément (Node ou Workers) avec `VITE_API_URL=https://api.konkoure.doztra.cloud`.
- Domaine applicatif `konkoure.doztra.cloud`, API sur `api.konkoure.doztra.cloud`. CORS limité à `CORS_ORIGINS` ; cookies `Secure`, `SameSite=Lax`, domaine `.konkoure.doztra.cloud` si session par cookie.
- L'app mobile Flutter pointe vers l'API (ancien domaine `konkoure.lovable.app` à rediriger pendant la transition).
- Bascule : gel des écritures, migration des données, bascule DNS, surveillance, retour arrière documenté.
