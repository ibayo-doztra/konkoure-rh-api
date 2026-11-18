# 03 — Migrations Lucid, modèles, seeders, factories

## 1. Ordre des migrations

Les fichiers sont horodatés dans cet ordre strict (dépendances de clés
étrangères) :

```text
0001_extensions
0002_enums
0003_functions_triggers          -- set_updated_at(), okr_progress()
0004_tenant_rls                  -- rôles konkoure_app/worker, current_org_id(), enable_tenant_rls()
0010_users
0011_auth_access_tokens
0012_auth_refresh_tokens
0013_password_reset_tokens
0020_organizations
0021_user_roles
0022_invitations
0030_departments
0031_employees                    -- FK department_id ajoutée ici
0032_departments_manager_fk       -- FK circulaire ajoutée après employees
0033_contracts
0034_skills
0035_employee_skills
0040_work_zones
0041_nfc_badges
0042_nfc_badge_events
0043_time_logs                    -- table partitionnée
0044_attendance_days
0050_public_holidays
0051_work_schedules
0052_leave_requests
0053_leave_balances
0054_leave_balance_ledger
0060_jobs
0061_candidates
0062_candidate_notes
0063_candidate_events
0064_recruitment_webhook_configs
0070_performance_cycles
0071_performance_plans
0072_goals
0073_goal_activities
0074_okrs
0075_okr_key_results
0076_okr_checkins
0077_performance_reviews
0078_review_goal_comments
0079_feedbacks
0080_achievements
0081_succession_plans
0090_plans
0091_subscriptions
0092_payments
0093_invoices
0094_usage_counters
0100_notifications
0101_audit_logs                   -- partitionnée
0102_usage_events
0103_system_logs
0104_files
0110_platform_admins
0111_platform_settings
0112_demo_requests
0113_webhook_receipts
0114_tenant_rls_core              -- droits et RLS de user_roles, invitations, audit_logs
0120_social_accounts
0121_social_posts
0130_indexes_extra                -- index trigram, GiST d'exclusion, partiels
0131_partitions_bootstrap         -- partitions des 12 prochains mois
0140_grants_roles                 -- rôles SQL applicatifs et révocations
```

**Règles** : une migration ne modifie jamais une migration déjà déployée ;
toute correction passe par une nouvelle migration ; chaque migration implémente
`up()` **et** `down()` ; aucune donnée métier dans une migration (cela relève des
seeders), sauf données de référence immuables (jours fériés légaux, plans).

## 2. Fonctions et triggers

```sql
-- 0003_functions_triggers
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Appliqué à chaque table possédant updated_at :
-- CREATE TRIGGER trg_<table>_updated BEFORE UPDATE ON <table>
--   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION recompute_okr_progress() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE target uuid; total int; done int;
BEGIN
  target := COALESCE(NEW.okr_id, OLD.okr_id);
  SELECT count(*), count(*) FILTER (WHERE is_done) INTO total, done
    FROM okr_key_results WHERE okr_id = target;
  UPDATE okrs SET progress = CASE WHEN total = 0 THEN 0
                                  ELSE round(100.0 * done / total) END,
                  updated_at = now()
   WHERE id = target;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_okr_progress
AFTER INSERT OR UPDATE OF is_done OR DELETE ON okr_key_results
FOR EACH ROW EXECUTE FUNCTION recompute_okr_progress();
```

Les validations dépendant du temps (`expires_at > now()`) sont faites par
**trigger** ou en applicatif, **jamais par `CHECK`** (contrainte d'immutabilité
Postgres).

## 3. Squelettes de migration

