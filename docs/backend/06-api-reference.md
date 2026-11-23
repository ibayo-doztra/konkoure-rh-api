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
  "series": { "headcountByMonth": [], "punchesByDay": [], "leavesByType": [] }
}}
```
Sources : `attendance_days`, `leave_balances`, agrégats précalculés. Cache Redis
5 min, clé `dash:<orgId>:<period>:<roleScope>`.

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
  `punctualityRate` vaut `null` tant que `work_schedules` n'existe pas. `leaves.pending`
  sans condition de date, `approvedThisPeriod` selon `decided_at`, `daysTaken` = jours
  approuvés commençant dans la période. Séries : `headcountByMonth` sur 12 mois
  `[{ month: 'YYYY-MM', total }]`, `punchesByDay` `[{ day, count }]` (jours sans pointage
  omis), `leavesByType` `[{ type, days }]`.
- **Modules** : `recruitment` vaut `null` tant que son module n'est pas livré ; un bloc (ou une série) dont le module n'est pas dans les droits de
  l'organisation vaut `null` (`hr` : effectifs, `timeclock` : présence, `leaves` : congés).
  La route n'a donc pas de middleware d'entitlement.
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
  `duplicate`. Réponse `{ data: [{ employeeId, day, firstIn, lastOut, workedMinutes,
  punchCount, isComplete, anomaly }], meta }`, tri `day desc`. Périmètre de `/logs`
  (O H S tous, M équipe + soi, E soi).
- **Jour** : date locale dans le fuseau de l'organisation ; un service de nuit est coupé
  à minuit tant que `work_schedules` n'existe pas. Paires lues dans l'ordre : un `in`
  alors qu'une paire est ouverte, ou un `out` sans `in`, ⇒ `duplicate` (le premier `in`
  est gardé). Une anomalie : `missing_out` (paire ouverte sur un jour clos), puis
  `duplicate`, puis `out_of_zone`.
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
| POST | `/org/recruitment/jobs/:id/generate` | O H R | Génération IA de l'annonce |
| GET | `/org/recruitment/candidates` | O H R |
| POST | `/org/recruitment/candidates` | O H R |
| GET/PATCH/DELETE | `/org/recruitment/candidates/:id` | O H R |
| POST | `/org/recruitment/candidates/:id/stage` | O H R |
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
| GET/POST | `/org/integrations/social/accounts` | O H |
| DELETE | `/org/integrations/social/accounts/:id` | O H |
| POST | `/org/recruitment/jobs/:id/social-posts` | O H R |

Filtres candidats : `filter[jobId]`, `filter[stage]`, `filter[minScore]`, `q`.
Le changement d'étape écrit un `candidate_events` et notifie les recruteurs.

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
- `POST /okrs/suggest` : reporté avec les crédits IA (lot facturation).

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
- `performance_score` et `potential_score` (9-box) ne sont pas exposés en
  écriture avant le lot talents. `POST /:id/ai-summary` est reporté au lot IA.

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

### `POST /org/performance/okrs/suggest`
Entrée : `{ objective: string(10..500), context?: string(0..2000), count?: 3..5 }`.
Sortie : `{ data: { keyResults: [{ title, metric, targetValue, unit }] } }`.
Consomme un crédit IA ; `403 E_AI_QUOTA_EXCEEDED` si le quota du plan est épuisé.

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

### Candidature
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
l'organisation est créée, l'abonnement activé, `claimed_at` renseigné.
Un jeton déjà consommé ou expiré renvoie `409 E_CLAIM_INVALID`.

---

## 12. Webhooks `/webhooks`

| Méthode | Chemin | Sécurité |
|---|---|---|
| POST | `/webhooks/djomy` | HMAC `X-Djomy-Signature` + horodatage + anti-rejeu |
| POST | `/webhooks/n8n/scoring` | HMAC `X-Konkoure-Signature` par organisation |
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
| GET/POST | `/platform/plans` | lecture support / écriture **root** |
| PATCH/DELETE | `/platform/plans/:id` | **root** |
| GET | `/platform/users` | support | recherche globale |
| PATCH | `/platform/users/:id/roles` | **root** |
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
