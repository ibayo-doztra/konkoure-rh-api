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
`200` : même charge utile que `register`, plus la liste des organisations
(`{ id, name, slug, logoUrl, roles[] }`).
Erreurs : `401 E_UNAUTHORIZED`, `423 E_ACCOUNT_LOCKED`,
`409 E_PASSWORD_RESET_REQUIRED`, `429`.

### `POST /auth/refresh`
Entrée : `{ refreshToken }` ou cookie httpOnly.
`200` : nouveaux `accessToken` + `refreshToken`.
Erreurs : `401 E_UNAUTHORIZED` (réutilisation détectée ⇒ famille révoquée).

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

---

## 3. Organisation `/org`

| Méthode | Chemin | Perm. | Description |
|---|---|---|---|
| POST | `/organizations` | auth (e-mail vérifié) | Crée une organisation, le créateur devient `owner` |
| GET | `/org` | tous | Détail de l'organisation courante |
| PATCH | `/org` | O H | Nom, langue, devise, fuseau, modèle de performance |
| PUT | `/org/settings` | O H | Bloc `settings` complet (schéma 02 §11) |
| POST | `/org/logo` | O H | Upload logo (2 Mo, png/jpg/webp/svg) |
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
| POST | `/org/employees/import/preview` | O H | Analyse d'un fichier Excel/CSV |
| POST | `/org/employees/import/commit` ⚡ | O H | Import effectif |
| GET | `/org/employees/export` | O H | CSV/XLSX (5/h) |

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

`GET /org/employees/managers` retourne uniquement les employés qui sont
responsables d'un département **ou** déjà `manager_id` d'au moins un employé
(règle métier 07 §1.4).

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
| GET/POST | `/org/skills` | lecture : O H M · écriture : O H |
| PATCH/DELETE | `/org/skills/:id` | O H |
| GET | `/org/employees/:id/skills` | O H · M(team) · self |
| PUT | `/org/employees/:id/skills` | O H |

Suppression de département : `409 E_CONFLICT` si des employés y sont rattachés,
sauf `?reassignTo=<departmentId>`.

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
| GET | `/org/timeclock/logs/export` | O H |
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

### Synchronisation hors-ligne (mobile)
`POST /org/timeclock/sync` accepte un tableau de 1 à 200 pointages avec
`clientPunchId` obligatoire, et renvoie par élément
`{ clientPunchId, status: 'created'|'duplicate'|'rejected', reason? }`.

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
| GET/POST | `/org/performance/goals` | création : tous (soi) · O H M (autrui) |
| GET/PATCH/DELETE | `/org/performance/goals/:id` | O H · M(team) · self |
| PATCH | `/org/performance/goals/:id/progress` | self · M(team) |
| GET/POST | `/org/performance/goals/:id/activities` | self · M(team) · O H |
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
| GET | `/org/talents/9box` | O H · M(team) |
| GET/PUT | `/org/talents/skills-matrix` | O H · M(team lecture) |
| GET/POST/PATCH/DELETE | `/org/talents/succession` | O H |

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
`multipart/form-data` : `fullName`, `email`, `phone`, `cv` (pdf/png/jpg ≤ 10 Mo),
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
| GET | `/health/ready` | — | vérifie PostgreSQL, Redis, migrations |
| GET | `/metrics` | réseau interne | format Prometheus |

## Endpoints complémentaires requis par le frontend
Format, pagination et erreurs identiques au reste du document.

| Méthode | Chemin | Rôle | Description |
|---|---|---|---|
| GET | `/v1/me` | authentifié | profil, organisation active, rôles, employé lié, abonnement, modules, super-admin |
| GET | `/v1/dashboard/kpis?period=` | owner, hr_admin, manager (périmètre) | KPIs en direct |
| GET | `/v1/employees/:id/leave-balance` | soi, manager, RH | solde, jours en attente |
| PATCH | `/v1/candidates/:id/stage` | recrutement | change l'étape, journalise |
| GET | `/v1/candidates/:id/cv-url` | recrutement | URL signée courte du CV |
| GET/PUT/DELETE | `/v1/employees/:id/badge` | owner, hr_admin | badge NFC, audité |
| GET | `/v1/employees/:id/badge/history` | owner, hr_admin | historique |
| POST | `/v1/public/jobs/:id/application-uploads` | public, limité | contrôle doublon + URLs d'envoi |
| POST | `/v1/public/jobs/:id/applications` | public, limité | enregistrement + scoring n8n |
| POST | `/v1/public/prepaid/codes` · `/payments` · `/payments/:id/claim` | public / authentifié | paiement avant inscription |
| `*` | `/v1/platform/*` | super-admin | organisations, offres, utilisateurs, paiements, démos, journal, réglages |
Correspondance complète avec l'existant : `../frontend/03-integration-api.md`.
