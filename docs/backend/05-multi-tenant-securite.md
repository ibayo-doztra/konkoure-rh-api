# 05 — Multi-tenant et règles de sécurité

## 1. Modèle d'isolation

Isolation **logique** : une base, un schéma, `organization_id` sur chaque table
métier. L'isolation est garantie par **trois barrières indépendantes** :

1. **Middleware `tenant`** : résout et valide l'organisation demandée avant tout
   accès (`X-Organization-Id` vs `user_roles`).
2. **Repositories** : impossible d'instancier un repository tenant sans
   `organizationId`; toute requête part avec `where organization_id = ?`.
3. **RLS PostgreSQL résiduelle** (défense en profondeur) : sur toutes les tables
   métier, une policy `USING (organization_id = current_setting('app.org_id')::uuid)`
   pour le rôle `konkoure_app`. L'application exécute
   `SET LOCAL app.org_id = '<uuid>'` au début de chaque transaction tenant.
   En cas de bug applicatif, la base refuse la fuite.

```ts
// app/shared/base/tenant_transaction.ts
export async function withTenant<T>(orgId: string, fn: (trx: TransactionClientContract) => Promise<T>) {
  return db.transaction(async (trx) => {
    await trx.rawQuery('SET LOCAL app.org_id = ?', [orgId])
    return fn(trx)
  })
}
```

