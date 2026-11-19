# 01 — Architecture applicative

## 1. Principes

- **API-only** : pas de vues, pas de sessions cookies pour l'app (les cookies
  ne servent qu'au refresh token httpOnly côté web, voir 04).
- **Stateless** : aucune donnée d'état en mémoire de processus. Tout état
  partagé va en PostgreSQL ou Redis. L'application doit tourner en N réplicas.
- **Découpage vertical par domaine métier**, pas par type technique.
- **Quatre couches** : Controller → Service → Repository → Model.
  - *Controller* : HTTP uniquement (validation, appel service, sérialisation).
    Zéro logique métier, zéro requête Lucid.
  - *Service* : logique métier, transactions, émission d'événements. Ne connaît
    ni `HttpContext` ni le HTTP.
  - *Repository* : accès données, **applique systématiquement le scope tenant**.
  - *Model* : mapping Lucid, relations, sérialisation.
- **Policies Bouncer** : appelées depuis le controller (`await bouncer.with(...)`)
  avant tout appel de service mutant.

## 2. Arborescence du projet

```text
konkoure-api/
├─ app/
│  ├─ modules/
│  │  ├─ auth/
│  │  │  ├─ controllers/auth_controller.ts
│  │  │  ├─ controllers/password_controller.ts
│  │  │  ├─ services/auth_service.ts
│  │  │  ├─ services/token_service.ts
│  │  │  ├─ validators/auth_validator.ts
│  │  │  └─ events/user_registered.ts
│  │  ├─ organizations/
│  │  ├─ users/            # comptes, rôles, invitations, profils
│  │  ├─ hr/               # employees, departments, contracts, skills
│  │  ├─ timeclock/        # work_zones, nfc badges, time_logs
│  │  ├─ leaves/           # leave_requests, leave_balances, holidays
│  │  ├─ recruitment/      # jobs, candidates, notes, activities, webhooks
│  │  ├─ performance/      # cycles, plans, goals, okrs, reviews, feedback
│  │  ├─ talents/          # skills matrix, 9box, succession, achievements
│  │  ├─ billing/          # plans, subscriptions, payments, entitlements
│  │  ├─ notifications/
│  │  ├─ integrations/     # social, n8n, ai
│  │  └─ platform/         # back-office : admins, settings, logs, demo requests
│  ├─ shared/
│  │  ├─ base/             # base_controller, base_repository, base_service
│  │  ├─ exceptions/       # handler + exceptions métier typées
│  │  ├─ pagination/       # curseur + offset
│  │  ├─ audit/            # audit_service
│  │  ├─ entitlements/     # garde d'accès aux modules selon le plan
│  │  └─ utils/
│  ├─ middleware/
│  │  ├─ auth_middleware.ts
│  │  ├─ tenant_middleware.ts
│  │  ├─ platform_admin_middleware.ts
│  │  ├─ entitlement_middleware.ts
│  │  ├─ idempotency_middleware.ts
│  │  └─ request_context_middleware.ts
│  ├─ models/              # modèles Lucid (partagés entre modules)
│  ├─ policies/            # policies Bouncer (une par ressource)
│  ├─ jobs/                # workers BullMQ
│  ├─ listeners/
│  └─ mails/
├─ config/                 # app, database, auth, redis, mail, drive, limiter, cors, i18n
├─ database/
│  ├─ migrations/
│  ├─ seeders/
│  └─ factories/
├─ start/
│  ├─ routes/              # un fichier de routes par module, importé par index
│  ├─ kernel.ts
│  ├─ events.ts
│  └─ limiter.ts
├─ tests/{unit,functional}/
├─ resources/lang/{fr,en}/
└─ docs/                   # copie de ce dossier
```

## 3. Cycle d'une requête

```text
Requête HTTP
  └─ middleware global : request_id, logger, cors, body parser, rate limit IP
     └─ middleware route : auth → tenant → entitlement → policy
        └─ Controller : validator VineJS → bouncer.authorize → service
           └─ Service : transaction Lucid → repository → événement/job
              └─ Repository : query builder scopé org
        └─ Controller : sérialisation → réponse JSON normalisée
```

## 4. Contexte de requête

`request_context_middleware` attache à `HttpContext` :

```ts
ctx.requestId          // uuid v7, renvoyé dans l'en-tête X-Request-Id
ctx.auth.user          // User authentifié (guard access_tokens)
ctx.tenant             // { organizationId, role, employeeId | null, plan }
ctx.platformAdmin      // { level: 'root' | 'support' } | null
```

`ctx.tenant` est construit par `tenant_middleware` :

1. lit l'en-tête `X-Organization-Id` (obligatoire pour toute route `/api/v1/org/*`) ;
2. vérifie que l'utilisateur possède un rôle dans cette organisation
   (`user_roles`), sinon **403** ;
3. charge le plan effectif et les modules autorisés (cache Redis 60 s) ;
4. charge l'`employee_id` lié à l'utilisateur dans cette organisation.

Un utilisateur peut appartenir à plusieurs organisations : le choix est explicite
et jamais déduit d'un « dernier tenant utilisé » côté serveur.

## 5. Découpage des routes