```ts
// database/migrations/0031_employees.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'employees'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id').notNullable()
        .references('id').inTable('organizations').onDelete('CASCADE')
      t.uuid('user_id').nullable()
        .references('id').inTable('users').onDelete('SET NULL')
      t.string('employee_number').nullable()
      t.string('first_name').notNullable()
      t.string('last_name').notNullable()
      t.specificType('email', 'citext').nullable()
      t.string('phone').nullable()
      t.text('photo_url').nullable()
      t.string('job_title').nullable()
      t.uuid('department_id').nullable()
        .references('id').inTable('departments').onDelete('SET NULL')
      t.uuid('manager_id').nullable()
        .references('id').inTable('employees').onDelete('SET NULL')
      t.date('hire_date').nullable()
      t.date('end_date').nullable()
      t.specificType('status', 'employee_status').notNullable().defaultTo('active')
      t.decimal('base_salary', 14, 2).nullable()
      t.specificType('salary_currency', 'char(3)').nullable()
      t.decimal('leave_balance', 6, 2).notNullable().defaultTo(0)
      t.date('birth_date').nullable()
      t.string('gender').nullable()
      t.string('national_id').nullable()
      t.text('passport_document_path').nullable()
      t.jsonb('address').notNullable().defaultTo('{}')
      t.jsonb('emergency_contact').notNullable().defaultTo('{}')
      t.jsonb('profile_details').notNullable().defaultTo('{}')
      t.uuid('created_by').nullable()
      t.uuid('updated_by').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()

      t.unique(['organization_id', 'employee_number'])
      t.index(['organization_id', 'status'])
      t.index(['organization_id', 'department_id'])
      t.index(['organization_id', 'manager_id'])
    })

    this.schema.raw(`ALTER TABLE employees ADD CONSTRAINT employees_manager_not_self
                     CHECK (manager_id IS NULL OR manager_id <> id)`)
    this.schema.raw(`CREATE UNIQUE INDEX employees_org_email_uniq
                     ON employees (organization_id, lower(email))
                     WHERE email IS NOT NULL AND deleted_at IS NULL`)
    this.schema.raw(`CREATE UNIQUE INDEX employees_org_user_uniq
                     ON employees (organization_id, user_id)
                     WHERE user_id IS NOT NULL AND deleted_at IS NULL`)
    this.schema.raw(`CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON employees
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
  }

  async down() { this.schema.dropTable(this.tableName) }
}
```

Table partitionnée (`time_logs`) :

```sql
CREATE TABLE time_logs (
  id uuid NOT NULL,
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  ...
  punched_at timestamptz NOT NULL,
  PRIMARY KEY (id, punched_at)
) PARTITION BY RANGE (punched_at);

CREATE TABLE time_logs_2026_09 PARTITION OF time_logs
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
```
Un job planifié crée les partitions 3 mois à l'avance et détache celles de plus
de 24 mois (voir 08 §2).

Index d'exclusion des congés :

```sql
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_no_overlap
EXCLUDE USING gist (
  employee_id WITH =,
  daterange(start_date, end_date, '[]') WITH &&
) WHERE (status IN ('pending','approved'));
```

## 4. Modèles Lucid

### Base commune

```ts
// app/shared/base/tenant_model.ts
import { BaseModel, beforeCreate, column } from '@adonisjs/lucid/orm'
import { uuidv7 } from 'uuidv7'
import { DateTime } from 'luxon'

export abstract class AppModel extends BaseModel {
  @column({ isPrimary: true }) declare id: string
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
  @column() declare createdBy: string | null
  @column() declare updatedBy: string | null

  @beforeCreate()
  static assignUuid(model: AppModel) { if (!model.id) model.id = uuidv7() }
}