Toute lecture ou écriture d'une table tenant passe donc par `withTenant()`. Trois
exceptions documentées : `user_roles` est lisible sans tenant (le middleware en a
besoin pour valider l'en-tête, l'écriture reste liée au tenant) ; `audit_logs`
accepte les lignes sans organisation (événements d'authentification) ; le parcours
public d'invitation résout l'organisation par la fonction `SECURITY DEFINER`
`invitation_org_id_for_token(hash)`.

Les jobs de fond et les tâches plateforme utilisent un rôle distinct
(`konkoure_worker`) avec `BYPASSRLS` explicitement documenté, jamais le rôle web.

## 2. Anti-IDOR

- Un identifiant reçu du client n'est **jamais** utilisé sans relecture scopée.
  Interdit : `Employee.find(id)`. Obligatoire : `repo.findOrFail(id)` (déjà scopé).
- Les identifiants sont des **uuid v7** : non énumérables séquentiellement.
- Une ressource hors tenant renvoie **404**, jamais 403.
- Toute clé étrangère fournie dans un corps de requête (`departmentId`,
  `managerId`, `jobId`, `employeeId`…) est **vérifiée comme appartenant à la même
  organisation** avant écriture. Un validateur VineJS réutilisable
  `existsInOrg(table)` industrialise ce contrôle.

```ts
const rule = vine.string().uuid().exists(async (db, value, field) => {
  const orgId = field.meta.organizationId
  const row = await db.from('departments')
    .where({ id: value, organization_id: orgId }).whereNull('deleted_at').first()
  return !!row
})
```

## 3. Validation des entrées

- **Tout** endpoint possède un validator VineJS. Aucun `request.body()` brut.
- Limites systématiques : chaînes bornées (`maxLength`), tableaux bornés
  (`maxLength`), entiers bornés (`min`/`max`), objets JSON validés par schéma.
- Corps de requête limité à **1 Mo** ; fichiers à **10 Mo** (CV, passeport,
  logo : 2 Mo).
- Normalisation : `trim` systématique, e-mails en minuscules, téléphones en
  E.164, slugs générés serveur (jamais fournis par le client).
- Contenu riche : aucun HTML n'est stocké ni renvoyé. Les champs libres sont du
  texte brut ; l'échappement est de la responsabilité du client.
- Fichiers : validation du type MIME **par signature binaire** (magic bytes),
  pas par l'extension ni par l'en-tête `Content-Type` annoncé.
  Types acceptés : `application/pdf`, `image/png`, `image/jpeg`, `image/webp`.
  Le nom d'origine est assaini ; le chemin de stockage est généré serveur
  (`<orgId>/<owner>/<uuidv7>.<ext>`).

## 4. Protection des routes publiques

`/api/v1/public/*` n'est pas authentifié. Contrôles obligatoires :

| Endpoint | Protections |
|---|---|
| `GET /public/careers/:orgSlug` | organisation active + abonnement valide, cache 60 s, rate limit 60/min/IP |
| `GET /public/careers/:orgSlug/jobs/:jobSlug` | offre `published` et non expirée uniquement |
| `POST /public/careers/:orgSlug/jobs/:jobSlug/apply` | rate limit 5/h/IP et 3/h/e-mail, taille de fichier, MIME réel, anti-doublon, honeypot, captcha si `PUBLIC_CAPTCHA_ENABLED` |
| `POST /public/demo-requests` | rate limit 3/h/IP, honeypot, validation stricte |
| `POST /public/timeclock/scan` | **jamais public** — voir §6 |
| `POST /webhooks/djomy` | signature HMAC obligatoire, anti-rejeu |
| `POST /webhooks/n8n/scoring` | signature HMAC obligatoire |

Aucune donnée personnelle n'est renvoyée par une route publique : la page
carrières expose uniquement l'organisation (nom, logo, slug) et les offres.

## 5. Champs sensibles et masquage

| Donnée | Règle |
|---|---|
| `password_hash`, tokens, `token_hash` | jamais sérialisés, jamais journalisés |
| `base_salary`, `contracts.salary` | visibles par `owner`, `hr_admin`, et l'employé pour lui-même |
| `national_id`, passeport | idem, et l'accès au document génère une entrée d'audit |
| UID de badge NFC | jamais renvoyé en clair ; format `****3E` sauf `owner`/`hr_admin` sur endpoint dédié qui journalise l'accès |
| Tokens réseaux sociaux, secrets webhook | chiffrés en base (`APP_KEY`), jamais renvoyés, remplacés par `"configured": true` |
| CV, lettres, documents candidats | URL signée TTL 15 min, jamais d'URL publique |
| E-mail/téléphone d'un employé | masqués pour `recruiter` et `security_agent` |

Implémentation : chaque modèle expose `serialize()` de base (champs publics) et
des sérialiseurs enrichis (`serializeWithSalary()`, `serializeWithBadge()`)
appelés uniquement après une autorisation Bouncer explicite.

## 6. Sécurité du pointage mobile

Le scan de badge est une **route authentifiée** (`POST /org/timeclock/scan`),
réservée aux rôles autorisés. Elle n'est jamais ouverte publiquement.

- L'UID de badge est normalisé puis **haché avec un pepper serveur**
  (`NFC_UID_PEPPER`) avant recherche : aucun UID en clair en base ni en logs.
- Un badge inconnu renvoie `404 E_BADGE_UNKNOWN` sans indiquer si l'UID existe
  ailleurs, et écrit un `nfc_badge_events` de type `scan_rejected`.
- Rate limit : 30 scans/min par appareil, 300/min par organisation.
- Le kiosque partagé utilise un **token d'appareil** (`device tokens`) à durée
  limitée, révocable depuis les réglages, avec l'ability `timeclock:scan`
  exclusivement (pas d'accès aux autres modules).
- Coordonnées GPS : `accuracy_meters` > seuil configuré ⇒ pointage accepté mais
  marqué `is_within_zone = false` avec anomalie. Aucun rejet silencieux.

## 7. Journal d'audit

Toute mutation des catégories suivantes écrit dans `audit_logs` **dans la même
transaction** que la mutation :

- authentification : `auth.login`, `auth.login_failed`, `auth.logout`,
  `auth.password_reset`, `auth.password_changed`, `security.refresh_reuse_detected`,
  `auth.account_locked`
- rôles et accès : `role.granted`, `role.revoked`, `invitation.sent`,
  `invitation.accepted`, `platform_admin.granted`, `impersonation.started`
- RH : `employee.created|updated|deleted`, `contract.*`, `salary.viewed`,
  `sensitive_document.viewed`
- pointage : `badge.assigned|revoked`, `time_log.corrected|deleted`, `zone.*`
- congés : `leave.approved|rejected|cancelled`, `leave_balance.adjusted`
- recrutement : `candidate.stage_changed`, `candidate.hired`, `note.deleted`,
  `webhook_config.updated`
- facturation : `subscription.changed`, `payment.succeeded|failed`,
  `plan.updated`
- plateforme : `platform_setting.updated`, toute action `root`

Contenu : acteur, rôle, organisation, IP, `request_id`, `before_data`,
`after_data` (champs sensibles remplacés par `"[redacted]"`).
Le journal est en **insertion seule** (droits SQL révoqués, §03 8).

## 8. Limitation de débit

`@adonisjs/limiter` avec backend Redis. Barèmes par défaut :

| Portée | Limite |
|---|---|
| Global par IP | 300 req / min |
| Authentifié par utilisateur | 600 req / min |
| Par organisation | 3 000 req / min (plan `pro`/`enterprise` : 10 000) |
| `POST /auth/login` | 10 / 15 min / IP, 5 / 15 min / e-mail |
| `POST /auth/forgot-password` | 3 / h / e-mail |
| `POST /auth/refresh` | 60 / h / utilisateur |
| Candidature publique | 5 / h / IP |
| Demande de démo | 3 / h / IP |
| Scan de pointage | 30 / min / appareil |
| Endpoints IA | quota `usage_counters.ai_credits` du plan |
| Export CSV/Excel | 5 / h / utilisateur |

Réponse `429` avec `Retry-After` et `X-RateLimit-{Limit,Remaining,Reset}`.

## 9. En-têtes et transport

- HTTPS obligatoire, HSTS `max-age=31536000; includeSubDomains; preload`.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: geolocation=(self)`,
  `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`
  (API pure, aucune ressource embarquée).
- CORS : liste blanche d'origines par environnement (`CORS_ORIGINS`),
  `credentials: true`, méthodes et en-têtes explicites. **Jamais `*`** avec
  credentials.
- Compression laissée à la couche edge/reverse proxy, pas à l'application.

## 10. Anti-SSRF (webhooks sortants)

Toute URL fournie par un client (webhook n8n, callback) passe par
`validateOutboundUrl()` :

1. schéma `https:` uniquement ;
2. pas d'identifiants dans l'URL ;
3. port 443 uniquement ;
4. hôte ASCII `[a-z0-9.-]`, FQDN avec un point, pas de punycode suspect ;
5. rejet de `localhost`, `.local`, `.internal`, `.lan`, `.corp`, `.home`,
   `metadata.google.internal`, `169.254.169.254` ;
6. rejet de **toute IP littérale** (v4 et v6) — nom de domaine exigé ;
7. **résolution DNS avant appel** et rejet si l'IP résolue est privée,
   loopback, link-local, CGNAT, multicast ou réservée ; la connexion est
   établie sur l'IP validée (protection anti-rebinding) ;
8. `redirect: 'manual'` — toute redirection est un échec ;
9. timeout 20 s, réponse lue avec une taille maximale de 256 Ko ;
10. les appels sortants partent d'un worker isolé, sans accès au réseau interne.

Les appels sortants sont signés : en-têtes `X-Konkoure-Signature`
(HMAC-SHA256 du corps avec le secret d'organisation) et `X-Konkoure-Timestamp`.

## 11. Webhooks entrants

1. Lecture du **corps brut** avant tout parsing.
2. Vérification HMAC en `timingSafeEqual`.
3. Rejet si `timestamp` s'écarte de plus de 5 minutes (anti-rejeu).
4. Insertion dans `webhook_receipts` avec `UNIQUE(provider, event_id)` ;
   un doublon renvoie `200` sans retraiter.
5. Traitement **asynchrone** (mise en file) : la réponse HTTP est immédiate.
6. Un montant/état reçu n'est jamais cru sur parole : rapprochement avec
   l'API du fournisseur avant de créditer un abonnement.

## 12. Secrets

- Uniquement via variables d'environnement validées, injectées par le
  gestionnaire de secrets de l'hébergeur. Aucun `.env` en production.
- Secrets applicatifs stockés en base (tokens sociaux, secrets webhook)
  chiffrés avec `APP_KEY` via le module `encryption` d'Adonis.
- Rotation documentée : `APP_KEY` (annuelle, avec période de double clé),
  `NFC_UID_PEPPER` (rotation exige un recalcul des `uid_hash`),
  clés fournisseurs (Djomy, Resend) au besoin.
- Interdiction absolue de journaliser un secret ; un filtre Pino masque les clés
  `password`, `token`, `secret`, `authorization`, `apiKey`, `uid`.

## 13. RGPD et rétention

| Donnée | Rétention |
|---|---|
| `time_logs` | 24 mois puis archivage froid |
| `audit_logs` | 24 mois (obligation de traçabilité) |
| `system_logs` | 30 jours |
| `usage_events` | 12 mois |
| `notifications` | 180 jours |
| Candidatures non retenues | 24 mois après clôture de l'offre, puis anonymisation |
| Documents candidats | supprimés du stockage à l'anonymisation |
| Comptes supprimés | anonymisation immédiate, journaux conservés sans PII |

Droits : `GET /me/export` produit une archive JSON des données personnelles ;
`DELETE /me` déclenche la procédure d'anonymisation (avec validation `owner`
si l'utilisateur est le dernier propriétaire d'une organisation).

## 14. Checklist sécurité par endpoint

Avant de considérer un endpoint terminé :

- [ ] validator VineJS complet, bornes sur tous les champs
- [ ] policy Bouncer appelée avant toute mutation
- [ ] requêtes passant par un repository scopé org
- [ ] FK reçues vérifiées dans l'organisation
- [ ] champs sensibles absents de la réponse par défaut
- [ ] audit écrit si mutation sensible
- [ ] rate limit adapté
- [ ] test fonctionnel d'isolation tenant (org A ne voit pas org B)
- [ ] test d'autorisation par rôle (au moins un cas autorisé, un cas refusé)