```text
/api/v1/auth/*            # public + authentifié, hors tenant
/api/v1/me/*              # profil, organisations, notifications de l'utilisateur
/api/v1/org/*             # tout le métier, exige X-Organization-Id
/api/v1/platform/*        # back-office, exige un platform_admin actif
/api/v1/public/*          # non authentifié : carrières, candidature, demo
/api/v1/webhooks/*        # non authentifié, signature obligatoire
/health, /health/ready    # sondes
```

Versionnement : préfixe `/api/v1`. Toute rupture de contrat crée `/api/v2` ;
les deux versions cohabitent au moins 90 jours.

## 6. Format de réponse

Succès simple :

```json
{ "data": { "id": "0192...", "name": "Doztra" } }
```

Succès paginé :

```json
{
  "data": [ /* ... */ ],
  "meta": {
    "total": 248,
    "perPage": 25,
    "currentPage": 3,
    "lastPage": 10,
    "nextCursor": "eyJpZCI6..."
  }
}
```

Erreur (toujours cette forme, produite par l'exception handler) :

```json
{
  "error": {
    "code": "E_VALIDATION",
    "message": "Les données envoyées sont invalides.",
    "requestId": "0192a1...",
    "details": [
      { "field": "email", "rule": "email", "message": "Adresse e-mail invalide" }
    ]
  }
}
```

### Codes d'erreur normalisés

| HTTP | `code` | Sens |
|---|---|---|
| 400 | `E_BAD_REQUEST` | Requête malformée |
| 401 | `E_UNAUTHORIZED` | Token absent, invalide ou expiré |
| 401 | `E_TOKEN_EXPIRED` | Access token expiré — le client doit rafraîchir |
| 403 | `E_FORBIDDEN` | Authentifié mais non autorisé |
| 403 | `E_MODULE_NOT_INCLUDED` | Module absent du plan d'abonnement |
| 403 | `E_SUBSCRIPTION_INACTIVE` | Abonnement expiré ou suspendu |
| 403 | `E_QUOTA_EXCEEDED` | Nombre maximal d'employés du plan atteint |
| 404 | `E_NOT_FOUND` | Ressource inexistante **ou hors tenant** |
| 409 | `E_CONFLICT` | Conflit métier (doublon, état incompatible) |
| 409 | `E_LEAVE_OVERLAP` | Congé chevauchant une demande en attente ou approuvée (07 §3.2) |
| 413 | `E_PAYLOAD_TOO_LARGE` | Fichier ou corps trop volumineux |
| 422 | `E_VALIDATION` | Échec de validation VineJS |
| 422 | `E_HIERARCHY_CYCLE` | Rattachement créant une boucle hiérarchique |
| 422 | `E_INSUFFICIENT_BALANCE` | Solde de congés insuffisant (07 §3.4) |
| 423 | `E_ACCOUNT_LOCKED` | Compte verrouillé après tentatives échouées |
| 429 | `E_RATE_LIMITED` | Quota dépassé (en-tête `Retry-After`) |
| 500 | `E_INTERNAL` | Erreur inattendue (message générique, jamais de stack) |
| 503 | `E_DEPENDENCY_UNAVAILABLE` | Djomy / n8n / Resend indisponible |

**Règle d'or** : une ressource appartenant à une autre organisation renvoie
**404**, jamais 403 — pour ne pas divulguer son existence.

## 7. Pagination, tri, filtres

- Listes courtes (< 5 000 lignes attendues) : pagination offset
  `?page=1&perPage=25` (`perPage` max 100).
- Listes à fort volume (`time_logs`, `audit_log`, `system_log`, `notifications`,
  `usage_events`) : **pagination par curseur obligatoire**
  `?cursor=<opaque>&limit=50` (curseur = base64 de `{createdAt, id}`).
- Tri : `?sort=-created_at,last_name`, champs triables déclarés par ressource
  (liste blanche stricte).
- Filtres : `?filter[status]=active&filter[departmentId]=...`,
  `?q=` pour la recherche plein texte. Liste blanche également.

## 8. Idempotence

Les endpoints de mutation sensibles (création de paiement, scan de pointage,
envoi d'invitation, publication sociale) acceptent l'en-tête
`Idempotency-Key` (uuid). Le middleware stocke en Redis (TTL 24 h) le couple
clé → réponse ; une répétition renvoie la réponse initiale avec
`Idempotent-Replay: true`.

## 9. Configuration et environnement

Toutes les variables sont déclarées et validées dans `start/env.ts` avec VineJS.
Un démarrage avec une variable manquante ou invalide **échoue immédiatement**
(voir la liste exhaustive en 11-deploiement-ops.md).
Aucune lecture de `process.env` ailleurs que dans `start/env.ts`.

## 10. Observabilité

- Logs JSON Pino, champs obligatoires : `requestId`, `organizationId`, `userId`,
  `route`, `statusCode`, `durationMs`. **Jamais** de secret, de token, de mot de
  passe ni d'UID de badge en clair dans les logs.
- `/health` : liveness (process up).
- `/health/ready` : readiness (PostgreSQL + Redis + migrations à jour).
- Métriques Prometheus sur `/metrics` (port interne uniquement) : latence par
  route, taux d'erreur, profondeur des files, connexions DB.
