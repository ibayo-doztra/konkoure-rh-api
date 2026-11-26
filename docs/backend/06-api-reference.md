# 06 — Référence de l'API

Base : `/api/v1`. Toutes les routes `/org/*` exigent
`Authorization: Bearer <access_token>` **et** `X-Organization-Id: <uuid>`.

Notation des permissions : `O` owner, `H` hr_admin, `M` manager, `E` employee,
`R` recruiter, `S` security_agent, `self` propre ressource,
`team` périmètre managérial. `—` = public.

Conventions communes : pagination (01 §7), erreurs (01 §6),
`Idempotency-Key` sur les mutations marquées ⚡.

---

## 1. Authentification `/auth`

| Méthode | Chemin | Perm. | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Création de compte |
| POST | `/auth/login` | — | Connexion |
| POST | `/auth/refresh` | — (refresh token) | Rotation des jetons |
| POST | `/auth/logout` | auth | Révoque la session courante |
| POST | `/auth/logout-all` | auth | Révoque toutes les sessions |
| POST | `/auth/forgot-password` | — | Envoi du lien de réinitialisation |
| POST | `/auth/reset-password` | — | Application du nouveau mot de passe |
| POST | `/auth/verify-email` | — | Vérification via token |
| POST | `/auth/resend-verification` | auth | Renvoi de l'e-mail (3/24 h) |
| GET | `/auth/invitations/:token` | — | Aperçu d'une invitation (org, rôle) |
| POST | `/auth/invitations/:token/accept` | — | Acceptation |

### `POST /auth/register`

```ts
vine.object({
  email: vine.string().trim().email().maxLength(255).normalizeEmail(),
  password: vine.string().minLength(10).maxLength(128).confirmed(),
  fullName: vine.string().trim().minLength(2).maxLength(120),
  preferredLanguage: vine.enum(['fr','en']).optional(),
  acceptTerms: vine.boolean().isTrue(),
})
```

`201` :
```json
{ "data": {
  "user": { "id":"0192…","email":"a@b.com","fullName":"A B","emailVerified":false },
  "accessToken": "oat_…", "expiresIn": 900,
  "refreshToken": "rt_…", "refreshExpiresIn": 2592000,
  "organizations": []
}}
```
Erreurs : `422 E_VALIDATION`, `409 E_CONFLICT` (e-mail déjà utilisé — message
générique côté client), `429`.

### `POST /auth/login`
Entrée : `{ email, password, deviceLabel?, rememberDevice? }`.
`deviceLabel` est envoyé par l'application mobile : il est enregistré sur la
session et sélectionne la durée de refresh mobile (`REFRESH_TOKEN_TTL_MOBILE`,
90 j au lieu de 30). `rememberDevice` est accepté mais sans effet pour l'instant.
`200` : même charge utile que `register`, plus la liste des organisations
(`{ id, name, slug, logoUrl, roles[] }`).
Erreurs : `401 E_UNAUTHORIZED`, `423 E_ACCOUNT_LOCKED`,
`409 E_PASSWORD_RESET_REQUIRED` (un lien de réinitialisation est envoyé), `429`.

`register`, `login` et `refresh` posent aussi le refresh token dans le cookie
`konkoure_refresh` (signé, `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`,
`Secure` en production, domaine `REFRESH_COOKIE_DOMAIN`). Le client web l'utilise
et ignore `refreshToken` du corps ; le mobile utilise le corps.

### `POST /auth/refresh`
Entrée : `{ refreshToken }` ou cookie httpOnly (corps vide).
`200` : `{ accessToken, expiresIn, refreshToken, refreshExpiresIn }`. L'access
token précédent de la session cesse de fonctionner.
Erreurs : `401 E_UNAUTHORIZED` (inconnu, expiré, ou réutilisation détectée ⇒
famille révoquée), `429` (60 / h / utilisateur).

### Autres réponses de `/auth`
`logout`, `logout-all`, `forgot-password`, `reset-password`, `verify-email`,
`resend-verification` répondent `204` sans corps.
- `POST /auth/forgot-password` : `{ email }`. Lien envoyé :
  `${WEB_APP_URL}/reset-password?token=…`. `429` au-delà de 3 / h / e-mail.
- `POST /auth/reset-password` : `{ token, password, password_confirmation }`.
  Lien invalide, expiré ou déjà utilisé ⇒ `422` avec `details[0].field = "token"`.
