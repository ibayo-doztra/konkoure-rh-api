# 02 — Schéma PostgreSQL repensé

Le schéma reprend la sémantique métier de l'existant (44 tables Supabase) et la
normalise. Différences structurelles majeures listées au §12.

Conventions communes à **toutes** les tables :

| Colonne | Type | Règle |
|---|---|---|
| `id` | `uuid` PK | uuid v7 généré applicativement |
| `organization_id` | `uuid NOT NULL` | FK `organizations(id) ON DELETE CASCADE` — sur toute table métier |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | — |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | mis à jour par trigger |
| `created_by` | `uuid NULL` | FK `users(id) ON DELETE SET NULL` |
| `updated_by` | `uuid NULL` | FK `users(id) ON DELETE SET NULL` |
| `deleted_at` | `timestamptz NULL` | seulement sur les tables à soft delete |

Index implicite sur chaque FK. Index composite `(organization_id, <colonne de
filtre principale>)` sur chaque table métier.

## 1. Vue d'ensemble

```text
                       ┌────────────────┐
                       │     plans      │
                       └───────┬────────┘
                               │
┌─────────┐  user_roles ┌──────▼──────────┐ 1─n ┌───────────────┐
│  users  ├────────────►│  organizations  ├────►│ subscriptions │
└────┬────┘             └───┬────┬────┬───┘     └───────┬───────┘
     │ 0..1                 │    │    │                 │
┌────▼──────┐         ┌─────▼──┐ │ ┌──▼──────────┐  ┌───▼─────────┐
│ employees │◄────────┤ depts  │ │ │ work_zones  │  │  payments   │
└──┬──┬──┬──┘         └────────┘ │ └──────┬──────┘  └─────────────┘
   │  │  │                       │        │
   │  │  └── contracts           │        └── time_logs
   │  │  └── employee_skills ──► skills
   │  │  └── nfc_badges ──► nfc_badge_events
   │  └───── leave_requests ──► leave_balances / public_holidays
   │
   ├── goals ──► goal_activities / achievements
   ├── okrs ──► okr_key_results ──► okr_checkins
   ├── performance_reviews ──► review_items / review_goal_comments
   ├── feedbacks
   └── succession_plans

organizations ──► jobs ──► candidates ──► candidate_notes / candidate_events
organizations ──► social_accounts ──► social_posts
organizations ──► notifications / audit_logs / usage_events

platform_admins · platform_settings · system_logs · demo_requests · webhook_receipts
  (hors tenant)
```

## 2. Énumérations PostgreSQL

```sql
CREATE TYPE app_role            AS ENUM ('owner','hr_admin','manager','employee','recruiter','security_agent');
CREATE TYPE platform_admin_level AS ENUM ('root','support');
CREATE TYPE employee_status     AS ENUM ('active','on_leave','suspended','terminated');
CREATE TYPE contract_type       AS ENUM ('cdi','cdd','stage','freelance','apprenticeship','daily');
CREATE TYPE contract_status     AS ENUM ('draft','active','suspended','terminated');
CREATE TYPE punch_type          AS ENUM ('in','out');
CREATE TYPE punch_source        AS ENUM ('nfc','manual','mobile_gps','kiosk','import');
CREATE TYPE zone_shape          AS ENUM ('circle','polygon');
CREATE TYPE leave_type          AS ENUM ('annual','sick','maternity','paternity','unpaid','special');
CREATE TYPE leave_status        AS ENUM ('pending','approved','rejected','cancelled');
CREATE TYPE job_status          AS ENUM ('draft','published','closed','archived');
CREATE TYPE candidate_stage     AS ENUM ('new','screening','interview','offer','hired','rejected');
CREATE TYPE candidate_event_type AS ENUM ('created','stage_changed','scored','note_added','note_deleted','document_added','email_sent');
CREATE TYPE performance_model   AS ENUM ('classic','okr');
CREATE TYPE goal_category       AS ENUM ('business','development','behavioral');
CREATE TYPE goal_status         AS ENUM ('not_started','in_progress','achieved','late','cancelled');
CREATE TYPE goal_activity_status AS ENUM ('planned','in_progress','done');
CREATE TYPE okr_status          AS ENUM ('draft','active','completed','archived');
CREATE TYPE okr_review_status   AS ENUM ('draft','pending','validated','needs_revision');
CREATE TYPE perf_cycle_frequency AS ENUM ('annual','semestrial','quarterly','custom');
CREATE TYPE perf_cycle_status   AS ENUM ('draft','open','closed');
CREATE TYPE perf_plan_status    AS ENUM ('draft','active','closed');
CREATE TYPE perf_review_status  AS ENUM ('not_started','in_progress','submitted','sent_back','validated','signed');
CREATE TYPE feedback_kind       AS ENUM ('kudos','suggestion','concern');
CREATE TYPE subscription_status AS ENUM ('trialing','active','past_due','suspended','canceled','expired');
CREATE TYPE billing_cycle       AS ENUM ('monthly','yearly');
CREATE TYPE payment_status      AS ENUM ('pending','processing','succeeded','failed','expired','refunded');
CREATE TYPE payment_method      AS ENUM ('orange_money','mtn_momo','card','bank_transfer','manual');
CREATE TYPE social_provider     AS ENUM ('facebook','linkedin','twitter');
CREATE TYPE social_account_status AS ENUM ('active','expired','revoked');
CREATE TYPE social_post_status  AS ENUM ('pending','published','failed');
CREATE TYPE invitation_status   AS ENUM ('pending','accepted','revoked','expired');
CREATE TYPE demo_request_status AS ENUM ('new','contacted','scheduled','done','rejected');
CREATE TYPE email_delivery_status AS ENUM ('pending','sent','failed');
```