export abstract class TenantModel extends AppModel {
  @column() declare organizationId: string
}
```

### Exemple complet

```ts
// app/models/employee.ts
import { belongsTo, column, computed, hasMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { TenantModel } from '#shared/base/tenant_model'

export default class Employee extends TenantModel {
  static table = 'employees'

  @column() declare userId: string | null
  @column() declare employeeNumber: string | null
  @column() declare firstName: string
  @column() declare lastName: string
  @column() declare email: string | null
  @column() declare phone: string | null
  @column() declare departmentId: string | null
  @column() declare managerId: string | null
  @column.date() declare hireDate: DateTime | null
  @column() declare status: EmployeeStatus

  // Champs sensibles : jamais sérialisés par défaut.
  @column({ serializeAs: null }) declare baseSalary: string | null
  @column({ serializeAs: null }) declare nationalId: string | null
  @column({ serializeAs: null }) declare passportDocumentPath: string | null

  @column.dateTime() declare deletedAt: DateTime | null

  @computed() get fullName() { return `${this.firstName} ${this.lastName}` }

  @belongsTo(() => Department) declare department: BelongsTo<typeof Department>
  @belongsTo(() => Employee, { foreignKey: 'managerId' })
  declare manager: BelongsTo<typeof Employee>
  @hasMany(() => Contract) declare contracts: HasMany<typeof Contract>
  @hasMany(() => LeaveRequest) declare leaveRequests: HasMany<typeof LeaveRequest>
  @hasMany(() => NfcBadge) declare badges: HasMany<typeof NfcBadge>

  /** Scope tenant OBLIGATOIRE sur toute lecture. */
  static forOrg = scope((q, organizationId: string) =>
    q.where('organization_id', organizationId))

  static notDeleted = scope((q) => q.whereNull('deleted_at'))
}
```

**Règle de sérialisation** : tout champ sensible est `serializeAs: null` par
défaut ; son exposition passe par un *serializer* explicite appelé uniquement
quand la policy l'autorise (voir 05 §5).

## 5. Repository de base

```ts
// app/shared/base/tenant_repository.ts
export abstract class TenantRepository<M extends typeof TenantModel> {
  constructor(protected model: M, protected organizationId: string) {}

  protected query() {
    return this.model.query()
      .where('organization_id', this.organizationId)
      .if('deletedAt' in this.model.prototype, (q) => q.whereNull('deleted_at'))
  }

  async findOrFail(id: string) {
    const row = await this.query().where('id', id).first()
    if (!row) throw new NotFoundException()   // → 404, jamais 403
    return row
  }
}
```

Un repository **ne peut pas** être instancié sans `organizationId`. Les rares
requêtes hors tenant (plateforme) passent par un `PlatformRepository` distinct,
annoté et couvert par le middleware `platform_admin`.

## 6. Seeders

| Seeder | Contenu | Environnements |
|---|---|---|
| `01_plans_seeder` | `free` (essai 30 j), `starter`, `pro`, `enterprise` avec prix GNF, `max_employees`, modules | tous |
| `02_platform_settings_seeder` | clés par défaut (`support_email`, `trial_days`, `signup_open`, `maintenance_mode`) | tous |
| `03_guinea_holidays_seeder` | jours fériés légaux guinéens (référence à cloner par organisation) | tous |
| `04_demo_org_seeder` | organisation de démonstration, 25 employés, 3 départements, zones, congés, OKR | dev/test uniquement |
| `05_root_admin_seeder` | premier `platform_admin` `root` à partir de `ROOT_ADMIN_EMAIL` | tous |

Contenu de `01_plans_seeder` (modules par plan, aligné sur 07 §6) :

```ts
const PLANS = [
  { code: 'free',      name: 'Gratuit',    priceGnf: 0,        maxEmployees: 10,
    modules: ['hr','timeclock','leaves','performance','settings'], aiCreditsPerMonth: 20 },
  { code: 'starter',   name: 'Starter',    priceGnf: 490000,   maxEmployees: 50,
    modules: ['hr','timeclock','leaves','performance','settings'], aiCreditsPerMonth: 100 },
  { code: 'pro',       name: 'Pro',        priceGnf: 1490000,  maxEmployees: 250,
    modules: ['hr','timeclock','leaves','performance','recruitment','talents','settings','integrations'],
    aiCreditsPerMonth: 500 },
  { code: 'enterprise',name: 'Entreprise', priceGnf: 3900000,  maxEmployees: 100000,
    modules: ['hr','timeclock','leaves','performance','recruitment','talents','settings','integrations','api'],
    aiCreditsPerMonth: 5000 },
]
```

## 7. Factories

Une factory par modèle, dans `database/factories/`, avec états nommés :

```ts
export const EmployeeFactory = factory
  .define(Employee, ({ faker }) => ({
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    status: 'active',
  }))
  .state('terminated', (e) => { e.status = 'terminated' })
  .state('manager', (e) => { e.jobTitle = 'Responsable' })
  .relation('contracts', () => ContractFactory)
  .build()
```

Toute factory de modèle tenant exige un `organizationId` explicite : aucune
factory ne crée d'organisation implicite.

## 8. Rôles SQL applicatifs (`0004`, `0114`, `0140_grants_roles`)

`konkoure_app` et `konkoure_worker` sont créés par `0004`, avec des privilèges par
défaut sur les nouvelles tables et séquences. Chaque table tenant appelle
`SELECT enable_tenant_rls('<table>')` dans sa migration. Si le rôle migrateur n'a ni
`CREATEROLE` ni `BYPASSRLS`, ces rôles doivent exister avant. `0140` reste à écrire
pour `konkoure_readonly` et les révocations des tables à venir.

```sql
-- Rôle applicatif : ni superuser, ni owner des tables
CREATE ROLE konkoure_app LOGIN;
GRANT USAGE ON SCHEMA public TO konkoure_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO konkoure_app;

-- Journaux : insertion seule
REVOKE UPDATE, DELETE ON audit_logs, usage_events, candidate_events,
                          leave_balance_ledger, nfc_badge_events FROM konkoure_app;

-- Rôle lecture seule pour la BI / le support
CREATE ROLE konkoure_readonly LOGIN;
GRANT USAGE ON SCHEMA public TO konkoure_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO konkoure_readonly;
REVOKE SELECT ON users, auth_access_tokens, auth_refresh_tokens,
                 social_accounts, payments FROM konkoure_readonly;
```

Les migrations tournent avec un rôle propriétaire distinct (`konkoure_migrator`),
jamais avec `konkoure_app`.