- `POST /auth/verify-email` : `{ token }` (lien `${WEB_APP_URL}/verify-email?token=…`,
  jeton signé contenant l'adresse). Invalide ⇒ `422`, `field = "token"`.
- Politique de mot de passe (04 §2) : un refus renvoie `422` avec
  `details[0].rule` ∈ `composition | common | personal`.

### Invitations (lien `${WEB_APP_URL}/invitation?token=…`)
- `GET /auth/invitations/:token` → `200`
  `{ organizationName, email, role, expiresAt, accountExists }`. Jeton inconnu,
  expiré, révoqué ou déjà accepté ⇒ `404 E_NOT_FOUND`.
- `POST /auth/invitations/:token/accept` :
  `{ password, password_confirmation, fullName? }` → `200`, même charge utile
  que `login` (cookie de refresh compris).
  - **Nouveau compte** : créé avec ce mot de passe (politique 04 §2), e-mail
    considéré comme vérifié par le lien.
  - **Compte existant** (`accountExists: true`) : `password` est son mot de
    passe actuel, contrôlé comme `/auth/login` (`401`, `423`, `409
    E_PASSWORD_RESET_REQUIRED`) ; le rôle est simplement ajouté. Un lien
    d'invitation ne vaut donc jamais connexion sans mot de passe.
  - Lien inutilisable ⇒ `404`. Journaux `invitation.accepted` + `role.granted`.

---

## 2. Utilisateur courant `/me`

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/me` | Profil + organisations + rôles |
| PATCH | `/me` | `fullName`, `avatarUrl`, `preferredLanguage` |
| POST | `/me/password` | Changement (exige l'actuel) |
| GET | `/me/sessions` | Sessions actives (appareil, IP, dernière activité) |
| DELETE | `/me/sessions/:id` | Révoque une session |
| GET | `/me/organizations` | Organisations accessibles |
| GET | `/me/employee` | Fiche employé dans l'organisation courante |
| GET | `/me/notifications` | Curseur, `?unreadOnly=true` |
| POST | `/me/notifications/:id/read` | Marque lue |
| POST | `/me/notifications/read-all` | Marque tout lu |
| GET | `/me/export` | Export RGPD (job asynchrone, renvoie un lien) |
| DELETE | `/me` | Suppression / anonymisation |

### `GET /me`
Également renvoyé par `PATCH /me`.

```json
{ "data": {
  "user": { "id":"0192…", "email":"a@b.com", "fullName":"A B", "avatarUrl":null,
            "emailVerified":false, "preferredLanguage":"fr",
            "mustChangePassword":false },
  "isPlatformAdmin": false,
  "platformLevel": null,
  "organizations": [
    { "id":"0192…", "name":"Doztra", "slug":"doztra", "logoUrl":null,
      "defaultLanguage":"fr", "defaultCurrency":"GNF", "plan":"free",
      "performanceModel":"sap", "roles":["owner"] }
  ],
  "employee": { "id":"0192…", "firstName":"A", "lastName":"B" },
  "subscription": { "planCode":"free", "planName":"Gratuit", "maxEmployees":10,
                    "aiCreditsPerMonth":20, "status":"trialing",
                    "currentPeriodEnd":null, "cycle":"monthly", "priceGnf":0,
                    "trialEndsAt":"2026-12-16T00:00:00.000Z", "planEffective":false },
  "modules": ["hr","timeclock","leaves","performance","settings"]
}}
```

- Le serveur ne choisit jamais l'organisation active (01 §4) : le client choisit
  dans `organizations` et envoie `X-Organization-Id`.
- `mustChangePassword` reflète `users.must_reset_password` (comptes importés).
- `platformLevel` (ajouté le 2026-11-25) : `support | root` pour un admin plateforme
  actif, `null` sinon (admin désactivé compris) ; `isPlatformAdmin` vaut
  `platformLevel !== null`. Le client s'en sert pour masquer les actions réservées à root.
- `GET /me` accepte un en-tête `X-Organization-Id` **optionnel**. `employee`,
  `subscription` et `modules` (droits effectifs calculés serveur) sont ceux de cette
  organisation. Sans en-tête, ou s'il est invalide ou désigne une organisation dont
  l'utilisateur n'est pas membre : `subscription: null`, `modules: []`, sans erreur.
- `status` ∈ `trialing | active | past_due | suspended | canceled | expired` (statut
  effectif à l'instant de la requête) ; `cycle` ∈ `monthly | yearly`.
- `organizations[].plan` est le code de l'offre courante, `null` sans abonnement.
- **Tant que le module RH n'est pas livré**, `employee` vaut `null`.

`GET /me/organizations` renvoie `{ data: [...] }` avec les mêmes éléments que
`organizations` ci-dessus.

### Notifications `/me/notifications` (décisions du 2026-11-20)
- **Organisation courante** : ces routes exigent `X-Organization-Id` (la table est
  tenant, sous RLS) ; la cloche suit l'organisation sélectionnée.
- `GET /me/notifications?cursor&limit (1..100, défaut 50)&unreadOnly=true` ⇒
  `{ data: [{ id, type, title, body, link, payload, readAt, createdAt }], meta:
  { nextCursor, unreadCount } }`, tri `createdAt desc` ; `nextCursor` est `null` sur la
  dernière page ; un curseur non émis par l'API ⇒ `422` (champ `cursor`).
- `POST /me/notifications/:id/read` ⇒ `200` avec la notification ; celle d'un autre
  utilisateur ou d'une autre organisation ⇒ `404`. `POST /me/notifications/read-all` ⇒
  `200 { data: { updated } }`.
- **Seule l'API crée des notifications**, à partir des événements métier (08 §3) ; il
  n'existe pas de `POST /me/notifications`. `title` et `body` sont rendus à la création
  dans la langue du destinataire ; `link` est le chemin du front (`/leaves/:id`,
  `/employees/:id`, `/timeclock`), `payload` les identifiants utiles. Types émis à ce
  jour : `leave.requested`, `leave.decided`, `contract.expiring`, `badge.assigned` ; les
  autres de 07 §8 arrivent avec leurs modules.

### `GET /me/export` (décision du 2026-11-26)
Export RGPD des données personnelles (05 §13). `202 { data: { jobId } }` ; 1 export par
heure et par utilisateur (`429` au-delà) ; audit `user.exported` (sans organisation) ;
refusé en impersonation. Le job `users.export` écrit une archive JSON dans l'espace privé
(clé `users/<userId>/export/<jobId>.json`, hors registre `files` qui est tenant) et envoie
à l'utilisateur un lien signé valable 24 h (08 §9). Contenu : `exportedAt`, `user`
(profil, `emailVerifiedAt`, `lastLoginAt`, `createdAt`), `sessions`, et
`organizations[]` (organisations dont il est membre) : `{ id, name, roles,
notifications, employee }`, `employee` valant `null` sans fiche liée, sinon
`{ profile (avec baseSalary, salaryCurrency), contracts, skills, leaveRequests,
leaveBalances, leaveLedger, timeLogs, attendanceDays, badges, reviews, goals, okrs,
feedbackReceived, feedbackGiven, achievements }`, dans les formes des endpoints
correspondants et **telles que l'employé les lit** : évaluations sans synthèse IA ni
scores 9-box, côté manager visible seulement à partir de `sent_back`, auteur d'un
feedback privé reçu masqué, badges sans empreinte d'UID. Compte désactivé au moment du
job : rien n'est produit.

### `DELETE /me` (décision du 2026-11-26)
Suppression RGPD du compte (04 §3, 05 §13). Corps `{ password }` : absent ⇒ `422`,
faux ⇒ `422` (champ `password`, règle `invalid`). Refusée en impersonation. `409`
`E_CONFLICT` si l'utilisateur est le **seul owner actif** d'une organisation non
supprimée : un détail par organisation, `{ field: "organizations.<id>", rule: "lastOwner" }`
(nommer un autre owner ou supprimer l'organisation d'abord) ; `409` règle `lastRoot`
(champ `platform`) pour le dernier root plateforme actif. Sinon `204`, dans une seule
transaction : compte anonymisé (`email = deleted+<id>@invalid`, `fullName`, `avatarUrl` et
mot de passe vidés, `is_active = false`, `deleted_at` posé), toutes les sessions révoquées,
tous les rôles retirés, jetons de réinitialisation supprimés, fiche admin plateforme
désactivée ; dans chaque organisation, la fiche employé est **conservée** mais détachée du
compte (`user_id = null`) et les notifications de l'utilisateur sont supprimées. Audit
`user.deleted` sans e-mail ni organisation. L'ancienne adresse redevient libre pour une
nouvelle inscription.

### `GET /me/sessions`
`{ data: [{ id, deviceLabel, ip, userAgent, startedAt, lastActivityAt, expiresAt,
current }] }` : une entrée par famille de refresh tokens ouverte ; `id` est
l'identifiant de famille utilisé par `DELETE /me/sessions/:id` (session d'un
autre utilisateur ⇒ `404`).

### `POST /me/password`
`{ currentPassword, password, password_confirmation }` → `204`. Mot de passe
actuel faux ⇒ `422`, `field = "currentPassword"`. Révoque toutes les autres
sessions, conserve la session courante.

---

## 3. Organisation `/org`

| Méthode | Chemin | Perm. | Description |
|---|---|---|---|
| POST | `/organizations` | auth (e-mail vérifié) | Crée une organisation, le créateur devient `owner` |
| GET | `/org` | tous | Détail de l'organisation courante |
| PATCH | `/org` | O H | Nom, langue, devise, fuseau, modèle de performance |
| PUT | `/org/settings` | O H | Bloc `settings` complet (schéma 02 §11) |
| POST | `/org/logo` | O H | Upload logo (2 Mo, png/jpg/webp) |
| DELETE | `/org` | O | Suppression (confirmation par nom, purge différée 30 j) |
| GET | `/org/members` | O H | Utilisateurs et rôles |
| PATCH | `/org/members/:userId/roles` | O H* | Modifie les rôles (*`hr_admin` ne peut pas toucher `owner`) |
| DELETE | `/org/members/:userId` | O H | Retire l'accès |
| GET | `/org/invitations` | O H | Liste |
| POST | `/org/invitations` ⚡ | O H | Invite un e-mail |
| POST | `/org/invitations/:id/resend` | O H | Relance (3/24 h) |
| DELETE | `/org/invitations/:id` | O H | Révoque |
| GET | `/org/entitlements` | tous | Modules et quotas effectifs du plan |
| GET | `/org/dashboard` | tous | KPI agrégés, `?period=week\|month\|quarter` |

### `POST /organizations`
```ts
vine.object({
  name: vine.string().trim().minLength(2).maxLength(120),
  defaultLanguage: vine.enum(['fr','en']).optional(),       // défaut 'fr'
  performanceModel: vine.enum(['classic','sap']).optional(), // défaut 'sap'
})
```
Le `slug` est généré par le serveur à partir du nom (ASCII minuscule, tirets,
60 caractères au plus, suffixe `-2`, `-3`… s'il est pris) ; un `slug` envoyé par
le client est ignoré. Pays `GN`, fuseau `Africa/Conakry` et devise `GNF` par défaut.

`201` : un élément au format de `GET /me` → `organizations[]` :
```json
{ "data": { "id":"0192…", "name":"Doztra", "slug":"doztra", "logoUrl":null,
  "defaultLanguage":"fr", "defaultCurrency":"GNF", "plan":"free",
  "performanceModel":"sap", "roles":["owner"] }}
```
Création, rôle `owner`, abonnement d'essai de 30 jours (plan `free`) et journaux
`organization.created`, `role.granted`, `subscription.changed` dans une seule
transaction, avec la fiche employé liée au créateur (04 §3, journal `employee.created`).
Erreurs : `401`, `403 E_EMAIL_NOT_VERIFIED`, `422`, `429`.

### Contexte `/org/*`
En-tête `X-Organization-Id` absent ou non uuid ⇒ `400 E_BAD_REQUEST`
(`details[0].field = "X-Organization-Id"`) ; e-mail non vérifié ⇒
`403 E_EMAIL_NOT_VERIFIED` ; aucun rôle dans cette organisation ⇒ `403 E_FORBIDDEN`.

### Organisation courante `/org`
`GET`, `PATCH`, `PUT /settings` et `POST /logo` renvoient :
```json
{ "data": { "id":"0192…", "name":"Doztra", "slug":"doztra", "logoUrl":null,
  "countryCode":"GN", "timezone":"Africa/Conakry", "defaultLanguage":"fr",
  "defaultCurrency":"GNF", "performanceModel":"sap", "settings":{ },
  "createdAt":"…", "updatedAt":"…" }}
```
`settings` est complété par les valeurs par défaut (02 §11).
- `PATCH` : `name`, `defaultLanguage`, `defaultCurrency` (`GNF` uniquement),
  `timezone` (IANA), `performanceModel`, tous facultatifs. Le `slug` ne change pas.
- `PUT /settings` : le corps est le bloc complet et remplace le précédent.
- `POST /logo` : `multipart/form-data`, champ `logo`. Type réel vérifié par
  signature ; SVG refusé (05 §3). Plus de 2 Mo ⇒ `413 E_PAYLOAD_TOO_LARGE`.
- `DELETE` `{ confirmName }` → `204`. Nom différent ⇒ `422`,
  `details[0].rule = "mismatch"`. L'accès cesse immédiatement.
  Décisions du 2026-11-26 : pendant 30 jours, un `root` peut annuler la suppression
  (`POST /platform/organizations/:id/restore`, §13). Ensuite, la tâche
  `organizations:purge` supprime les fichiers de l'organisation (préfixe `<orgId>/` des
  deux espaces) et toutes ses lignes tenant, **sauf** les paiements, les factures (et
  leurs PDF, sous `invoices/<orgId>/`), les abonnements et les journaux d'audit. La ligne
  `organizations` reste, anonymisée (nom `Organisation supprimée`, slug
  `deleted-<id>`, logo et réglages effacés) avec `purged_at` ; journal
  `organization.purged` (acteur `system`, ancien nom et slug). Les comptes
  utilisateurs restent, seuls leurs rôles dans l'organisation disparaissent.
- Journaux `organization.updated`, `organization.settings_updated`,
  `organization.logo_updated`, `organization.deleted`.

### Membres `/org/members`
Élément renvoyé :
```json
{ "userId":"0192…", "email":"a@b.com", "fullName":"…", "avatarUrl":null,
  "roles":["manager"], "joinedAt":"…" }
```
- `GET` : pagination offset (`?page`, `?perPage` ≤ 100). `{ data, meta }`.
- `PATCH /:userId/roles` `{ roles: [...] }` (liste complète, au moins un rôle) → `200`.
  Modifier ses propres rôles ⇒ `403`.
- `DELETE /:userId` → `204`. Un membre peut se retirer lui-même.
- `hr_admin` ne peut ni attribuer `owner`, ni modifier ou retirer un `owner` (`403`).
- Dernier `owner` actif ⇒ `409`, `details[0].rule = "lastOwner"`.
- Utilisateur non membre de l'organisation ⇒ `404`. Journaux `role.granted`,
  `role.revoked`.

### Invitations `/org/invitations`
Élément renvoyé (jamais le jeton ni son hash) :
```json
{ "id":"0192…", "email":"a@b.com", "role":"manager", "status":"pending",
  "expiresAt":"…", "invitedBy":"0192…", "sendCount":1, "lastSentAt":"…",
  "acceptedAt":null, "createdAt":"…" }
```
`status` ∈ `pending | accepted | revoked | expired` ; une invitation en attente
dont la date est passée est renvoyée `expired`.
- `GET` : pagination offset (`?page`, `?perPage` ≤ 100), filtre
  `?filter[status]=`, tri `created_at` décroissant. `{ data, meta }`.
- `POST` ⚡ `{ email, role, employeeId? }` → `201`. Lien valable 7 jours, e-mail envoyé après
  commit. Seul un `owner` peut inviter un `owner` (`403` sinon). Déjà membre ⇒
  `409`, `details[0].rule = "alreadyMember"` ; invitation en attente valide ⇒
  `409`, `rule = "pending"` (une invitation en attente expirée est remplacée).
- `POST /:id/resend` → `200` : nouveau lien, nouvelle échéance à 7 jours, l'ancien
  lien cesse de fonctionner. 3 envois / 24 h (`429`). Non `pending` ⇒ `409`,
  `rule = "notPending"`.
- `DELETE /:id` → `204` (statut `revoked`). Non `pending` ⇒ `409`.
- Invitation d'une autre organisation ⇒ `404`. Journaux `invitation.sent`,
  `invitation.resent`, `invitation.revoked`.
- `employeeId` lie le compte à cette fiche à l'acceptation. Fiche absente de
  l'organisation ⇒ `422` ; fiche ou compte déjà lié ⇒ `409`,
  `rule = "alreadyLinked"`. L'élément renvoyé porte aussi `employeeId`.

### `GET /org/entitlements`
`{ data: { planCode, status, modules, readOnlyModules, maxEmployees,
aiCreditsPerMonth, trialEndsAt, currentPeriodEnd } }`. `readOnlyModules` liste les
modules accessibles en lecture seule (abonnement suspendu ou expiré). Organisation
sans abonnement ⇒ `403 E_SUBSCRIPTION_INACTIVE`.

### `GET /org/dashboard`
Renvoie, filtré selon le rôle (un `employee` ne voit que ses propres chiffres) :

```json
{ "data": {
  "period": { "from":"2026-09-01","to":"2026-09-30" },
  "headcount": { "total": 128, "active": 121, "onLeave": 5, "newHires": 4, "exits": 1 },
  "attendance": { "punctualityRate": 0.93, "avgWorkedHours": 7.6,
                  "absencesToday": 3, "outOfZonePunches": 2 },
  "leaves": { "pending": 6, "approvedThisPeriod": 14, "daysTaken": 52 },
  "recruitment": { "openJobs": 3, "newCandidates": 27, "hired": 2 },
  "performance": { "reviewsInProgress": 18, "reviewsSigned": 42,
                   "avgGoalProgress": 61 },
  "payroll": { "total": 182500000, "currency": "GNF" },
  "previous": {
    "period": { "from":"2026-08-01","to":"2026-08-31" },
    "headcount": { "total": 124, "active": null, "onLeave": null, "newHires": 3, "exits": 0 },
    "attendance": { "punctualityRate": null, "avgWorkedHours": 7.4,
                    "absencesToday": null, "outOfZonePunches": 5 },
    "leaves": { "pending": null, "approvedThisPeriod": 11, "daysTaken": 40 },
    "recruitment": { "openJobs": null, "newCandidates": 19, "hired": 1 },
    "performance": { "reviewsInProgress": null, "reviewsSigned": 30, "avgGoalProgress": null },
    "payroll": { "total": 179000000, "currency": "GNF" }
  },
  "series": { "headcountByMonth": [], "punchesByDay": [], "leavesByType": [] }
}}
```
Sources : `attendance_days`, `leave_balances`, agrégats précalculés. Cache Redis
5 min, clé `dash:v2:<orgId>:<period>:<roleScope>[:rec][:pay]` (suffixes selon que le
rôle voit le recrutement ou la masse salariale).

Décisions du 2026-11-20 :
- **Période** : semaine (lundi–dimanche), mois ou trimestre calendaire **en cours**, dans
  le fuseau de l'organisation ; défaut `month` ; autre valeur ⇒ `422`.
- **Périmètre** : O H toute l'organisation ; manager son équipe et lui-même ; tout autre
  rôle sa propre fiche ; sans fiche employé liée, des zéros. `roleScope` vaut `org`,
  `team:<employeeId>` ou `self:<employeeId>`.
- **Indicateurs** : `headcount.total` exclut les fiches `terminated` ; `newHires` et
  `exits` comptent `hire_date` et `end_date` dans la période. `attendance.avgWorkedHours` =
  moyenne des journées complètes (`null` sans journée) ; `absencesToday` = les absents de
  `GET /org/timeclock/today` ; `outOfZonePunches` = pointages `out_of_zone` de la période ;
  `punctualityRate` = part des journées prévues à l'horaire (`lateMinutes` non nul) dont le
  retard ne dépasse pas la tolérance, arrondie à 0,01, `null` sans journée prévue. `leaves.pending`
  sans condition de date, `approvedThisPeriod` selon `decided_at`, `daysTaken` = jours
  approuvés commençant dans la période. Séries : `headcountByMonth` sur 12 mois
  `[{ month: 'YYYY-MM', total }]`, `punchesByDay` `[{ day, count }]` (jours sans pointage
  omis), `leavesByType` `[{ type, days }]`.
- **Modules** : un bloc (ou une série) dont le module n'est pas dans les droits de
  l'organisation vaut `null` (`hr` : effectifs, `timeclock` : présence, `leaves` : congés).
  La route n'a donc pas de middleware d'entitlement.
- **Recrutement, masse salariale et période précédente** (2026-11-26) :
  - `recruitment` (module `recruitment`) : toute l'organisation, pour `owner`, `hr_admin`
    et `recruiter`, `null` pour les autres rôles. `openJobs` = offres `published` ;
    `newCandidates` = candidatures reçues dans la période ; `hired` = candidats passés à
    `hired` dans la période (événement `stage_changed`).
  - `payroll` (module `hr`, donnée sensible) : `owner` et `hr_admin` seulement, `null`
    pour tous les autres rôles, manager compris. `total` = somme des `contracts.salary`
    des contrats `active` en vigueur aujourd'hui (début passé, fin absente ou à venir),
    un par employé non supprimé (le plus récent), dans la devise de l'organisation
    (`currency`) ; les contrats dans une autre devise sont ignorés, jamais additionnés.
  - `previous` : les mêmes blocs pour la période équivalente précédente (semaine, mois
    ou trimestre d'avant), sans `series`, avec les mêmes règles de `null` (module, rôle).
    Les indicateurs d'état à l'instant présent ne sont pas historisés et valent `null` :
    `headcount.active`, `onLeave`, `attendance.absencesToday`,
    `leaves.pending`, `recruitment.openJobs`, `performance.reviewsInProgress` et
    `avgGoalProgress`. `headcount.total` = effectif présent le dernier jour de la période
    (embauché avant, sans départ antérieur). `payroll` = contrats en vigueur ce jour-là,
    quel que soit leur statut actuel, sauf `draft`. Le client calcule les écarts.
- **Performance** (2026-11-23) : `reviewsInProgress` = évaluations du périmètre non
  signées ; `reviewsSigned` = signées dans la période ; `avgGoalProgress` = moyenne
  arrondie de la progression des objectifs non supprimés et non annulés (`null` sans
  objectif).

---

## 4. Employés `/org/employees`

| Méthode | Chemin | Perm. |
|---|---|---|
| GET | `/org/employees` | O H · M(team) · R S (champs réduits) |
| GET | `/org/employees/:id` | O H · M(team) · self |
| POST | `/org/employees` | O H |
| PATCH | `/org/employees/:id` | O H |
| DELETE | `/org/employees/:id` | O H (soft delete) |
| POST | `/org/employees/:id/restore` | O H |
| GET | `/org/employees/:id/salary` | O H · self |
| GET | `/org/employees/:id/documents` | O H · self |
| POST | `/org/employees/:id/documents` | O H · self |
| GET | `/org/employees/:id/documents/:docId/url` | O H · self (audité) |
| DELETE | `/org/employees/:id/documents/:docId` | O H |
| POST | `/org/employees/:id/photo` | O H · self |
| GET | `/org/employees/:id/team` | O H · M(team) |
| GET | `/org/employees/managers` | O H M | Liste des responsables éligibles N+1 |
| GET | `/org/employees/directory` | tous | Annuaire en champs réduits (ajouté le 2026-11-23) |
| POST | `/org/employees/import/preview` | O H | Analyse d'un fichier Excel/CSV |
| POST | `/org/employees/import/commit` ⚡ | O H | Import effectif |
| POST | `/org/employees/export` | O H | CSV/XLSX asynchrone, `202 { jobId }` (5/h, 08 §9) |

#### Documents et photo (décisions du 2026-11-19)
Les documents sont des lignes du registre `files` (02 §10) avec
`owner_type = 'employee'`, une `category` et un `name`.
- `POST /:id/documents` (multipart) : `file` (≤ 10 Mo, PDF, PNG, JPEG ou WebP vérifiés
  par signature), `category` ∈ `passport`, `national_id`, `diploma`, `certificate`,
  `medical`, `other`, `name` (2..120, défaut : nom d'origine assaini) ⇒ `201`
  `{ id, category, name, mime, sizeBytes, uploadedBy, createdAt }`, audité
  `employee.document_added`. Le chemin de stockage n'est jamais renvoyé.
- `GET /:id/documents` ⇒ `{ data: [ … ] }`, plus récent d'abord.
- `GET /:id/documents/:docId/url` ⇒ `{ url, expiresIn: 900 }`, audité
  `sensitive_document.viewed`.
- `DELETE /:id/documents/:docId` (O H) ⇒ `204`, audité `employee.document_deleted`.
- `POST /:id/photo` (multipart `file`, PNG, JPEG ou WebP, ≤ 2 Mo) : bucket public
  comme le logo, `photoUrl` mis à jour, l'ancienne photo supprimée ; réponse : la
  fiche (champs selon le lecteur), audité `employee.photo_updated`.

#### Import et export (décisions du 2026-11-19)
Colonnes communes (en-têtes français à l'export ; à l'import, en-tête français ou
anglais, casse et accents ignorés, colonnes inconnues ignorées) : `Matricule`,
`Nom`*, `Prénom`*, `E-mail`, `Téléphone`, `Poste`, `Département` (par nom),
`Manager` (« Prénom Nom »), `Date d'embauche`, `Date de naissance`
(`AAAA-MM-JJ` ou `JJ/MM/AAAA`). L'export ajoute `Statut`, `Date de fin`,
`Type de contrat` ; jamais le salaire. CSV : UTF-8 avec BOM, séparateur `;`
(l'import accepte `;` ou `,`) ; une cellule commençant par `= + - @` est préfixée
d'une apostrophe (injection de formule).

`POST /org/employees/import/preview` (multipart `file`, XLSX ou CSV détecté par
le contenu, ≤ 5 Mo, ≤ 2 000 lignes) ⇒
```json
{ "data": { "importToken": "imp_…", "expiresIn": 1800,
  "summary": { "total": 5, "create": 1, "update": 1, "skip": 1, "error": 2 },
  "rows": [{ "line": 2, "action": "update", "name": "Mamadou Diallo", "employeeId": "…" }],
  "errors": [{ "line": 5, "field": "email", "rule": "email", "message": "Adresse e-mail invalide." }] } }
```
Une ligne existante (même matricule, sinon même e-mail) est mise à jour avec ses
seules cellules non vides (`update`, ou `skip` si rien ne change). Règles :
`required`, `length`, `email`, `date`, `duplicateInFile`, `emailTaken`,
`unknownDepartment`, `unknownManager`, `ambiguousManager`, `cycle`,
`quotaExceeded` (ligne 0). Format, en-têtes ou taille invalides ⇒ `422`
(`format`, `missingColumn`, `tooManyRows`).

`POST /org/employees/import/commit` ⚡ `{ importToken }` (même utilisateur, 30 min) :
replanifie sur les données courantes ; la moindre erreur ⇒ `422 E_VALIDATION`
(détails `line:<n>.<champ>`) et rien n'est écrit ; sinon
`{ created, updated, skipped, errors: [] }`, audité `employee.imported`.
Jeton expiré ou déjà utilisé ⇒ `422` règle `expired`.

`POST /org/employees/export` `{ format: 'csv'|'xlsx', filter?: { status,
departmentId, managerId, contractType } }` ⇒ `202 { jobId }` ; 5 par heure et par
utilisateur (`429`). Le fichier est déposé dans `private-docs` et un e-mail
envoie un lien signé valable 24 h (08 §9), audité `employee.exported`.

Filtres `GET /org/employees` : `q` (nom, e-mail, matricule),
`filter[status]`, `filter[departmentId]`, `filter[managerId]`,
`filter[contractType]`, `sort` ∈ `last_name`, `hire_date`, `created_at`.

### `POST /org/employees`
```ts
vine.object({
  firstName: vine.string().trim().minLength(2).maxLength(80),
  lastName: vine.string().trim().minLength(2).maxLength(80),
  email: vine.string().trim().email().maxLength(255).optional(),
  phone: vine.string().trim().maxLength(30).optional(),
  employeeNumber: vine.string().trim().maxLength(40).optional(),
  jobTitle: vine.string().trim().maxLength(120).optional(),
  departmentId: vine.string().uuid().existsInOrg('departments').optional(),
  managerId: vine.string().uuid().existsInOrg('employees').optional(),
  hireDate: vine.date().optional(),
  status: vine.enum(['active','on_leave','suspended','terminated']).optional(),
  baseSalary: vine.number().min(0).max(1_000_000_000).optional(),
  salaryCurrency: vine.string().fixedLength(3).optional(),
  birthDate: vine.date().optional(),
  address: vine.object({ line1: vine.string().maxLength(200).optional(),
                         city: vine.string().maxLength(80).optional(),
                         country: vine.string().fixedLength(2).optional() }).optional(),
  emergencyContact: vine.object({ name: vine.string().maxLength(120).optional(),
                                  phone: vine.string().maxLength(30).optional(),
                                  relation: vine.string().maxLength(60).optional() }).optional(),
})
```
Règles : `409 E_CONFLICT` si l'e-mail ou le matricule existe déjà dans
l'organisation ; `403 E_QUOTA_EXCEEDED` si le nombre d'employés actifs atteint
`max_employees` du plan ; `managerId` ne doit pas créer de cycle hiérarchique.

`GET /org/employees/managers` retourne uniquement les employés `active` qui sont
responsables d'un département, déjà `manager_id` d'au moins un employé ou
porteurs du rôle `manager` (règle métier 07 §1.4), en champs réduits.

`GET /org/employees/directory` (décision du 2026-11-23, sélecteurs de collègue
comme le destinataire d'un feedback) : tout membre lit les employés `active` et
`on_leave` en champs réduits, triés par nom ; `page`, `perPage`, `q` (nom seul),
`filter[departmentId]`. Le périmètre de `GET /org/employees` ne change pas.

### Réponses employé
Les champs dépendent du lecteur (04 §5, 05 §5) :
- **réduits** (`recruiter`, `security_agent`, `/managers`, `/directory`) : `id`, `firstName`,
  `lastName`, `jobTitle`, `departmentId`, `photoUrl` ;
- **équipe** (`manager` sur son équipe) : réduits + `userId`, `employeeNumber`,
  `email`, `phone`, `managerId`, `hireDate`, `endDate`, `status`, `leaveBalance`,
  `createdAt`, `updatedAt` ;
- **complets** (`owner`, `hr_admin`, soi-même) : équipe + `birthDate`, `address`,
  `emergencyContact`.

Le salaire n'apparaît que dans `GET /:id/salary` : `{ baseSalary, salaryCurrency }`,
journal `salary.viewed`. Un `employee` voit sa seule fiche dans la liste (04 §5).
Les recruteurs et agents ne cherchent que sur le nom, sans filtre `status` ou
`managerId` ni tri. `PATCH` accepte les champs de `POST`, `null` vidant un champ
facultatif. `filter[contractType]` porte sur le contrat `active` de l'employé et
n'est appliqué que pour `owner`, `hr_admin` et `manager`.

Passage à `terminated` (07 §1.5) : `endDate` posée, contrat actif clôturé, rôles
retirés, subordonnés rattachés au manager de l'employé, responsabilité de
département retirée. Mettre
fin à sa propre fiche, ou à celle d'un `owner` sans être `owner` ⇒ `403` ; dernier
`owner` actif ⇒ `409`, `rule = "lastOwner"`. La suppression logique rattache de même
les subordonnés et retire la responsabilité de département. `POST /:id/restore`
contrôle le quota et l'unicité de l'e-mail.

---

## 5. Départements, contrats, compétences

| Méthode | Chemin | Perm. |
|---|---|---|
| GET/POST | `/org/departments` | lecture : tous · écriture : O H |
| GET/PATCH/DELETE | `/org/departments/:id` | écriture : O H |
| GET | `/org/departments/:id/employees` | O H · M(team) |
| GET | `/org/contracts` | O H · M(team, sans salaire) · E(self) |
| POST | `/org/contracts` | O H |
| GET/PATCH/DELETE | `/org/contracts/:id` | O H |
| POST | `/org/contracts/:id/terminate` | O H |
| GET | `/org/contracts/:id/document` | O H · self |
| POST | `/org/contracts/:id/document` | O H (multipart `file`, PDF/PNG/JPEG/WebP ≤ 10 Mo, remplace le précédent, audité `contract.document_uploaded`) |
| GET/POST | `/org/skills` | lecture : O H M · écriture : O H |
| PATCH/DELETE | `/org/skills/:id` | O H |
| GET | `/org/employees/:id/skills` | O H · M(team) · self |
| PUT | `/org/employees/:id/skills` | O H |

Suppression de département : `409 E_CONFLICT` si des employés y sont rattachés,
sauf `?reassignTo=<departmentId>`. Ses sous-départements remontent d'un niveau.

Corps de `POST` et `PATCH /org/departments` : `name` (2 à 120 caractères, unique
sans tenir compte de la casse), `description`, `managerId`, `parentDepartmentId`.
Élément renvoyé : ces champs + `id`, `createdAt`, `updatedAt`. Référence hors
organisation ⇒ `422` ; boucle de parents ⇒ `422 E_HIERARCHY_CYCLE`.

### Contrats

Corps de `POST /org/contracts` : `employeeId`, `type` (`cdi`, `cdd`, `stage`,
`freelance`, `apprenticeship`, `daily`), `startDate`, et en option `status`
(`draft` par défaut, `active`, `suspended`), `endDate`, `trialPeriodEnd`, `salary`
(0 à 1 000 000 000), `currency` (`GNF` uniquement), `weeklyHours` (0 à 168), `notes`
(5 000 caractères). `PATCH` accepte ces champs sauf `employeeId`, `null` vidant un
champ facultatif. `POST /:id/terminate` accepte `endDate`, par défaut la date du
jour dans le fuseau de l'organisation.

`GET /org/contracts` : `page`, `perPage`, `filter[employeeId]`, `filter[status]`,
`filter[type]`, tri par date de début décroissante.

Élément renvoyé : `id`, `employeeId`, `type`, `status`, `startDate`, `endDate`,
`trialPeriodEnd`, `weeklyHours`, `hasDocument`, `createdAt`, `updatedAt`, plus
`salary`, `currency` et `notes` pour `owner`, `hr_admin` et l'employé lui-même.
Chaque réponse de lecture contenant un salaire écrit `salary.viewed`.

Règles : fin avant le début, ou essai hors du contrat ⇒ `422` ; employé hors
organisation ⇒ `422`. `409 E_CONFLICT` avec `rule` : `activeExists` (un seul contrat
actif par employé), `employeeTerminated` (activation pour un employé parti),
`terminated` (contrat clôturé non modifiable), `notTerminable` (seuls `active` et
`suspended` se clôturent). Les contrats d'une fiche supprimée sont masqués.

`GET /:id/document` renvoie `{ url, expiresIn }` (lien signé de 15 min, journal
`sensitive_document.viewed`), ou `404` sans document. Aucun endpoint de dépôt n'est
spécifié à ce jour : seuls les documents repris de l'existant sont accessibles.

### Compétences

Corps de `POST` et `PATCH /org/skills` : `name` (2 à 120 caractères, unique sans
tenir compte de la casse), `category` (80 caractères). `GET` est paginé. La
suppression retire aussi les évaluations de cette compétence.

`PUT /org/employees/:id/skills` remplace tout l'ensemble :
`{ skills: [{ skillId, level, assessedAt? }] }`, `level` de 1 à 5, 200 éléments au
plus, sans doublon, liste vide acceptée. Compétence inconnue ⇒ `422`. `GET` et `PUT`
renvoient `{ data: [{ skillId, name, category, level, assessedAt }] }`.

---

## 6. Pointage `/org/timeclock`

| Méthode | Chemin | Perm. |
|---|---|---|
| GET | `/org/timeclock/zones` | O H M S |
| POST | `/org/timeclock/zones` | O H |
| PATCH/DELETE | `/org/timeclock/zones/:id` | O H |
| GET | `/org/timeclock/schedules` | O H M S |
| POST | `/org/timeclock/schedules` | O H |
| PATCH/DELETE | `/org/timeclock/schedules/:id` | O H |
| POST | `/org/timeclock/scan` ⚡ | O H M S |
| POST | `/org/timeclock/punch` ⚡ | tous (pour soi) |
| GET | `/org/timeclock/logs` | O H · M(team) · E(self) · S |
| POST | `/org/timeclock/logs/export` | O H (asynchrone, 08 §9) |
| PATCH | `/org/timeclock/logs/:id` | O H (correction, auditée) |
| DELETE | `/org/timeclock/logs/:id` | O H (auditée) |
| GET | `/org/timeclock/attendance` | O H · M(team) · E(self) | agrégats `attendance_days` |
| GET | `/org/timeclock/today` | O H M S | présents / absents du jour |
| GET | `/org/employees/:id/badge` | O H S(masqué) |
| POST | `/org/employees/:id/badge` ⚡ | O H S | assignation |
| DELETE | `/org/employees/:id/badge` | O H S | révocation |
| GET | `/org/timeclock/badge-events` | O H | journal des badges |
| POST | `/org/timeclock/device-tokens` | O H | token kiosque |
| GET/DELETE | `/org/timeclock/device-tokens/:id` | O H |

### `POST /org/timeclock/scan`
```ts
vine.object({
  badgeUid: vine.string().trim().minLength(4).maxLength(64),
  type: vine.enum(['in','out']).optional(),        // sinon déduit (07 §2.4)
  punchedAt: vine.date({ formats: ['iso8601'] }).optional(),
  latitude: vine.number().min(-90).max(90).optional(),
  longitude: vine.number().min(-180).max(180).optional(),
  accuracyMeters: vine.number().min(0).max(10000).optional(),
  deviceId: vine.string().trim().maxLength(120).optional(),
  clientPunchId: vine.string().uuid().optional(),   // idempotence hors-ligne
})
```
`201` :
```json
{ "data": { "id":"0192…","employee":{"id":"…","fullName":"Mariama Diallo",
  "photoUrl":null,"jobTitle":"Comptable"},
  "type":"in","punchedAt":"2026-09-10T08:02:11Z",
  "workZone":{"id":"…","name":"Siège Kaloum"},
  "isWithinZone":true,"distanceMeters":37.2,"anomaly":null }}
```
Erreurs : `404 E_BADGE_UNKNOWN`, `409 E_BADGE_INACTIVE`,
`409 E_DUPLICATE_PUNCH` (fenêtre anti-doublon), `422 E_OUT_OF_ZONE`
(si `requireZone` et hors zone), `429`.

### `POST /org/timeclock/punch`
Pointage manuel/GPS pour soi-même. Mêmes champs, sans `badgeUid`.
Refusé si `settings.timeclock.allowManualPunch = false`
(`403 E_MANUAL_PUNCH_DISABLED`).

### Décisions du 2026-11-19 (lot 1)
- **Réponse du scan** : ajoute `source` (`nfc`, `kiosk`, `manual`, `mobile_gps`).
  Un `clientPunchId` déjà connu renvoie le pointage existant en `200`.
- **Zones** : `POST /zones` `{ name (2..120, unique sans casse), shape?:
  'circle'|'polygon', latitude, longitude, radiusMeters (20..5000) | polygon
  ([lon, lat][], fermé, 4..100 points), isActive?, timezone? }` ⇒ `201` ; réponse
  `{ id, name, shape, latitude, longitude, radiusMeters, polygon, isActive,
  timezone, createdAt, updatedAt }`. `DELETE` = suppression logique.
- **Badges** : `GET /employees/:id/badge` ⇒ `{ data: { id, employeeId, uid:
  '••••6B3E', isActive, assignedAt, revokedAt } | null }`. `POST` `{ badgeUid }` ⇒
  `201` ; un badge existant de l'employé est révoqué (`reassigned`) ; UID actif
  ailleurs, même dans une autre organisation ⇒ `409 E_CONFLICT` règle
  `badgeTaken` ; employé `terminated` ⇒ `409`. `DELETE` ⇒ `204`.
  `GET /badge-events?employeeId&page&perPage` ⇒ `{ id, employeeId, badgeId, uid,
  event, reason, actorUserId, createdAt }`.
- **Scan** : UID mal formé, inconnu ou d'une autre organisation ⇒ `404
  E_BADGE_UNKNOWN` (journalisé `scan_rejected`) ; employé `suspended` ⇒ `409
  E_BADGE_INACTIVE`. Rate limit : 30/min par jeton kiosque, sinon par `deviceId`,
  sinon par utilisateur ; 300/min par organisation (`429`).
- **Zone sans coordonnées** : un lecteur de badge est fixe, son scan sans GPS est
  accepté sans contrôle de zone ; un pointage pour soi sans coordonnées, avec
  `requireZone`, ⇒ `422 E_OUT_OF_ZONE`. Une seule anomalie est gardée, dans
  l'ordre `clock_drift`, `low_accuracy`, `out_of_zone`.
- **Historique** : `GET /logs?page&perPage (≤ 200)&filter[employeeId|from|to|source|anomaly]`
  ⇒ `{ id, employeeId, type, punchedAt, recordedAt, source, workZoneId, latitude,
  longitude, accuracyMeters, distanceMeters, isWithinZone, anomaly, deviceId,
  notes, updatedAt }`, périmètre O H S tous, M équipe + soi, E soi. `PATCH`
  `{ type?, punchedAt?, workZoneId?, notes? }` (au moins un champ), audité
  `time_log.corrected` avec les anciennes valeurs ; `DELETE` audité.
- **Tokens kiosque** : `POST /device-tokens` `{ name (2..80), expiresInDays? (1..365,
  défaut 90) }` ⇒ `201 { id, name, expiresAt, revokedAt, lastUsedAt, createdAt,
  token }` ; `token` (`kd_…`) n'est montré qu'à la création. `GET` liste et détail
  sans `token`, `DELETE` révoque. Le kiosque appelle `POST /scan` et `/sync` avec
  `Authorization: Bearer kd_…`, sans `X-Organization-Id` (l'organisation vient du
  jeton) ; toute autre route le refuse en `401`. Source enregistrée : `kiosk`.

### Décisions du 2026-11-20 (lot 2)
- **Agrégats** : `GET /attendance?page&perPage (≤ 200)&filter[employeeId|from|to|anomaly]`,
  `from`/`to` en dates locales `YYYY-MM-DD` (défaut : les 30 derniers jours, au plus
  93 jours, sinon `422` règle `range`), `anomaly` ∈ `missing_out`, `out_of_zone`,
  `duplicate`, `late`. Réponse `{ data: [{ employeeId, day, firstIn, lastOut, workedMinutes,
  punchCount, isComplete, lateMinutes, anomaly }], meta }`, tri `day desc`. Périmètre de `/logs`
  (O H S tous, M équipe + soi, E soi).
- **Jour** : date locale dans le fuseau de l'organisation, sauf service de nuit (horaires,
  ci-dessous). Paires lues dans l'ordre : un `in`
  alors qu'une paire est ouverte, ou un `out` sans `in`, ⇒ `duplicate` (le premier `in`
  est gardé). Une anomalie : `missing_out` (paire ouverte sur un jour clos), puis
  `duplicate`, puis `late`, puis `out_of_zone`.

### Horaires de travail (décisions du 2026-11-26)
- **Routes** : `GET /schedules` (O H M S) ⇒ `{ data: [...] }`, modèles d'organisation
  d'abord (celui par défaut en tête), puis horaires propres aux employés, par nom.
  `POST /schedules` `{ name (2..120, unique sans casse, sinon 409 règle scheduleName),
  isDefault?, weeklyPattern, employeeId? }` ⇒ `201` ; `PATCH /schedules/:id` (mêmes
  champs, facultatifs) ; `DELETE /schedules/:id` ⇒ `204` (suppression physique).
  Réponse `{ id, name, isDefault, employeeId, weeklyPattern, createdAt, updatedAt }`,
  `weeklyPattern` avec les 7 jours (`[]` pour un jour non travaillé). Audit
  `work_schedule.created|updated|deleted`. Module `timeclock`.
- **`weeklyPattern`** : `{ mon|tue|wed|thu|fri|sat|sun: [{ start: "HH:MM", end: "HH:MM" }] }`,
  4 plages par jour au plus, jour absent = non travaillé. Les plages d'un jour se suivent
  sans se chevaucher ; une plage dont la fin n'est pas après le début finit le lendemain
  (service de nuit) : seule la dernière du jour, et avant la première plage du jour
  suivant (sinon `422` règle `scheduleOverlap`, champ `weeklyPattern`).
- **Affectation** : `employeeId` = horaire propre à cet employé (un seul par employé, `409`
  règle `scheduleEmployee` ; employé d'une autre organisation ou inconnu `422`). Un
  employé suit son horaire propre, sinon l'horaire par défaut, sinon aucun (comportement
  sans horaire : jour civil, pas de retard). Un seul `isDefault` : en marquer un autre
  le retire à l'ancien ; un horaire propre ne peut pas être par défaut (`422` règle
  `scheduleDefaultEmployee`) ; l'horaire par défaut ne se supprime pas (`409` règle
  `scheduleDefault`). Un changement s'applique aux journées recalculées ensuite, les
  agrégats passés ne sont pas recalculés.
- **Service de nuit** : la journée qui finit par une plage de nuit s'étend jusqu'à la fin
  de la plage + 4 h le lendemain, ou 1 h avant la première plage du lendemain si elle
  vient plus tôt (jamais avant la fin de la plage). Les pointages de cette fenêtre
  comptent pour le jour du début. La clôture de 23:59 ne ferme une journée que si sa
  fenêtre finit au plus tard à minuit : une nuit reste ouverte jusqu'à la clôture suivante.
- **Retard** : `lateMinutes` = minutes entre le début de la première plage du jour et le
  premier `in` (0 si à l'heure) ; `null` un jour sans plage, un jour férié ou sans `in`.
  `late` si `lateMinutes > settings.timeclock.lateToleranceMinutes` (0..120, défaut 10).
- **Aujourd'hui** : `GET /today` ⇒ `{ data: { date, isHoliday, counts: { total, present,
  absent, onLeave }, present: [{ employeeId, fullName, departmentId, firstIn, lastOut,
  isComplete, anomaly }], absent: [{ employeeId, fullName, departmentId }], onLeave: […] } }`
  sur les employés `active` et `on_leave`. Présent = au moins un pointage du jour
  (agrégat, jusqu'à 60 s de retard) ; en congé = congé `approved` couvrant le jour ou
  statut `on_leave` ; absent = le reste. Le manager ne voit que son équipe et lui-même ;
  E ⇒ `403`.
- **Export** (asynchrone, 08 §9) : `POST /logs/export` `{ format: 'csv'|'xlsx', filter: {
  from, to, employeeId?, source?, anomaly? } }`, O H seulement. `from` et `to` obligatoires
  (instants ISO), au plus 366 jours locaux (`422` règle `range`) ; plus de 1 000 000
  pointages ⇒ `422` règle `tooManyRows` (vérifié à la demande) ; 5 exports/h/utilisateur.
  Réponse `202 { data: { jobId } }`, audit `time_log.exported`. Le job `time-logs.export`
  écrit le fichier page par page sur disque, le dépose dans `private-docs` (entrée `files`
  `owner_type = 'time_log_export'`) et envoie au demandeur un lien valable 24 h. Colonnes
  Matricule, Nom, Prénom, Type, Date, Heure (fuseau de l'organisation), Source, Zone, Dans
  la zone, Anomalie, Notes, en-têtes dans la langue du demandeur.

### Synchronisation hors-ligne (mobile)
`POST /org/timeclock/sync` accepte un tableau de 1 à 200 pointages avec
`clientPunchId` obligatoire, et renvoie par élément
`{ clientPunchId, status: 'created'|'duplicate'|'rejected', reason?, id? }`.
Corps : `{ punches: [ … ] }`. Un élément avec `badgeUid` est un scan (droits de
scan ou jeton kiosque), sinon un pointage pour soi (session membre). Chaque
élément a sa propre transaction ; `reason` est le code d'erreur (`E_…`).

---

## 7. Congés `/org/leaves`

| Méthode | Chemin | Perm. |
|---|---|---|
| GET | `/org/leaves` | O H · M(team) · E(self) |
| POST | `/org/leaves` ⚡ | tous (pour soi) |
| GET | `/org/leaves/:id` | O H · M(team) · self |
| PATCH | `/org/leaves/:id` | auteur si `pending` |
| POST | `/org/leaves/:id/approve` | O H · M(team, hors soi) |
| POST | `/org/leaves/:id/reject` | idem — `decisionComment` obligatoire |
| POST | `/org/leaves/:id/cancel` | auteur (`pending`) · O H (toujours) |
| GET | `/org/leaves/calendar` | O H · M(team) · E(self) |
| GET | `/org/leaves/balances` | O H · M(team) · E(self) |
| POST | `/org/leaves/balances/adjust` | O H (audité, écrit au ledger) |
| GET | `/org/leaves/:id/attachment` | O H · M(team) · self |
| POST | `/org/leaves/:id/attachment` | auteur si `pending` · O H (toujours) |
| GET/POST | `/org/holidays` | lecture : tous · écriture : O H |
| PATCH/DELETE | `/org/holidays/:id` | O H |
| POST | `/org/holidays/import` | O H | jours fériés guinéens de l'année |

### `POST /org/leaves`
```ts
vine.object({
  employeeId: vine.string().uuid().existsInOrg('employees').optional(), // O/H seulement
  type: vine.enum(['annual','sick','maternity','paternity','unpaid','special']),
  startDate: vine.date(), endDate: vine.date().afterOrEqual('startDate'),
  halfDayStart: vine.boolean().optional(), halfDayEnd: vine.boolean().optional(),
  reason: vine.string().trim().maxLength(1000).optional(),
})
```
Réponse `201` avec `requestedDays` calculé serveur, `balanceAfter` prévisionnel.
Erreurs : `409 E_LEAVE_OVERLAP`, `422 E_INSUFFICIENT_BALANCE`
(si le solde négatif est interdit ou dépasse `maxNegativeDays`),
`403 E_FORBIDDEN`.

`POST /:id/reject` : `{ decisionComment: string (5..1000) }` — obligatoire.

Les dates `startDate`/`endDate` d'une même demande appartiennent à la même année
(sinon `422 E_VALIDATION`, règle `sameYear` : faire deux demandes). `endDate` avant
`startDate` ⇒ `422` (règle `afterOrEqual`).

#### Réponse d'une demande
Liste (`GET /org/leaves`, offset, filtres `filter[employeeId|status|type|from|to]`,
`from`/`to` = congés chevauchant la période) :
```json
{ "id": "…", "employeeId": "…", "type": "annual", "status": "pending",
  "startDate": "2027-03-01", "endDate": "2027-03-05", "halfDayStart": false,
  "halfDayEnd": true, "requestedDays": 4.5, "reason": null, "decisionComment": null,
  "decidedBy": null, "decidedAt": null, "hasAttachment": false,
  "createdAt": "…", "updatedAt": "…" }
```
Détail, création, `PATCH`, `approve`, `reject`, `cancel` ajoutent `approverId`
(manager direct de l'employé, `null` ⇒ RH/owner, 07 §3.7) et `balanceAfter` (solde
prévisionnel du type pour l'année, `null` pour les types sans solde).

`PATCH /:id` (auteur = l'employé ou le créateur de la demande, `pending` uniquement,
sinon `409 E_CONFLICT` règle `notPending`) : mêmes champs que la création, sans
`employeeId`, tous optionnels ; jours et solde recalculés.

`POST /:id/cancel` : `pending` ⇒ auteur, manager (équipe), O, H ; `approved` ⇒ O et H
uniquement, tant que `startDate` est postérieure à aujourd'hui (fuseau de
l'organisation), sinon `409 E_CONFLICT` règle `locked`. Autres statuts ⇒ `409`
règle `notCancellable`.

#### Soldes
`GET /org/leaves/balances?employeeId=&year=` (année courante par défaut) ⇒
`{ data: [{ employeeId, year, leaveType, entitledDays, carriedOverDays, takenDays,
pendingDays, balance }] }`. Périmètre : O H tous, M équipe + soi, sinon soi ;
`employeeId` hors périmètre ⇒ `403`.

`POST /org/leaves/balances/adjust` (O H) :
```ts
vine.object({
  employeeId: vine.string().uuid(),
  leaveType: vine.enum([...types]),
  year: vine.number().optional(),                 // année courante par défaut
  deltaDays: vine.number().min(-365).max(365),    // ≠ 0, 2 décimales
  reason: vine.string().trim().minLength(5).maxLength(500),
})
```
Modifie `entitled_days`, écrit au ledger (motif = `reason`), audité
`leave_balance.adjusted`. Réponse : le solde au format ci-dessus.

#### Calendrier
`GET /org/leaves/calendar?from=&to=` (≤ 92 jours ; sans borne, le mois courant ;
une seule borne s'étend jusqu'à la fin ou au début de son mois) ⇒
```json
{ "data": { "from": "2027-03-01", "to": "2027-03-31",
  "leaves": [{ "id": "…", "employeeId": "…", "employeeName": "Aïssatou Bah",
    "type": "annual", "status": "approved", "startDate": "…", "endDate": "…",
    "halfDayStart": false, "halfDayEnd": false }],
  "holidays": [{ "id": "…", "name": "…", "date": "…", "isMovable": false,
    "isRecurring": false }] } }
```
Demandes `pending` et `approved` chevauchant la période ; périmètre O H tous,
M équipe + soi, sinon soi. Plage invalide ⇒ `422` (règles `afterOrEqual`, `maxRange`).

#### Pièce jointe
`POST /org/leaves/:id/attachment` (multipart, champ `file`) : ≤ 10 Mo, PDF, PNG,
JPEG ou WebP vérifiés par signature (05 §3), bucket privé ; remplace le fichier
précédent, audité `leave.attachment_uploaded`. Réponse : la demande (`hasAttachment`).
`GET /org/leaves/:id/attachment` ⇒ `{ url, expiresIn: 900 }`, lien signé audité
`sensitive_document.viewed` ; `404` sans fichier.

#### Solde d'un employé
`GET /org/employees/:id/leave-balance?year=` (soi, manager du sous-arbre, O H ;
module `leaves`) ⇒ `{ data: [ lignes au format de /leaves/balances ] }`.

#### Jours fériés
`GET /org/holidays?year=` (année courante par défaut) ⇒
`{ data: [{ id, name, date, isMovable, isRecurring }] }`.
`POST` `{ name (2..120), date, isMovable?, isRecurring? }` ⇒ `201` ; date déjà prise
⇒ `409 E_CONFLICT` (champ `date`). `PATCH` mêmes champs optionnels, `DELETE` ⇒ `204`.
`POST /org/holidays/import` `{ year }` : ajoute les 8 jours fixes de 07 §9 absents,
conserve les dates déjà saisies, renvoie les jours fériés de l'année.

---

## 8. Recrutement `/org/recruitment`

| Méthode | Chemin | Perm. |
|---|---|---|
| GET/POST | `/org/recruitment/jobs` | O H R (M lecture sur son département) |
| GET/PATCH/DELETE | `/org/recruitment/jobs/:id` | O H R |
| POST | `/org/recruitment/jobs/:id/publish` | O H R |
| POST | `/org/recruitment/jobs/:id/close` | O H R |
| POST | `/org/recruitment/jobs/:id/duplicate` | O H R |
| GET | `/org/recruitment/jobs/:id/qr` | O H R | QR de la page publique |
| POST | `/org/recruitment/jobs/:id/generate` | O H R | Génération IA de l'annonce (livrée le 2026-11-24, voir « IA ») |
| GET | `/org/recruitment/candidates` | O H R |
| POST | `/org/recruitment/candidates` | O H R |
| GET/PATCH/DELETE | `/org/recruitment/candidates/:id` | O H R |
| POST | `/org/recruitment/candidates/:id/stage` | O H R |
### Offres (précisions du 2026-11-23)
- `POST /jobs` : `{ title, contractType, departmentId?, location?, description?,
  requirements?, deadline?, requiredDocuments? }`, créée en `draft`. Le `slug` est
  généré par le serveur depuis le titre (suffixe `-2`, `-3`… en cas de collision,
  offres supprimées comprises) et ne suit jamais un changement de titre.
- Listes : `page`, `perPage`, `q` (titre), `filter[status|departmentId]`. Un manager
  ne lit que les offres de son département (04 §5).
- `publish` : `draft | closed → published`, exige une description et une
  `deadline` future ou absente (`422`) ; sinon `409`. `close` : `published → closed`.
  Une offre publiée ne peut pas perdre sa description.
- `duplicate` : copie en `draft`, nouveau slug, sans `deadline` ni vues (`201`).
  `DELETE` est logique.
- `GET /jobs/:id/qr` : PNG 512 px de `WEB_APP_URL/careers/:orgSlug/:jobSlug`, page
  publique de l'offre côté web (la page de l'organisation est `/careers/:orgSlug`).

### Candidats (décisions du 2026-11-23)
- `GET /candidates` : `page`, `perPage`, `q` (nom, e-mail), `filter[jobId|stage]`.
  Réponse candidat : champs IA, `jobTitle`, `documents` = clés des pièces stockées
  (`cv`, `cover_letter`, clés de l'offre), jamais de chemin.
- `POST /candidates` (multipart, O H R) : `jobId`, `fullName`, `email?`, `phone?`,
  `source?` (`referral`, `import`, `social` ; défaut `referral`), `cv?`,
  `coverLetter?`, `documents[<clé>]?` ; pièces facultatives, anti-doublon identique
  au public, aucun e-mail envoyé.
- `PATCH /candidates/:id` : `fullName`, `email`, `phone`, `source`.
- `DELETE /candidates/:id` : suppression **définitive** (fiche, notes, historique,
  fichiers effacés après commit) ; `audit_logs` garde l'offre et l'étape, aucune
  donnée personnelle.
- `POST /candidates/:id/stage` : `{ stage, reason? }`. Avancer : O H R ; reculer ou
  sortir de `rejected` : O H seulement (`403`) ; `hired` refusé (`422`, passer par
  `/hire`) ; même étape ou candidat embauché : `409`. `reason` remplit
  `rejected_reason` lors d'un refus.
- `POST /candidates/:id/hire` ⚡ : `{ firstName?, lastName?, hireDate? }` (par défaut :
  premier mot du nom, le reste, aujourd'hui). Crée l'employé dans la même
  transaction (quota `403 E_QUOTA_EXCEEDED`, e-mail déjà utilisé `409`), passe le
  candidat `hired`. L'offre reste publiée : aucun nombre de postes n'existe, le
  recruteur la ferme lui-même. Un candidat refusé ou déjà embauché : `409`.
  Réponse : `{ data: { candidate, employeeId } }`.
- `GET /candidates/:id/documents/:key/url` : URL signée 15 min, journal
  `sensitive_document.viewed`.
- Notes : `{ body }` ; suppression logique par O H ou le recruteur auteur, événement
  `note_deleted`. `GET /candidates/:id/events` : historique, du plus récent au plus ancien.

### Webhook n8n et scoring (précisions du 2026-11-23)
- `GET /org/recruitment/webhooks` (O H) : `{ testWebhookUrl, prodWebhookUrl,
  activeEnv, hasSecret, updatedAt }`. Le secret n'est jamais relu.
- `PUT /org/recruitment/webhooks` : `{ testWebhookUrl?, prodWebhookUrl?, activeEnv?,
  rotateSecret? }`. URLs contrôlées par 05 §10 (`422`) ; activer un environnement
  exige son URL. Le secret HMAC (64 caractères hexadécimaux) est généré par le
  serveur, chiffré au repos, et **renvoyé une seule fois** (`secret`) dans la
  réponse qui le crée ou le renouvelle.
- `POST /org/recruitment/webhooks/ping` : `{ env? }` (défaut : l'environnement
  actif) → `{ env, ok, status, latencyMs, error }` ; aucun webhook ⇒ `422`.
- Appel sortant (candidature publique uniquement, environnement actif) : POST JSON
  signé `X-Konkoure-Signature` (HMAC-SHA256 hexadécimal du corps) et
  `X-Konkoure-Timestamp` (secondes Unix) :
  `{ event: 'candidate.applied', environment, organization { id, name },
  job { id, title, description, requirements, location, contractType },
  candidate { id, fullName, documents: [{ key, url }] }, callback { url } }`,
  URLs signées 1 h, ni e-mail ni téléphone. Une réponse 2xx portant un résultat
  conforme est appliquée tout de suite ; sinon n8n rappelle `callback.url`.
  Échec transport ou non-2xx : 3 tentatives (30 s, 5 min, 30 min), puis abandon
  sans effet. Les crédits IA ne sont pas décomptés avant le lot facturation.
- Résultat appliqué : colonnes `ai_*`, `ai_scored_at`, événement `scored`,
  notification `candidate.scored` aux recruteurs ; jamais de changement d'étape.

_Aucun endpoint de relance du scoring._ Le scoring IA est déclenché uniquement à
la soumission de la candidature (07 §4.4). La lecture d'un candidat renvoie
`aiScore`, `aiJustification`, `aiStrengths`, `aiWeaknesses`, `aiCandidateName`,
`aiIsValidCv`, `aiFraudAlert`, `aiScoredAt`, plus une URL signée du CV
(15 min) obtenue via l'endpoint `documents/:key/url`.
| POST | `/org/recruitment/candidates/:id/hire` | O H R | Crée l'employé |
| GET | `/org/recruitment/candidates/:id/documents/:key/url` | O H R | URL signée 15 min |
| GET/POST | `/org/recruitment/candidates/:id/notes` | O H R |
| DELETE | `/org/recruitment/candidates/:id/notes/:noteId` | O H · auteur R |
| GET | `/org/recruitment/candidates/:id/events` | O H R |
| GET/PUT | `/org/recruitment/webhooks` | O H |
| POST | `/org/recruitment/webhooks/ping` | O H |
| GET | `/org/integrations/social/accounts` | O H · R (vue réduite) |
| POST | `/org/integrations/social/accounts` | O H |
| DELETE | `/org/integrations/social/accounts/:id` | O H |
| GET/POST | `/org/recruitment/jobs/:id/social-posts` | O H R |
| POST | `/org/recruitment/jobs/:id/social-posts/suggest` | O H R |
| GET | `/api/v1/oauth/social/:provider/callback` | public (retour OAuth) |

Filtres candidats : `filter[jobId]`, `filter[stage]`, `filter[minScore]`, `q`.
Le changement d'étape écrit un `candidate_events` et notifie les recruteurs.

### Publication sur les réseaux sociaux (décisions du 2026-11-26)
Réseaux branchés : **page entreprise LinkedIn** (API Community Management, scopes
`r_organization_admin w_organization_social`) et **pages Facebook** (Graph API v21,
`pages_manage_posts pages_read_engagement pages_show_list`). `twitter` reste dans
l'enum sans client (`422` à la connexion). Sans identifiants du réseau
(`LINKEDIN_CLIENT_ID`/`_SECRET`, `FACEBOOK_APP_ID`/`_SECRET`), la connexion et la
publication répondent `503 E_DEPENDENCY_UNAVAILABLE`. Les routes de comptes exigent
le module `integrations` ; la publication, `recruitment` et `integrations`.
- `GET /org/integrations/social/accounts` (O H) : `{ data: [{ id, provider,
  accountId, accountName, status, scopes, tokenExpiresAt, connectedBy, createdAt,
  updatedAt }] }`. Les jetons ne sont jamais renvoyés. Un `recruiter` (décision du
  2026-11-26, pour choisir ses `accountIds`) reçoit la vue réduite `{ id, provider,
  accountName, status }` ; il ne connecte ni ne supprime de compte.
- `POST /org/integrations/social/accounts` (O H) : `{ provider: 'linkedin' |
  'facebook' }` → `{ data: { authorizationUrl } }`. Le client y envoie le navigateur.
  `state` aléatoire à usage unique, valable 10 min, lié à l'organisation et au membre.
- `GET /api/v1/oauth/social/:provider/callback?code&state[&error]` (public, appelé
  par le réseau) : redirige toujours vers
  `<WEB_APP_URL>/app/settings/integrations?connected=<provider>&count=<n>` ou
  `?error=<code>`, avec `code` ∈ `invalid_state` (absent, rejoué, expiré ou autre
  réseau), `denied` (refus du membre), `forbidden` (le membre n'est plus O H),
  `no_pages` (aucune page administrée), `provider_error`, `unavailable`. Chaque page
  accordée devient un compte (une ligne par page LinkedIn ou Facebook) ; une
  reconnexion met à jour la ligne existante. Journal `social_account.connected`.
  URL de rappel à déclarer chez chaque réseau : `<APP_URL>/api/v1/oauth/social/<provider>/callback`.
- `DELETE /org/integrations/social/accounts/:id` (O H) → `204`, journal
  `social_account.disconnected` ; les publications passées gardent leur réseau
  (`socialAccountId` devient `null`).
- `POST /org/recruitment/jobs/:id/social-posts` (O H R) : `{ accountIds: uuid[]
  (1 à 10), content (1 à 3000) }` → `202 { data: [post] }`, une publication `pending`
  par compte, envoyée par la file `outbound` avec le lien de l'offre sur la page
  carrières. `post` : `{ id, jobId, socialAccountId, accountName (`null` si le compte est
  supprimé), provider, content, status,
  externalPostId, externalUrl, errorMessage, publishedAt, createdAt }`. Offre non
  publiée ⇒ `409` (`rule = "notPublished"`) ; compte inconnu, d'une autre
  organisation ou non `active` ⇒ `422` (`field = "accountIds"`). Un refus du réseau
  passe la publication en `failed` avec son message ; un jeton expiré passe aussi
  le compte en `expired` et notifie les O H (`social_account.expired`).
- `GET /org/recruitment/jobs/:id/social-posts` (O H R, ajouté le 2026-11-26) :
  `{ data: [post] }`, les publications de l'offre du plus récent au plus ancien
  (100 au plus), pour suivre `pending → published | failed` (`externalUrl`,
  `publishedAt`, `errorMessage`). Offre d'une autre organisation ⇒ `404`.
- `POST /org/recruitment/jobs/:id/social-posts/suggest` (O H R) : `{ provider,
  language? }` → `{ data: { content } }`, texte et hashtags proposés par l'IA
  (`social.post`, 1 crédit), sans URL ni salaire, non enregistré.

---

## 9. Performance `/org/performance`

| Méthode | Chemin | Perm. |
|---|---|---|
| GET/POST | `/org/performance/cycles` | lecture : tous · écriture : O H |
| PATCH | `/org/performance/cycles/:id` | O H |
| POST | `/org/performance/cycles/:id/open` \| `/close` | O H |
| GET/POST | `/org/performance/plans` | écriture : O H |
| PATCH/DELETE | `/org/performance/plans/:id` | O H (ajouté le 2026-11-20, écrans de réglages) |
| GET/POST | `/org/performance/goals` | création : tous (soi) · O H M (autrui) |
| GET/PATCH/DELETE | `/org/performance/goals/:id` | O H · M(team) · self |
| PATCH | `/org/performance/goals/:id/progress` | self · M(team) |
| GET/POST | `/org/performance/goals/:id/activities` | self · M(team) · O H |
| PATCH/DELETE | `/org/performance/goals/:id/activities/:activityId` | self · M(team) · O H (ajouté le 2026-11-23, kanban des activités) |
| GET | `/org/performance/activities` | tous, limité aux objectifs visibles (ajouté le 2026-11-23) |
| GET/POST | `/org/performance/okrs` | self · O H M |
| GET/PATCH/DELETE | `/org/performance/okrs/:id` | self (si `draft`/`needs_revision`) · O H |
| PUT | `/org/performance/okrs/:id/key-results` | self · O H M |
| PATCH | `/org/performance/okrs/:id/key-results/:krId` | self · M(team) |
| POST | `/org/performance/okrs/:id/submit` | self |
| POST | `/org/performance/okrs/:id/validate` | O H · M(team) |
| POST | `/org/performance/okrs/:id/request-revision` | O H · M(team) |
| GET/POST | `/org/performance/okrs/:id/checkins` | self · M(team) · O H |
| POST | `/org/performance/okrs/suggest` | self | Suggestion IA de résultats clés |
| GET | `/org/performance/reviews` | O H · M(team) · E(self) |
| POST | `/org/performance/reviews` | O H (ouverture par cycle/plan) |
| GET | `/org/performance/reviews/:id` | O H · M(team) · self |
| PATCH | `/org/performance/reviews/:id/self` | self (statuts `not_started`, `in_progress`, `sent_back`) |
| POST | `/org/performance/reviews/:id/submit-self` | self |
| PATCH | `/org/performance/reviews/:id/manager` | M(team) · O H |
| POST | `/org/performance/reviews/:id/validate` | M(team) · O H |
| POST | `/org/performance/reviews/:id/send-back` | M(team) · O H | commentaire obligatoire |
| POST | `/org/performance/reviews/:id/sign` | self |
| POST | `/org/performance/reviews/:id/ai-summary` | O H · M(team) |
| PATCH | `/org/performance/reviews/:id/talent` | O H (module `talents`, ajouté le 2026-11-24) |
| GET/POST | `/org/performance/feedback` | tous |
| DELETE | `/org/performance/feedback/:id` | auteur · O H |
| GET/POST | `/org/performance/achievements` | self · M(team) · O H |
| DELETE | `/org/performance/achievements/:id` | auteur · O H (ajouté le 2026-11-20) |
| GET | `/org/talents/9box` | O H · M(team) |
| GET/PUT | `/org/talents/skills-matrix` | O H · M(team lecture) |
| GET/POST/PATCH/DELETE | `/org/talents/succession` | O H |

### Cycles, plans et objectifs (précisions du 2026-11-23)
- Listes paginées (`page`, `perPage`, `filter[status]`) ; objectifs filtrables par
  `employeeId`, `planId`, `status`, `category`, et limités à soi, à l'équipe
  (manager) ou à tous (O H).
- `POST /cycles` : `{ name, frequency, periodStart, periodEnd, selfEvalOpensAt?,
  selfEvalClosesAt? }`, créé en `draft`. `PATCH` refusé une fois `closed` (`409`).
  `open` : `draft → open` ; `close` : `open → closed` ; sinon `409 E_CONFLICT`.
- `POST /plans` : `{ name, periodStart, periodEnd, status? }`. Passer un plan à
  `active` vérifie la pondération de chaque employé (`422 E_WEIGHT_OVERFLOW`).
  `DELETE` est logique ; les objectifs gardent leur `planId`.
- `POST /goals` : `{ title, employeeId?, ownerId?, description?, measurement?,
  category?, weight?, startDate?, dueDate?, planId?, parentGoalId? }` ;
  `employeeId` vaut par défaut la fiche de l'appelant. Le porteur ne change
  jamais. `PATCH` accepte les mêmes champs et `status` parmi `not_started`,
  `in_progress`, `cancelled` (`achieved` suit la progression, `late` le job).
  Un objectif `cancelled` ne compte pas dans la pondération et ne progresse plus
  (`409`). `DELETE` est logique.
- `PATCH /goals/:id/progress` : `{ progress: 0..100 }` ; 100 ⇒ `achieved`.
- `POST /goals/:id/activities` : `{ title, description?, status?, plannedDate?,
  employeeId? }` ; `completedAt` est posé si `status = done`.
- `PATCH /goals/:id/activities/:activityId` : `{ title?, description?, status?,
  plannedDate? }` ; `completedAt` est posé en passant à `done` et effacé en le
  quittant. `DELETE` est physique (activité sans historique propre, audité).
- `GET /activities` : `page`, `perPage` (≤ 200), `filter[goalId|employeeId|status]` ;
  activités des objectifs non supprimés visibles par l'appelant.

### OKR (précisions du 2026-11-23)
- Réponses : l'OKR porte ses `keyResults` (ordonnés par `position`) et `progress`
  (recalculé par trigger).
- `POST /okrs` : `{ quarter: 'AAAA-Qn', objective, employeeId? }` ; `employeeId`
  vaut par défaut la fiche de l'appelant, autrui réservé à O H et au manager.
- `PATCH /okrs/:id` (`quarter`, `objective`) et `PUT /okrs/:id/key-results`
  (`{ keyResults: [{ title, metric?, targetValue?, currentValue?, unit?, isDone? }] }`,
  20 au plus, remplace la liste) : seulement en `draft` ou `needs_revision`, sinon `409`.
- `PATCH /okrs/:id/key-results/:krId` : `{ isDone?, currentValue? }` ; refusé
  (`409`) quand l'OKR est `pending`, `completed` ou `archived`.
- `validate` : `{ comment? }` ; l'OKR passe `validated` et `status = active`.
  `request-revision` : `{ comment }` obligatoire. Personne ne décide de son
  propre OKR.
- `DELETE /okrs/:id` : le porteur en `draft`/`needs_revision`, O H toujours.
- `POST /okrs/:id/checkins` : `{ message }`, sur un OKR `validated` et `active`
  seulement (`409` sinon) ; `progressSnapshot` fige la progression du moment.
- `POST /okrs/suggest` : livré le 2026-11-24 (voir plus bas). Tout membre ayant une
  fiche employé ; `count` vaut 3 par défaut.

### Évaluations (décisions du 2026-11-23)
- `POST /reviews` ⚡ : `{ cycleId, planId?, employeeIds? }` sur un cycle `open`
  (sinon `409`, `rule = "cycleNotOpen"`). Une évaluation par employé présent
  (`active`, `on_leave`) ou par employé listé ; `manager_id` = manager actuel.
  Les évaluations existantes du cycle sont ignorées. Avec `planId`, les objectifs
  non annulés de l'employé sur ce plan sont rattachés (`goals.review_id`).
  Réponse `201` : `{ data: { created: [reviewId], skipped } }`. Notification
  `review.opened` et e-mail `review_opened` à chaque évalué.
- `GET /reviews` : résumés paginés, `filter[cycleId|employeeId|status]`.
  `GET /reviews/:id` : détail avec `goals[]` (objectif + `selfComment`,
  `selfRating`, `managerComment`, `managerRating`).
- `PATCH /:id/self` : `{ selfScore?: 1..5, selfGlobalComment?, goals?: [{ goalId,
  comment?, rating? }] }` ; `not_started` passe `in_progress`. `submit-self` :
  vers `submitted`, notification `review.submitted` au manager (à défaut aux RH).
- `PATCH /:id/manager` : `{ managerScore?, managerGlobalComment?, goals? }`,
  seulement en `submitted`. Pour l'évalué, les champs du manager valent `null`
  tant que l'évaluation n'est pas `sent_back`, `validated` ou `signed`.
- `validate` exige `managerScore` et `managerGlobalComment` (`422`). `send-back` :
  `{ comment }` obligatoire. `sign` : l'évalué, sur une évaluation `validated`.
  Personne n'évalue, ne valide ni ne renvoie sa propre évaluation.
- `PATCH /:id/talent` (décision du 2026-11-24) : `{ performanceScore?: 1..5 | null,
  potentialScore?: 1..5 | null }`, O H seulement (jamais sur sa propre évaluation),
  module `talents` requis, sur une évaluation `validated` ou `signed` (`409`,
  `rule = "notValidated"` sinon) : ce sont des champs RH hors du contenu signé.
  Audit `review.talent_scored`. Le détail expose `performanceScore` et
  `potentialScore`, toujours `null` pour l'évalué.
  `POST /:id/ai-summary` (décision du 2026-11-24) : sans corps, O H ou manager de
  l'équipe (jamais sur soi), refusé en `not_started` (`409`, `rule = "notStarted"`).
  Entrées de l'IA : auto-évaluation, évaluation du manager, objectifs et leurs
  commentaires, feedbacks non privés et visibles du manager reçus sur la période du
  cycle (12 derniers mois sans cycle). Le résultat (≤ 250 mots) est écrit dans
  `ai_summary` et la réponse est le détail de l'évaluation ; `aiSummary` y vaut
  toujours `null` pour l'évalué.

### Feedback et réalisations (précisions du 2026-11-23)
- `POST /feedback` : `{ toEmployeeId, kind: kudos|suggestion|concern, message,
  okrId?, goalId?, isPrivate?, visibleToManager? }`. L'auteur est la fiche de
  l'appelant (`fromEmployeeId`) ; pas de feedback à soi-même (`422`, `rule = "self"`).
  Notification `feedback.received` au destinataire (auteur masqué si privé) ; un
  `concern` notifie aussi les `hr_admin` (à défaut les `owner`).
- `GET /feedback` : `filter[toEmployeeId|kind]`. O H voient tout ; les autres, le
  reçu et l'émis, plus, pour un manager, le reçu par son équipe quand
  `visibleToManager`. Un feedback privé renvoie `fromEmployeeId = null` à tous sauf
  aux RH et à l'auteur.
- `DELETE /feedback/:id` : suppression logique par l'auteur ou O H, jamais par le
  destinataire (même RH).
- `POST /achievements` : `{ title, achievedAt (ISO 8601), employeeId?, goalId?,
  description?, impact? }` ; `employeeId` vaut par défaut la fiche de l'appelant ;
  `goalId` doit être un objectif de cet employé. `GET` : `filter[employeeId|goalId]`,
  limité à soi, l'équipe ou tous. `DELETE` : suppression logique par l'auteur ou O H.

### Talents (décisions du 2026-11-24)
Module `talents` requis (absent de l'essai, 07 §6.2 : `403 E_MODULE_NOT_INCLUDED`).
- `GET /talents/9box?cycleId=` (`cycleId` obligatoire, cycle d'une autre organisation :
  `404`) : évaluations du cycle, toutes pour O H, l'équipe (sans soi) pour un manager.
  Axe performance = `performanceScore`, sinon `managerScore` d'une évaluation
  `signed` ; axe potentiel = `potentialScore`. Niveaux `low|medium|high` par les
  seuils `settings.talents.nineBox`. Réponse : `{ data: { cycleId, thresholds:
  { lowMax, mediumMax }, cells: [{ performance, potential, employees: [...] }] (9),
  unplaced: [...] } }`, chaque employé `{ employeeId, name, reviewId, reviewStatus,
  performanceScore, potentialScore }` ; une évaluation sans l'un des deux axes va
  dans `unplaced`.
- `GET /talents/succession` : paginé, `filter[readiness]`, `filter[employeeId]`
  (titulaire ou successeur). `POST` : `{ positionTitle, currentEmployeeId?,
  successorEmployeeId?, readiness?: ready_now|1_2_years|3_plus_years, notes? }` ;
  `PATCH /:id` accepte les mêmes champs (`null` efface). Employé inconnu ou d'une
  autre organisation : `422`. `DELETE /:id` est physique (rien ne référence un plan),
  audité. Réponse : `{ id, positionTitle, currentEmployee: { id, name } | null,
  successorEmployee, readiness, notes, createdAt, updatedAt }`.
- `GET /talents/skills-matrix` : `page`, `perPage` (≤ 100, pagine les employés),
  `filter[departmentId]`, `filter[skillId][]` (colonnes affichées), `filter[status]`
  (sans statut, les employés partis sont exclus). O H voient tous les employés, un
  manager son équipe. Réponse : `{ data: { skills: [{ id, name, category }],
  employees: [{ id, firstName, lastName, jobTitle, departmentId, levels: { [skillId]:
  level } }] }, meta }`.
- `PUT /talents/skills-matrix` (O H) : `{ entries: [{ employeeId, skillId, level:
  1..5 | null }] }`, 1 à 500 cellules distinctes (`422`, `rule = "distinct"`).
  Un niveau crée ou met à jour l'évaluation, `null` la supprime ; employé ou
  compétence inconnus : `422`, rien n'est appliqué. Réponse : `{ data: { updated,
  removed } }` ; audit `talents.skills_matrix_updated` avec l'avant/après des
  cellules modifiées.

### `POST /org/performance/okrs/suggest`
Entrée : `{ objective: string(10..500), context?: string(0..2000), count?: 3..5 }`.
Sortie : `{ data: { keyResults: [{ title, metric, targetValue, unit }] } }`.
Consomme un crédit IA ; `403 E_AI_QUOTA_EXCEEDED` si le quota du plan est épuisé.

### IA : règles communes (décisions du 2026-11-24)
- Fournisseur OpenAI (`AI_PROVIDER=openai`, `AI_API_KEY`, `AI_MODEL`). Sans clé ou
  sans modèle : `503 E_AI_UNAVAILABLE`, aucun crédit consommé.
- Un crédit est réservé avant l'appel (`usage_counters`, période `AAAA-MM`, limite
  `plans.ai_credits_per_month`), rendu si la réponse reste non conforme après un
  nouvel essai (`503 E_AI_UNAVAILABLE`). Chaque appel réussi écrit un `usage_events`
  (`kind = 'ai'`) par la file.
- `POST /org/recruitment/jobs/:id/generate` (O H R) : `{ notes?: 0..2000, language?:
  fr|en }` (défaut : langue de l'organisation). Envoie titre, type de contrat,
  département, lieu et notes, jamais de salaire. Réponse `{ data: { description,
  requirements } }` ; **rien n'est enregistré**, le client applique par `PATCH`.
- Scoring n8n des candidatures : un crédit est réservé au déclenchement ; quota épuisé
  ⇒ pas d'appel au workflow et événement candidat `scoring_skipped`
  (`payload.reason = 'ai_quota'`) ; échec définitif après les 3 tentatives ⇒ crédit
  rendu.

---

## 10. Facturation `/org/billing` — `owner` uniquement

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/org/billing/subscription` | Abonnement courant, essai, échéance |
| GET | `/org/billing/plans` | Catalogue public |
| POST | `/org/billing/checkout` ⚡ | Ouvre un paiement (OM / MoMo / carte) |
| GET | `/org/billing/payments/:id` | Statut d'un paiement (polling) |
| GET | `/org/billing/payments` | Historique |
| POST | `/org/billing/cancel` | Annule au terme (`cancel_at_period_end`) |
| POST | `/org/billing/resume` | Réactive avant l'échéance |
| GET | `/org/billing/invoices` | Liste |
| GET | `/org/billing/invoices/:id/pdf` | URL signée |
| GET | `/org/billing/usage` | Compteurs (employés, crédits IA) |

### Lecture, annulation et réactivation (décisions du 2026-11-24)
Pas de contrôle de module sur `/org/billing` : une organisation `expired` y garde
accès pour souscrire (07 §6.2). Owner seulement (`403` sinon).
- `GET /subscription` : `{ id, status (statut effectif, 07 §6.5), plan: { id, code,
  name }, cycle, trialEndsAt, currentPeriodStart, currentPeriodEnd,
  cancelAtPeriodEnd, canceledAt, scheduledPlan, scheduledCycle }`.
- `GET /plans` : `[{ id, code, name, priceMonthlyGnf, priceYearlyGnf, maxEmployees,
  aiCreditsPerMonth, modules, features }]` ; sans `price_yearly_gnf`, l'annuel vaut
  10 mois (2 offerts, comme l'existant).
- `GET /usage` : `{ period: 'AAAA-MM', employees: { used, limit }, aiCredits: { used,
  limit } }`.
- `GET /payments` (`filter[status]`, paginé) et `GET /payments/:id` : `{ id,
  merchantReference, planId, cycle, method, status, expectedAmount, paidAmount,
  currency, failureReason, createdAt, updatedAt }`. `GET /invoices` : `{ id, number,
  paymentId, amount, currency, issuedAt, periodStart, periodEnd, hasPdf }`.
- `POST /cancel` : abonnement payant `active` ou `past_due` seulement (`409`,
  `rule = "notCancelable"`) ; passe `canceled` avec `cancelAtPeriodEnd`.
  `POST /resume` : abonnement `canceled` dont la période court (`409`,
  `rule = "notResumable"`). Réponse : l'abonnement. Audités.

### `POST /org/billing/checkout`
```ts
vine.object({
  planId: vine.string().uuid(),
  cycle: vine.enum(['monthly','yearly']),
  method: vine.enum(['orange_money','mtn_momo','card']),
  payerPhone: vine.string().trim().regex(/^\+?224\d{8,9}$/).optional(), // requis si OM/MoMo
})
```
`201` : `{ data: { paymentId, merchantReference, status:'pending',
expectedAmount, currency, instructions?, redirectUrl? } }`.
Le client interroge ensuite `GET /org/billing/payments/:id` toutes les 3 s
(60 tentatives maximum) ; le passage à `succeeded` est confirmé par le webhook
Djomy **et** un appel de vérification serveur.

Précisions du 2026-11-24 :
- Montant calculé par le serveur : prix mensuel, ou annuel (10 mois si l'offre n'a
  pas de prix annuel). Montée de gamme depuis une offre payante en cours : prix de
  la période visée moins le crédit des jours restants de la période actuelle ; la
  nouvelle période commence au paiement. Crédit couvrant tout : `409`,
  `rule = "nothingToPay"`.
- Descente de gamme depuis une offre payante en cours : aucun paiement, l'offre est
  programmée à l'échéance. Réponse `200` : `{ data: { scheduled: true, planId, cycle,
  effectiveAt } }`. Effectif supérieur au `max_employees` visé :
  `403 E_QUOTA_EXCEEDED`, `details[0] = { field: 'employees', rule: <nombre à retirer> }`.
- `payerPhone` obligatoire pour `orange_money` et `mtn_momo` (`422`) ; offre
  inconnue, non publique ou `free` : `422`. `instructions` (texte traduit) pour le
  mobile money, `redirectUrl` (portail Djomy) pour la carte ; l'autre vaut `null`.
- Retour du portail carte : `<WEB_APP_URL>/app/billing/return?payment=<paymentId>`
  (route du front, confirmée le 2026-11-24).
- Djomy injoignable ou non configuré : `503 E_DEPENDENCY_UNAVAILABLE`, le paiement
  créé passe `failed` (`failureReason = 'provider_unavailable'`).
- `GET /org/billing/invoices/:id/pdf` : `{ data: { url, expiresIn: 900 } }` (lien
  signé 15 min) ; `409`, `rule = "notReady"`, tant que le PDF n'est pas généré.

---

## 11. Public `/public` (non authentifié)

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/public/careers/:orgSlug` | Organisation + offres publiées |
| GET | `/public/careers/:orgSlug/jobs/:jobSlug` | Détail d'une offre |
| POST | `/public/careers/:orgSlug/jobs/:jobSlug/apply` | Candidature (multipart) |
| POST | `/public/demo-requests` | Demande de démo |
| GET | `/public/plans` | Catalogue tarifaire |
| POST | `/public/payments/checkout` ⚡ | Paiement avant création de compte |
| GET | `/public/payments/:merchantReference` | Suivi (référence opaque) |
| POST | `/public/payments/:merchantReference/claim` | Rattache le paiement à un compte |

### Pages carrières (précisions du 2026-11-23)
- `GET /public/careers/:orgSlug` : `{ data: { organization: { name, slug, logoUrl },
  jobs: [{ slug, title, department, location, contractType, publishedAt, deadline }] } }`,
  offres `published` sans `deadline` dépassée, cache Redis 60 s vidé à chaque
  changement d'offre, 60 requêtes/min/IP.
- `GET /public/careers/:orgSlug/jobs/:jobSlug` : `{ data: { organization, job } }`,
  `job` ajoute `description`, `requirements`, `requiredDocuments` ; chaque lecture
  incrémente `views_count`.
- Organisation supprimée, sans module `recruitment` ou sans abonnement, offre en
  brouillon, fermée ou expirée : `404` dans tous les cas.

### Candidature
Précisions du 2026-11-23 : `POST /public/careers/:orgSlug/jobs/:jobSlug/apply/check`
`{ email, phone }` répond `200 { data: { available: true } }` ou `409`
(`rule = "already_applied"`) et sert au formulaire **avant** l'envoi des fichiers
(00-HANDOFF §4) ; `/apply` refait le même contrôle avant tout stockage. Doublon =
même offre et même e-mail (casse ignorée) **ou** même téléphone. Pièces : `cv`,
`coverLetter?`, `documents[<clé>]` selon `requiredDocuments` (clé inconnue ou pièce
obligatoire absente : `422`). Champ piège `website` : rempli, `422`. Offre fermée ou
expirée : `410 E_JOB_CLOSED` ; brouillon ou inconnue : `404`. Les erreurs de
validation ne consomment pas les budgets 5/h/IP et 3/h/e-mail.
`multipart/form-data` : `fullName`, `email`, `phone`, `cv` (PDF/DOC/DOCX/JPG/PNG ≤ 2 Mo),
`coverLetter?`, `documents[<clé>]?` selon `job.required_documents`.
Contrôles : offre `published` et non expirée, MIME réel, anti-doublon
`(job_id, email)`, rate limit 5/h/IP et 3/h/e-mail, honeypot.
`phone` est **obligatoire** au format guinéen exact `NNN NN NN NN`
(9 chiffres, 12 caractères) :
`vine.string().trim().regex(/^\d{3} \d{2} \d{2} \d{2}$/)`. Le formulaire public
formate à la saisie ; le serveur revalide et refuse toute autre forme
(`422 E_VALIDATION`). Le numéro est stocké tel qu'affiché.
`201` : `{ data: { candidateId, message } }` — aucune donnée d'autrui exposée.
Déclenche le scoring IA en asynchrone si configuré (07 §4.4), sans possibilité
de relance manuelle.

### Paiement avant inscription
`POST /public/payments/checkout` crée un `payments` sans `organization_id`, avec
`claim_token` (hash en base, valeur renvoyée une seule fois) et
`claim_expires_at = now() + 7 jours`. Après inscription, l'utilisateur appelle
`POST /public/payments/:ref/claim` avec `{ claimToken, organizationName }` :
l'organisation est créée, l'abonnement activé, `claimed_at` renseigné. Depuis le
2026-11-25, `{ claimToken, organizationId }` rattache le paiement à une
organisation existante dont l'appelant est owner (précisions ci-dessous).
Un jeton déjà consommé ou expiré renvoie `409 E_CLAIM_INVALID`.

`GET /public/plans` (livré le 2026-11-24, limiteur des pages carrières, 60/min/IP) :
offres publiques non supprimées, même forme que `GET /org/billing/plans`.

Précisions du 2026-11-24 (limiteur 30 requêtes/min/IP sur `/public/payments`) :
- `POST /public/payments/checkout` : `{ planId, cycle, method, payerPhone?, email }`
  (téléphone obligatoire pour le mobile money). Montant plein, sans prorata. `201` :
  `{ data: { merchantReference, claimToken, claimExpiresAt, status, expectedAmount,
  currency, instructions, redirectUrl } }` ; `claimToken` (`clm_…`) n'est renvoyé
  qu'une fois, seul son SHA-256 est stocké. Retour carte :
  `<WEB_APP_URL>/paiement/retour?ref=<merchantReference>`.
- `GET /public/payments/:ref` (ajouté) : en-tête `X-Claim-Token` obligatoire (`404`
  sans le bon jeton) ; `{ data: { status, planCode, cycle, expectedAmount, currency,
  emailMasked, claimable } }`, pour le suivi toutes les 3 s.
- `POST /public/payments/:ref/claim` : authentifié (e-mail vérifié). Le paiement
  doit être `succeeded`, non rattaché, non expiré et fait avec l'e-mail du compte ;
  sinon `409 E_CLAIM_INVALID` avec `details[0].rule` parmi `notPaid`, `used`,
  `expired`, `email`. Crée l'organisation (l'appelant en est owner, sans essai) et
  l'abonnement payé à partir de maintenant, avec sa facture, dans une transaction.
  `201` : même forme que `POST /organizations` (`plan` = code de l'offre payée).

Précisions du 2026-11-25 (organisation existante, décision de l'utilisateur) :
- `POST /public/payments/:ref/claim` accepte soit `{ claimToken, organizationName }`
  (création, comportement ci-dessus), soit `{ claimToken, organizationId }`.
  Exactement l'un des deux, sinon `422 E_VALIDATION` (règle `target`).
- Avec `organizationId` : l'appelant doit être owner de l'organisation (`403
  E_FORBIDDEN` s'il en est membre sans être owner ; `404` s'il n'en est pas membre
  ou si elle est supprimée). Mêmes contrôles du paiement et mêmes `409
  E_CLAIM_INVALID`. L'abonnement suit la règle du paiement en app (07 §7.5) : même
  offre et même cycle qu'un abonnement payé en cours (`active`, `past_due`,
  `canceled`) → la période est prolongée à partir de sa fin ; sinon (essai, expiré,
  suspendu, autre offre ou cycle) l'abonnement courant est clos et une période
  payée commence maintenant. Facture de l'organisation, audit `payment.claimed`
  dans la même transaction. `201` : même forme que `POST /organizations`
  (`roles` = rôles de l'appelant dans l'organisation, `plan` = code de l'offre payée).

---

## 12. Webhooks `/webhooks`

| Méthode | Chemin | Sécurité |
|---|---|---|
| POST | `/webhooks/djomy/:token` | jeton de chemin `DJOMY_WEBHOOK_PATH_TOKEN` + `X-Webhook-Signature: v1:<HMAC>` + anti-rejeu (décision du 2026-11-24) |
| POST | `/webhooks/n8n/scoring` | HMAC `X-Konkoure-Signature` par organisation |

Précisions du 2026-11-23 : les webhooks sont servis sous `/api/v1/webhooks/*`.
Djomy (décision du 2026-11-24, format réel de l'intégration existante) :
`X-Webhook-Signature` = `v1:` + HMAC-SHA256 hexadécimal du corps brut avec
`DJOMY_CLIENT_SECRET` ; jeton ou signature faux : `401`. `event_id` = `eventId` de
l'événement, sinon SHA-256 du corps ; un rejeu répond `200 { received: true,
duplicate: true }`. Le statut annoncé n'est jamais cru : le job `payments.settle`
interroge `GET /v1/payments/:id/status` chez Djomy.
`/webhooks/n8n/scoring?organizationId=…&candidateId=…` (l'URL de rappel transmise
à n8n) : corps = la réponse n8n telle quelle (tableau à un élément ou objet),
`X-Konkoure-Signature` = HMAC-SHA256 hexadécimal du corps brut avec le secret de
l'organisation (préfixe `sha256=` accepté), `X-Konkoure-Timestamp` à ± 5 min.
`event_id` = SHA-256 de l'organisation, du candidat et du corps ; un rejeu répond
`200 { received: true, duplicate: true }`. Signature absente, fausse ou périmée :
`401`.
| POST | `/webhooks/resend` | HMAC (statuts de délivrabilité) |

Toujours `200` après enregistrement (traitement asynchrone), `401` si signature
invalide, `409` si `event_id` déjà traité (réponse idempotente `200` en pratique).

---

## 13. Back-office `/platform`

| Méthode | Chemin | Niveau |
|---|---|---|
| GET | `/platform/dashboard` | support | MRR, organisations actives, essais, churn |
| GET | `/platform/organizations` | support | recherche, filtres statut/plan |
| GET | `/platform/organizations/:id` | support | détail complet, usage |
| PATCH | `/platform/organizations/:id/subscription` | **root** | plan, statut, cycle, échéance, overrides |
| POST | `/platform/organizations/:id/suspend` \| `/reactivate` | **root** |
| POST | `/platform/organizations/:id/restore` | **root** |
| GET/POST | `/platform/plans` | lecture support / écriture **root** |
| PATCH/DELETE | `/platform/plans/:id` | **root** |
| GET | `/platform/users` | support | recherche globale |
| PATCH | `/platform/users/:id/roles` | **root** |
| POST | `/platform/users/:id/ban` \| `/unban` | **root** | ajouté le 2026-11-24 |
| POST | `/platform/users/:id/impersonate` | **root** | token 30 min, audité |
| GET/POST/DELETE | `/platform/admins` | **root** |
| GET | `/platform/settings` | support |
| PUT | `/platform/settings` | **root** |
| GET | `/platform/payments` | support |
| POST | `/platform/payments/:id/reconcile` | **root** |
| GET | `/platform/demo-requests` | support |
| PATCH | `/platform/demo-requests/:id` | support | statut, assignation |
| GET | `/platform/logs/audit` | support | filtres org, acteur, action, période |
| GET | `/platform/logs/system` | support | filtres canal, niveau |
| GET | `/platform/logs/usage` | support | filtres module, période |
| GET | `/platform/health` | support | état DB, Redis, files, intégrations |

Toutes les listes de journaux sont paginées **par curseur** et plafonnées à
500 éléments par page.

### Organisations, abonnements et offres (décisions du 2026-11-24)
Accès : `auth` puis admin plateforme actif (`403 E_FORBIDDEN` sinon, inactif compris) ;
`support` lit, `root` écrit (`403`). Chaque action `root` est auditée
(`actorRole = 'platform_root'`).
- `GET /platform/dashboard` : `{ organizations: { live, paying }, subscriptions: {
  trialing, active, past_due, canceled, suspended, expired } (statuts effectifs),
  mrrGnf, churn30d }`. MRR = somme mensualisée (annuel / 12) des abonnements payants
  en cours (`active`, `past_due`, `canceled` avant échéance) ; churn = offres payantes
  dont l'accès a pris fin dans les 30 derniers jours.
- `GET /platform/organizations` : `page`, `perPage`, `q` (nom ou slug),
  `filter[status]` (statut enregistré de l'abonnement courant), `filter[plan]` (code),
  `filter[deleted]` (booléen, 2026-11-26 : les organisations supprimées non encore
  purgées au lieu des actives) ; lignes `{ id, name, slug, createdAt, deletedAt,
  employees, subscription: { status, cycle, planCode, planName, trialEndsAt,
  currentPeriodEnd } | null }`.
- `GET /platform/organizations/:id` : organisation, `subscription` (forme de
  `GET /org/billing/subscription` + `storedStatus`, `maxEmployeesOverride`,
  `modulesOverride`), `usage`, `counts: { members, employees }`, `owners: [{ id,
  email, fullName }]`.
- `PATCH /platform/organizations/:id/subscription` (root) : `{ planId?, status?, cycle?,
  currentPeriodEnd?, trialEndsAt?, maxEmployeesOverride?, modulesOverride? }` ; cache
  des droits invalidé. `POST suspend` : `suspended` (`hr` en lecture seule), `409` si
  déjà suspendu ou expiré ; `POST reactivate` : depuis `suspended` seulement, statut
  recalculé depuis l'échéance (`409` sinon). Réponse : le détail.
- `POST /platform/organizations/:id/restore` (root, 2026-11-26) : annule un `DELETE /org`
  dans les 30 jours (`deleted_at` remis à `null`, journal `platform.organization_restored`,
  cache des droits invalidé). `409` `rule = "notDeleted"` pour une organisation active,
  `rule = "purged"` après 30 jours ou après la purge ; `404` si inconnue. Réponse : le
  détail, qui porte aussi `deletedAt` et `purgedAt`.
- `GET /platform/plans` : toutes les offres, supprimées comprises (`planDto` +
  `priceGnf`, `explicitYearlyPriceGnf`, `sortOrder`, `isPublic`, `deletedAt`).
  `POST` (root) : `{ code (a-z, 0-9, -, _), name, priceGnf, priceYearlyGnf?,
  maxEmployees, aiCreditsPerMonth?, modules[], features?, sortOrder?, isPublic? }`,
  code unique (`409`). `PATCH /:id` : mêmes champs sauf `code`, qui ne change jamais.
  `DELETE /:id` : logique, `409` (`rule = "inUse"`) si un abonnement non expiré
  l'utilise ou la programme.

### Comptes, impersonation et admins (décisions du 2026-11-24)
- `GET /platform/users` : `page`, `perPage`, `q` (e-mail ou nom) ; `{ id, email,
  fullName, isActive, emailVerified, lastLoginAt, createdAt, platformLevel,
  organizations: [{ organizationId, organizationName, roles }] }`, sans donnée de
  fiche personnelle.
- `PATCH /platform/users/:id/roles` (root) : `{ organizationId, roles[] }` remplace les
  rôles du compte dans l'organisation (liste vide : retrait) ; mêmes protections que
  `/org/members` (`409 lastOwner`), le compte doit déjà en être membre (`404`). Audit
  `role.granted|revoked` avec `actorRole = 'platform_root'`.
- `POST /platform/users/:id/ban` (root) : `{ reason }` ; `users.is_active = false`, toutes
  les sessions révoquées (jetons d'accès et refresh), `401` immédiat. `409` sur soi
  (`self`), sur un admin plateforme actif (`platformAdmin`), si déjà banni.
  `POST /unban` : réactive (`409 notBanned`). Audit `user.banned|unbanned`.
- `POST /platform/users/:id/impersonate` (root) : `{ reason }` → `201 { accessToken,
  expiresIn: 1800, expiresAt, user }`. Jeton d'accès de 30 min, sans refresh, nommé
  `impersonation:<id de l'admin>`. `GET /me` renvoie alors `impersonation: { by,
  expiresAt }` (bannière), `null` sinon. Interdit pendant l'impersonation (`403`,
  `rule = "impersonation"`) : `/platform/*`, `PATCH /me`, `POST /me/password`,
  `DELETE /me/sessions/:id`, `POST /auth/logout-all`, `DELETE /org`,
  `POST /org/billing/checkout|cancel`. Refusé sur soi, un admin plateforme ou un compte
  banni (`409`). Audit `impersonation.started` avec le motif.
- `GET /platform/admins` (root) : admins actifs `{ userId, email, fullName, level,
  createdAt }`. `POST` : `{ email, level }` donne ou change le niveau d'un compte
  existant (`422` si inconnu ou banni). `DELETE /:userId` : désactive. Le dernier root
  actif ne peut être ni retiré ni rétrogradé (`409 lastRoot`). Audit
  `platform_admin.granted|revoked`.

### Exploitation (décisions du 2026-11-24)
- `GET /platform/settings` : `[{ key, value, isSecret, description, updatedAt }]`, la
  valeur d'un réglage secret vaut toujours `null`. `PUT` (root) : `{ settings: [{ key,
  value }] }`, clés connues seulement (`422`), valeur validée par clé ; audit
  `platform_setting.updated` (secret masqué). `modules_open_for_testing` (booléen,
  `false` par défaut) ouvre tous les modules à toutes les organisations, jamais au-delà
  d'une suspension ou d'une expiration ; effet sous 60 s (cache des droits).
- `GET /platform/payments` : paginé, `filter[status|failureReason|organizationId]`,
  paiements avant inscription compris (`presignup`). `POST /platform/payments/:id/
  reconcile` (root) : redemande l'état à Djomy ; payé en totalité ⇒ le paiement est
  réglé normalement (activation, facture, e-mail) même s'il était `failed`/`expired` ;
  `409` (`notPaid`, `noTransaction`) sinon ; déjà réglé ⇒ `200`, `outcome =
  "already_settled"`. Audit `payment.reconciled`.
- `POST /public/demo-requests` : `{ fullName, email, phone, companyName, companySize,
  message? }`, 10 par heure et par IP ; `201 { id, received: true }`. E-mail
  `demo_request` à `DEMO_REQUESTS_EMAIL` (sans adresse : seulement enregistrée).
  `GET /platform/demo-requests` (`filter[status]`) et `PATCH /:id` (support) :
  `{ status?, assignedTo? }`, l'assigné doit être un admin plateforme actif.
- `GET /platform/logs/:kind` (`audit`, `system`, `usage`) : `cursor`, `limit` (≤ 500,
  100 par défaut), `filter[organizationId|from|to]`, plus `actorUserId|action` (audit),
  `channel|level` (system), `module` (usage) ; `{ data, meta: { nextCursor } }`.
- `GET /platform/health` : sondes de `/health/ready`, pilote de file, intégrations
  (`djomy`, `ai` : `configured` ou `missing`).

---

## 14. Santé

| Méthode | Chemin | Auth |
|---|---|---|
| GET | `/health` | — | `{ status:'ok', version, uptime }` |
| GET | `/health/ready` | — | `200` ou `503`, `{ status, checks: { database, redis, migrations } }` |
| GET | `/metrics` | réseau interne | format Prometheus |

## Endpoints complémentaires requis par le frontend
Format, pagination et erreurs identiques au reste du document.

| Méthode | Chemin | Rôle | Description |
|---|---|---|---|
| GET | `/me` | authentifié | contrat détaillé en §2 (`GET /me`) |
| GET | `/org/employees/:id/leave-balance` | soi, manager, RH | solde, jours en attente |
| PATCH | `/org/recruitment/candidates/:id/stage` | recrutement | change l'étape, journalise |
| GET | `/org/recruitment/candidates/:id/cv-url` | recrutement | URL signée courte du CV |
| GET/POST/DELETE | `/org/employees/:id/badge` | O H S | badge NFC, audité (§6) |
| GET | `/org/timeclock/badge-events?employeeId` | O H | historique des badges (§6) |
| POST | `/public/jobs/:id/application-uploads` | public, limité | contrôle doublon + URLs d'envoi |
| POST | `/public/jobs/:id/applications` | public, limité | enregistrement + scoring n8n |
| POST | `/public/prepaid/codes` · `/payments` · `/payments/:id/claim` | public / authentifié | paiement avant inscription |
| `*` | `/platform/*` | super-admin | organisations, offres, utilisateurs, paiements, démos, journal, réglages |
Correspondance complète avec l'existant : `../frontend/03-integration-api.md`.