> Toute valeur d'énumération est en **anglais, snake_case**. Les libellés
> français sont produits par i18n côté API (`resources/lang/fr`).

## 3. Socle : identité et tenant

### `users`
| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `email` | `citext NOT NULL UNIQUE` | extension `citext` requise |
| `password_hash` | `text NULL` | null si compte créé par invitation non acceptée |
| `full_name` | `text NULL` | |
| `avatar_url` | `text NULL` | |
| `preferred_language` | `text NOT NULL DEFAULT 'fr'` | `fr` \| `en` |
| `email_verified_at` | `timestamptz NULL` | |
| `last_login_at` | `timestamptz NULL` | |
| `failed_login_attempts` | `int NOT NULL DEFAULT 0` | |
| `locked_until` | `timestamptz NULL` | |
| `is_active` | `bool NOT NULL DEFAULT true` | |
| `deleted_at` | `timestamptz NULL` | |

Pas de `organization_id` : un utilisateur est global, rattaché via `user_roles`.
Index : `UNIQUE(email) WHERE deleted_at IS NULL`.

### `auth_access_tokens` (table gérée par `@adonisjs/auth`)
`id bigserial`, `tokenable_id uuid`, `type text`, `name text`, `hash text`,
`abilities json`, `created_at`, `updated_at`, `last_used_at`, `expires_at`.
Index sur `(tokenable_id, type)` et `hash`.

### `auth_refresh_tokens`
| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid NOT NULL | FK users CASCADE |
| `token_hash` | `text NOT NULL UNIQUE` | SHA-256 du token opaque |
| `family_id` | `uuid NOT NULL` | rotation : toute réutilisation révoque la famille |
| `parent_id` | `uuid NULL` | chaînage de rotation |
| `device_label` | `text NULL` | ex. « Flutter Android 14 » |
| `ip` | `inet NULL` | |
| `user_agent` | `text NULL` | |
| `expires_at` | `timestamptz NOT NULL` | |
| `revoked_at` | `timestamptz NULL` | |
| `replaced_at` | `timestamptz NULL` | |

Index : `(user_id, revoked_at)`, `(family_id)`, `(expires_at)`.

### `organizations`
| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | `text NOT NULL` | |
| `slug` | `text NOT NULL UNIQUE` | usage carrières publiques |
| `logo_url` | `text NULL` | |
| `country_code` | `char(2) NOT NULL DEFAULT 'GN'` | |
| `timezone` | `text NOT NULL DEFAULT 'Africa/Conakry'` | |
| `default_language` | `text NOT NULL DEFAULT 'fr'` | |
| `default_currency` | `char(3) NOT NULL DEFAULT 'GNF'` | |
| `performance_model` | `performance_model NOT NULL DEFAULT 'classic'` | |
| `settings` | `jsonb NOT NULL DEFAULT '{}'` | préférences libres (voir §11) |
| `deleted_at` | `timestamptz NULL` | |

### `user_roles`
| Colonne | Type |
|---|---|
| `id` uuid PK, `user_id` uuid NOT NULL, `organization_id` uuid NOT NULL, `role` app_role NOT NULL, `granted_by` uuid NULL |

`UNIQUE(user_id, organization_id, role)`. Index `(organization_id, role)`.
**Les rôles ne sont jamais stockés sur `users` ni sur `employees`** (risque
d'élévation de privilèges).

### `invitations`
`id`, `organization_id`, `email citext NOT NULL`, `role app_role NOT NULL`,
`employee_id uuid NULL`, `token_hash text NOT NULL UNIQUE`,
`status invitation_status NOT NULL DEFAULT 'pending'`, `expires_at timestamptz NOT NULL`,
`accepted_at`, `accepted_user_id`, `invited_by`.
`UNIQUE(organization_id, email) WHERE status = 'pending'`.

## 4. RH

### `employees`
| Colonne | Type | Notes |
|---|---|---|
| `id`, `organization_id` | uuid | |
| `user_id` | uuid NULL UNIQUE par org | lien vers un compte |
| `employee_number` | `text NULL` | `UNIQUE(organization_id, employee_number)` |
| `first_name`, `last_name` | `text NOT NULL` | |
| `email` | `citext NULL` | `UNIQUE(organization_id, email)` |
| `phone` | `text NULL` | E.164 recommandé |
| `photo_url` | `text NULL` | |
| `job_title` | `text NULL` | |
| `department_id` | uuid NULL | FK departments SET NULL |
| `manager_id` | uuid NULL | FK employees SET NULL (auto-référence) |
| `hire_date` | `date NULL` | |
| `end_date` | `date NULL` | |
| `status` | `employee_status NOT NULL DEFAULT 'active'` | |
| `base_salary` | `numeric(14,2) NULL` | **champ sensible** |
| `salary_currency` | `char(3) NULL` | |
| `leave_balance` | `numeric(6,2) NOT NULL DEFAULT 0` | solde courant, jours |
| `birth_date` | `date NULL` | |
| `gender` | `text NULL` | |
| `national_id` | `text NULL` | **sensible** |
| `passport_document_path` | `text NULL` | chemin privé, jamais d'URL publique |
| `address` | `jsonb NOT NULL DEFAULT '{}'` | |
| `emergency_contact` | `jsonb NOT NULL DEFAULT '{}'` | |
| `profile_details` | `jsonb NOT NULL DEFAULT '{}'` | champs libres |
| `deleted_at` | timestamptz NULL | |

Index : `(organization_id, status)`, `(organization_id, department_id)`,
`(organization_id, manager_id)`, GIN trigram sur `lower(first_name||' '||last_name)`.

Contrainte : `manager_id <> id`. Cycle hiérarchique interdit (vérification
applicative, voir 07 §1.3).

**Le badge NFC quitte `employees`** : voir `nfc_badges`.

### `departments`
`id`, `organization_id`, `name text NOT NULL`, `description text`,
`manager_id uuid NULL` (FK employees), `parent_department_id uuid NULL`,
`deleted_at`.
`UNIQUE(organization_id, lower(name)) WHERE deleted_at IS NULL`.

### `contracts`
`id`, `organization_id`, `employee_id NOT NULL`, `type contract_type NOT NULL`,
`status contract_status NOT NULL DEFAULT 'draft'`, `start_date date NOT NULL`,
`end_date date NULL`, `trial_period_end date NULL`,
`salary numeric(14,2) NULL` (**sensible**), `currency char(3) NOT NULL DEFAULT 'GNF'`,
`weekly_hours numeric(5,2) NULL`, `document_path text NULL`, `notes text`,
`deleted_at`.
Contrainte : `end_date IS NULL OR end_date >= start_date`.
Un seul contrat `active` par employé : index partiel unique
`(employee_id) WHERE status = 'active' AND deleted_at IS NULL`.

### `skills` / `employee_skills`
- `skills` : `id`, `organization_id`, `name`, `category text NULL`.
  `UNIQUE(organization_id, lower(name))`.
- `employee_skills` : `id`, `organization_id`, `employee_id`, `skill_id`,
  `level smallint NOT NULL CHECK (level BETWEEN 1 AND 5)`,
  `assessed_at date NULL`. `UNIQUE(employee_id, skill_id)`.

## 5. Pointage

### `work_zones`
`id`, `organization_id`, `name text NOT NULL`, `shape zone_shape NOT NULL DEFAULT 'circle'`,
`latitude double precision NULL`, `longitude double precision NULL`,
`radius_meters int NULL CHECK (radius_meters BETWEEN 20 AND 5000)`,
`polygon jsonb NULL` (GeoJSON `Polygon`), `is_active bool NOT NULL DEFAULT true`,
`timezone text NULL` (hérite de l'organisation si null).
Contrainte : `shape='circle'` ⇒ lat/lng/radius non nuls ; `shape='polygon'` ⇒
`polygon` non nul et fermé (≥ 4 points, premier = dernier).

### `nfc_badges`
| Colonne | Type | Notes |
|---|---|---|
| `id`, `organization_id` | uuid | |
| `employee_id` | uuid NOT NULL | FK employees CASCADE |
| `uid_normalized` | `text NOT NULL` | UID canonique (voir 07 §2.2) |
| `uid_hash` | `text NOT NULL` | SHA-256(uid + pepper), sert aux recherches |
| `is_active` | `bool NOT NULL DEFAULT true` | |
| `assigned_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `revoked_at` | `timestamptz NULL` | |

`UNIQUE(uid_hash) WHERE revoked_at IS NULL` — **unicité globale** : un badge
physique ne peut être actif que dans une seule organisation.
Index : `(organization_id, employee_id)`.

### `nfc_badge_events`
`id`, `organization_id`, `employee_id`, `badge_id uuid NULL`,
`uid_masked text NOT NULL` (4 derniers caractères seulement),
`event text NOT NULL CHECK (event IN ('assigned','revoked','reassigned','scan_rejected'))`,
`reason text`, `actor_user_id uuid NULL`, `ip inet NULL`.

### `time_logs`
| Colonne | Type | Notes |
|---|---|---|
| `id`, `organization_id`, `employee_id` | uuid NOT NULL | |
| `type` | `punch_type NOT NULL` | |
| `punched_at` | `timestamptz NOT NULL` | horodatage réel |
| `recorded_at` | `timestamptz NOT NULL DEFAULT now()` | réception serveur |
| `source` | `punch_source NOT NULL` | |
| `work_zone_id` | uuid NULL | zone reconnue |
| `latitude`, `longitude` | `double precision NULL` | |
| `accuracy_meters` | `numeric(7,2) NULL` | |
| `distance_meters` | `numeric(9,2) NULL` | distance au centre de zone |
| `is_within_zone` | `bool NOT NULL DEFAULT false` | |
| `device_id` | `text NULL` | identifiant d'appareil mobile |
| `client_punch_id` | `uuid NULL` | idempotence hors-ligne |
| `notes` | `text NULL` | |

`UNIQUE(employee_id, client_punch_id) WHERE client_punch_id IS NOT NULL`.
Index : `(organization_id, punched_at DESC)`, `(employee_id, punched_at DESC)`.
**Table partitionnée par mois** sur `punched_at` (voir 09 §4).

### `attendance_days` (agrégat quotidien, matérialisé par job)
`id`, `organization_id`, `employee_id`, `day date NOT NULL`,
`first_in timestamptz`, `last_out timestamptz`, `worked_minutes int NOT NULL DEFAULT 0`,
`punch_count int NOT NULL DEFAULT 0`, `is_complete bool NOT NULL DEFAULT false`,
`anomaly text NULL` (`missing_out`, `out_of_zone`, `duplicate`).
`UNIQUE(employee_id, day)`. Alimente les tableaux de bord sans scanner `time_logs`.

## 6. Congés

### `leave_requests`
`id`, `organization_id`, `employee_id NOT NULL`, `type leave_type NOT NULL`,
`start_date date NOT NULL`, `end_date date NOT NULL`,
`requested_days numeric(5,2) NOT NULL CHECK (requested_days > 0)`,
`half_day_start bool NOT NULL DEFAULT false`, `half_day_end bool NOT NULL DEFAULT false`,
`status leave_status NOT NULL DEFAULT 'pending'`, `reason text NULL`,
`decision_comment text NULL`, `decided_by uuid NULL`, `decided_at timestamptz NULL`,
`balance_applied bool NOT NULL DEFAULT false`, `attachment_path text NULL`.
Contraintes : `end_date >= start_date`.
Chevauchement interdit : index d'exclusion GiST
`EXCLUDE USING gist (employee_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
 WHERE (status IN ('pending','approved'))`.
Index : `(organization_id, status, start_date DESC)`.

### `leave_balances`
`id`, `organization_id`, `employee_id`, `year int NOT NULL`,
`leave_type leave_type NOT NULL`, `entitled_days numeric(6,2) NOT NULL DEFAULT 0`,
`carried_over_days numeric(6,2) NOT NULL DEFAULT 0`,
`taken_days numeric(6,2) NOT NULL DEFAULT 0`,
`pending_days numeric(6,2) NOT NULL DEFAULT 0`.
`UNIQUE(employee_id, year, leave_type)`. Le solde affiché =
`entitled + carried_over − taken − pending` (peut être négatif, voir 07 §3.4).

### `leave_balance_ledger`
Journal immuable de tout mouvement de solde : `id`, `organization_id`,
`employee_id`, `leave_request_id NULL`, `year`, `leave_type`,
`delta_days numeric(6,2) NOT NULL`, `reason text NOT NULL`, `actor_user_id`.
Aucune mise à jour ni suppression : uniquement des insertions.

### `public_holidays`
`id`, `organization_id`, `name text NOT NULL`, `date date NOT NULL`,
`is_movable bool NOT NULL DEFAULT false`, `is_recurring bool NOT NULL DEFAULT false`.
`UNIQUE(organization_id, date)`.

### `work_schedules`
`id`, `organization_id`, `name`, `is_default bool`,
`weekly_pattern jsonb NOT NULL` (ex. `{"mon":{"start":"08:00","end":"17:00"},…}`),
`employee_id uuid NULL` (null = modèle d'organisation). Sert au calcul des jours
ouvrés et des anomalies de pointage.

## 7. Recrutement

### `jobs`
`id`, `organization_id`, `title text NOT NULL`, `slug text NOT NULL`,
`department_id uuid NULL`, `location text NULL`, `contract_type contract_type NOT NULL`,
`description text`, `requirements text`, `status job_status NOT NULL DEFAULT 'draft'`,
`published_at timestamptz NULL`, `deadline timestamptz NULL`,
`required_documents jsonb NOT NULL DEFAULT '[]'`, `inclusive_score smallint NULL`,
`views_count int NOT NULL DEFAULT 0`, `deleted_at`.
`UNIQUE(organization_id, slug)`. Index `(organization_id, status, published_at DESC)`.

### `candidates`
`id`, `organization_id`, `job_id NOT NULL`, `full_name text NOT NULL`,
`email citext NULL`, `phone text NULL` (format guinéen normalisé `NNN NN NN NN`,
12 caractères, cf. 06 §11), `stage candidate_stage NOT NULL DEFAULT 'new'`,
`source text NULL` (`careers`, `referral`, `import`, `social`),
`cv_path text NULL`, `cover_letter_path text NULL`, `documents jsonb NOT NULL DEFAULT '{}'`,
`cv_text text NULL`, `ai_score smallint NULL CHECK (ai_score BETWEEN 0 AND 100)`,
`ai_justification text NULL`, `ai_strengths jsonb NOT NULL DEFAULT '[]'`,
`ai_weaknesses jsonb NOT NULL DEFAULT '[]'`, `ai_scored_at timestamptz NULL`,
`ai_candidate_name text NULL` (nom détecté dans le CV, sert de contrôle de
cohérence avec `full_name`), `ai_is_valid_cv boolean NULL` (document jugé
exploitable), `ai_fraud_alert boolean NULL` (suspicion à vérifier humainement),
`rejected_reason text NULL`, `hired_employee_id uuid NULL`.
`UNIQUE(job_id, lower(email)) WHERE email IS NOT NULL` (anti-doublon).
Index `(organization_id, job_id, stage)`.

Les chemins de documents sont **privés** ; l'API ne renvoie que des URLs signées
à durée limitée (voir 08 §6).

### `candidate_notes`
`id`, `organization_id`, `candidate_id`, `author_id uuid NULL`, `body text NOT NULL`,
`deleted_at`.

### `candidate_events`
`id`, `organization_id`, `candidate_id`, `actor_id uuid NULL`,
`type candidate_event_type NOT NULL`, `payload jsonb NOT NULL DEFAULT '{}'`.
Table en insertion seule.

### `recruitment_webhook_configs`
`organization_id uuid PK`, `test_webhook_url text NULL`, `prod_webhook_url text NULL`,
`active_env text NOT NULL DEFAULT 'off' CHECK (active_env IN ('off','test','prod'))`,
`secret_encrypted text NULL` (secret HMAC pour signer les appels sortants),
`updated_by`.

## 8. Performance et talents

### `performance_cycles`
`id`, `organization_id`, `name`, `frequency perf_cycle_frequency NOT NULL`,
`period_start date NOT NULL`, `period_end date NOT NULL`,
`self_eval_opens_at timestamptz NULL`, `self_eval_closes_at timestamptz NULL`,
`status perf_cycle_status NOT NULL DEFAULT 'draft'`.

### `performance_plans`
`id`, `organization_id`, `name`, `period_start date NOT NULL`,
`period_end date NOT NULL`, `status perf_plan_status NOT NULL DEFAULT 'draft'`.

### `goals`
`id`, `organization_id`, `plan_id uuid NULL`, `review_id uuid NULL`,
`employee_id uuid NULL` (porteur), `owner_id uuid NULL` (propriétaire déclaré),
`parent_goal_id uuid NULL`, `title text NOT NULL`, `description text`,
`measurement text`, `category goal_category NOT NULL DEFAULT 'business'`,
`weight smallint NOT NULL DEFAULT 0 CHECK (weight BETWEEN 0 AND 100)`,
`progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100)`,
`status goal_status NOT NULL DEFAULT 'not_started'`,
`start_date date NULL`, `due_date date NULL`.
Contrainte applicative : la somme des `weight` d'un employé sur un plan ≤ 100.

### `goal_activities`
`id`, `organization_id`, `goal_id NOT NULL`, `employee_id uuid NULL`,
`title text NOT NULL`, `description text`, `status goal_activity_status NOT NULL DEFAULT 'planned'`,
`planned_date date NULL`, `completed_at timestamptz NULL`.

### `okrs`
`id`, `organization_id`, `employee_id uuid NULL`, `quarter text NOT NULL` (`2026-Q3`),
`objective text NOT NULL`, `status okr_status NOT NULL DEFAULT 'draft'`,
`review_status okr_review_status NOT NULL DEFAULT 'draft'`,
`progress smallint NOT NULL DEFAULT 0`, `submitted_at`, `validated_at`,
`validated_by uuid NULL`, `manager_comment text NULL`.

### `okr_key_results` *(remplace le `jsonb key_results`)*
`id`, `organization_id`, `okr_id NOT NULL`, `position smallint NOT NULL`,
`title text NOT NULL`, `metric text NULL`,
`target_value numeric(14,2) NULL`, `current_value numeric(14,2) NULL`,
`unit text NULL`, `is_done bool NOT NULL DEFAULT false`, `done_at timestamptz NULL`.
`UNIQUE(okr_id, position)`.
`okrs.progress` = `round(100 * count(is_done) / count(*))`, recalculé par trigger.

### `okr_checkins`
`id`, `organization_id`, `okr_id NOT NULL`, `author_employee_id uuid NULL`,
`message text NOT NULL`, `progress_snapshot smallint NOT NULL`.

### `performance_reviews`
`id`, `organization_id`, `cycle_id uuid NULL`, `plan_id uuid NULL`,
`employee_id NOT NULL`, `manager_id uuid NULL`,
`status perf_review_status NOT NULL DEFAULT 'not_started'`,
`self_score smallint NULL CHECK (self_score BETWEEN 1 AND 5)`,
`self_global_comment text NULL`, `submitted_at timestamptz NULL`,
`manager_score smallint NULL CHECK (manager_score BETWEEN 1 AND 5)`,
`manager_global_comment text NULL`, `manager_submitted_at timestamptz NULL`,
`sent_back_at timestamptz NULL`, `sent_back_comment text NULL`,
`validated_at timestamptz NULL`, `validated_by uuid NULL`,
`signed_at timestamptz NULL`, `signed_by uuid NULL`,
`performance_score smallint NULL`, `potential_score smallint NULL`,
`ai_summary text NULL`.
`UNIQUE(cycle_id, employee_id) WHERE cycle_id IS NOT NULL`.

### `review_goal_comments`
`id`, `organization_id`, `review_id NOT NULL`, `goal_id NOT NULL`,
`self_comment text NULL`, `self_rating smallint NULL`,
`manager_comment text NULL`, `manager_rating smallint NULL`.
`UNIQUE(review_id, goal_id)`.

### `feedbacks`
`id`, `organization_id`, `from_employee_id uuid NULL`, `to_employee_id NOT NULL`,
`kind feedback_kind NOT NULL`, `message text NOT NULL`,
`okr_id uuid NULL`, `goal_id uuid NULL`, `is_private bool NOT NULL DEFAULT false`,
`visible_to_manager bool NOT NULL DEFAULT true`.

### `achievements`
`id`, `organization_id`, `employee_id uuid NULL`, `goal_id uuid NULL`,
`title text NOT NULL`, `description text`, `impact text`,
`achieved_at timestamptz NOT NULL`.

### `succession_plans`
`id`, `organization_id`, `position_title text NOT NULL`,
`current_employee_id uuid NULL`, `successor_employee_id uuid NULL`,
`readiness text NULL` (`ready_now`, `1_2_years`, `3_plus_years`), `notes text`.

## 9. Facturation

### `plans` *(catalogue global, hors tenant)*
`id`, `code text NOT NULL UNIQUE`, `name text NOT NULL`,
`price_gnf numeric(14,2) NOT NULL`, `price_yearly_gnf numeric(14,2) NULL`,
`max_employees int NOT NULL`, `ai_credits_per_month int NOT NULL DEFAULT 0`,
`modules jsonb NOT NULL DEFAULT '[]'`, `features jsonb NOT NULL DEFAULT '[]'`,
`sort_order int NOT NULL DEFAULT 0`, `is_public bool NOT NULL DEFAULT true`,
`deleted_at`.

### `subscriptions`
`id`, `organization_id NOT NULL`, `plan_id NOT NULL`,
`status subscription_status NOT NULL DEFAULT 'trialing'`,
`cycle billing_cycle NOT NULL DEFAULT 'monthly'`,
`trial_ends_at timestamptz NULL`, `current_period_start timestamptz NOT NULL`,
`current_period_end timestamptz NOT NULL`, `canceled_at timestamptz NULL`,
`cancel_at_period_end bool NOT NULL DEFAULT false`,
`max_employees_override int NULL`, `modules_override jsonb NULL`.
Index partiel unique : une seule souscription non terminale par organisation.
`current_period_end` fait autorité pour l'accès (voir 07 §6).

### `payments`
`id`, `organization_id uuid NULL` (null si paiement avant création de compte),
`subscription_id uuid NULL`, `plan_id NOT NULL`, `cycle billing_cycle NOT NULL`,
`merchant_reference uuid NOT NULL UNIQUE`, `provider text NOT NULL DEFAULT 'djomy'`,
`provider_transaction_id text NULL UNIQUE`,
`expected_amount numeric(14,2) NOT NULL`, `paid_amount numeric(14,2) NULL`,
`currency char(3) NOT NULL DEFAULT 'GNF'`,
`status payment_status NOT NULL DEFAULT 'pending'`,
`method payment_method NULL`, `payer_phone text NULL`,
`claim_token_hash text NULL UNIQUE`, `claim_email citext NULL`,
`claim_expires_at timestamptz NULL`, `claimed_at timestamptz NULL`,
`failure_reason text NULL`, `raw_event jsonb NULL`.
Index `(organization_id, created_at DESC)`, `(status, created_at)`.

### `invoices`
`id`, `organization_id`, `subscription_id`, `payment_id uuid NULL`,
`number text NOT NULL UNIQUE` (`KNK-2026-000123`),
`amount numeric(14,2) NOT NULL`, `currency`, `issued_at`, `period_start`,
`period_end`, `pdf_path text NULL`.

### `usage_counters`
`id`, `organization_id`, `period text NOT NULL` (`2026-09`),
`metric text NOT NULL` (`ai_credits`, `active_employees`, `sms`),
`used int NOT NULL DEFAULT 0`, `limit_value int NULL`.
`UNIQUE(organization_id, period, metric)`.

## 10. Transverse et plateforme

### `notifications`
`id`, `organization_id`, `user_id NOT NULL`, `type text NOT NULL`,
`title text NOT NULL`, `body text NULL`, `link text NULL`,
`payload jsonb NOT NULL DEFAULT '{}'`, `read_at timestamptz NULL`.
Index `(user_id, read_at, created_at DESC)`. Rétention 180 jours.

### `audit_logs`
`id`, `organization_id uuid NULL`, `actor_user_id uuid NULL`, `actor_email text NULL`,
`actor_role text NULL`, `action text NOT NULL` (`employee.updated`),
`target_type text NULL`, `target_id text NULL`,
`before_data jsonb NULL`, `after_data jsonb NULL`,
`ip inet NULL`, `user_agent text NULL`, `request_id uuid NULL`.
Insertion seule, aucune UPDATE/DELETE (révoquées au niveau des droits SQL).
Partitionnée par mois. Rétention 24 mois puis archivage froid.

### `usage_events`
`id`, `organization_id`, `user_id uuid NULL`, `kind text NOT NULL`,
`module text NULL`, `path text NULL`, `metadata jsonb NOT NULL DEFAULT '{}'`.
Écriture asynchrone (file), jamais bloquante.

### `system_logs`
`id`, `channel text NOT NULL`, `level text NOT NULL`, `message text NOT NULL`,
`organization_id uuid NULL`, `context jsonb NOT NULL DEFAULT '{}'`,
`status_code int NULL`, `duration_ms int NULL`. Rétention 30 jours.

### `platform_admins`
`id`, `user_id uuid NOT NULL UNIQUE`, `level platform_admin_level NOT NULL DEFAULT 'support'`,
`is_active bool NOT NULL DEFAULT true`, `created_by uuid NULL`.

### `platform_settings`
`key text PK`, `value jsonb NOT NULL`, `description text NULL`,
`is_secret bool NOT NULL DEFAULT false`, `updated_by uuid NULL`.

### `demo_requests`
`id`, `full_name`, `email citext NOT NULL`, `phone text NOT NULL`,
`company_name text NOT NULL`, `company_size text NOT NULL`, `message text NULL`,
`status demo_request_status NOT NULL DEFAULT 'new'`,
`email_status email_delivery_status NOT NULL DEFAULT 'pending'`,
`email_sent_at timestamptz NULL`, `email_error text NULL`,
`source_ip inet NULL`, `assigned_to uuid NULL`. Hors tenant.

### `webhook_receipts`
`id`, `provider text NOT NULL`, `event_id text NOT NULL`,
`signature_valid bool NOT NULL`, `payload jsonb NOT NULL`,
`processed_at timestamptz NULL`, `error text NULL`.
`UNIQUE(provider, event_id)` — garantit l'anti-rejeu.

### `social_accounts` / `social_posts`
- `social_accounts` : `id`, `organization_id`, `provider social_provider NOT NULL`,
  `account_id text NOT NULL`, `account_name text NOT NULL`,
  `access_token_encrypted text NOT NULL`, `refresh_token_encrypted text NULL`,
  `token_expires_at`, `scopes text[] NOT NULL DEFAULT '{}'`,
  `status social_account_status NOT NULL DEFAULT 'active'`, `connected_by`,
  `metadata jsonb`. `UNIQUE(organization_id, provider, account_id)`.
  Les tokens sont chiffrés via `encryption` Adonis (`APP_KEY`), jamais renvoyés.
- `social_posts` : `id`, `organization_id`, `job_id`, `social_account_id`,
  `provider`, `content text NOT NULL`, `media_urls jsonb NOT NULL DEFAULT '[]'`,
  `status social_post_status NOT NULL DEFAULT 'pending'`,
  `external_post_id`, `external_url`, `error_message`, `published_at`.

### `files`
Registre centralisé des fichiers stockés : `id`, `organization_id uuid NULL`,
`bucket text NOT NULL`, `path text NOT NULL UNIQUE`, `mime text NOT NULL`,
`size_bytes bigint NOT NULL`, `checksum_sha256 text NOT NULL`,
`owner_type text NOT NULL`, `owner_id uuid NULL`,
`visibility text NOT NULL CHECK (visibility IN ('private','public'))`,
`uploaded_by uuid NULL`, `scanned_at timestamptz NULL`, `scan_result text NULL`.

## 11. `organizations.settings` (schéma du JSON)

```jsonc
{
  "leave": { "annualEntitlementDays": 30, "allowNegativeBalance": true,
             "maxNegativeDays": 5, "countWeekends": false, "countHolidays": false },
  "timeclock": { "defaultRadiusMeters": 150, "requireZone": true,
                 "allowManualPunch": true, "maxAccuracyMeters": 100,
                 "duplicateWindowSeconds": 120 },
  "performance": { "ratingScale": 5, "requireSignature": true },
  "recruitment": { "autoScore": true, "notifyOnApplication": true },
  "branding": { "primaryColor": "#0F7A5A" }
}
```
Toute clé absente prend la valeur par défaut définie dans `config/tenant.ts`.
Le JSON est validé par un schéma VineJS à chaque écriture.

## 12. Écarts assumés avec le schéma Supabase actuel

| Existant | Nouveau | Raison |
|---|---|---|
| UID NFC dans `employees` | table `nfc_badges` + `nfc_badge_events` | historique, unicité globale, masquage |
| `okrs.key_results` en `jsonb` | table `okr_key_results` | requêtable, progression fiable par trigger |
| `plan` enum + `plan_id` sur `organizations` | table `subscriptions` | historique d'abonnement, cycles, essais |
| `subscription_payments` | `payments` + `invoices` | séparation paiement / facture |
| `reviews` **et** `performance_reviews` | `performance_reviews` seule | doublon fonctionnel supprimé |
| `organization_members` + `user_roles` | `user_roles` seule | l'appartenance découle du rôle |
| `profiles` séparée de l'utilisateur Supabase | fusionnée dans `users` | plus d'auth externe |
| `billing_audit_log`, `audit_log`, `system_log` | `audit_logs` + `system_logs` | un seul journal métier, un seul technique |
| Solde de congés scalaire | `leave_balances` + `leave_balance_ledger` | traçabilité, multi-type, multi-année |
| Aucun agrégat de pointage | `attendance_days` | tableaux de bord à coût constant |
| `contract_type` valeur `Journalier` | `daily` | cohérence de casse et de langue |
| `leave_type` en français | anglais + i18n | cohérence code/DB |
| Pas de partitionnement | `time_logs`, `audit_logs` partitionnées | volumétrie B2B |

## 13. Extensions PostgreSQL requises

```sql
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

## Compléments issus de l'existant
- `organizations.default_currency` et `contracts.currency` : défaut `'GNF'`.
- `organizations.performance_model` : défaut `'sap'`.
- `candidates` : colonnes IA `ai_score` (0–100), `ai_is_valid_cv`, `ai_strengths` (text[]), `ai_weaknesses` (text[]), `ai_summary`, `ai_fraud_alert`, `cv_path` ; index unique logique (job, e-mail normalisé) et (job, téléphone).
- `employees.leave_balance` numeric(6,2).
- `platform_settings(key, value)` dont `modules_open_for_testing`.
- Inventaire complet : `15-inventaire-supabase.md`.
