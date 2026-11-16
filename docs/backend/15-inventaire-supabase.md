# Inventaire du backend Supabase actuel et destination AdonisJS

Généré depuis `supabase/migrations/` (112 fichiers). Sert de check-list : chaque élément doit avoir un équivalent ou être explicitement abandonné.

## Tables
| Table | Politiques RLS | Triggers | Destination AdonisJS |
|---|---|---|---|
| `achievements` | 6 | achievements_require_employee_trg, achievements_set_updated_at | modèle `Achievement` + policy Bouncer + scope `organization_id` |
| `audit_log` | 0 | — | modèle `AuditLog` + policy Bouncer + scope `organization_id` |
| `billing_audit_log` | 0 | — | modèle `BillingAuditLog` + policy Bouncer + scope `organization_id` |
| `candidate_activities` | 7 | candidate_activities_validate_trg | modèle `CandidateActivitie` + policy Bouncer + scope `organization_id` |
| `candidate_notes` | 5 | — | modèle `CandidateNote` + policy Bouncer + scope `organization_id` |
| `candidates` | 6 | — | modèle `Candidate` + policy Bouncer + scope `organization_id` |
| `contracts` | 4 | trg_contracts_updated_at | modèle `Contract` + policy Bouncer + scope `organization_id` |
| `demo_requests` | 1 | demo_requests_set_updated_at | modèle `DemoRequest` + policy Bouncer + scope `organization_id` |
| `departments` | 2 | trg_departments_updated_at | modèle `Department` + policy Bouncer + scope `organization_id` |
| `employee_skills` | 2 | — | modèle `EmployeeSkill` + policy Bouncer + scope `organization_id` |
| `employees` | 5 | employees_badge_audit_trg, employees_enforce_plan_quota, employees_guard_insert_sensitive, trg_employees_guard_org_assignment, trg_employees_updated_at | modèle `Employee` + policy Bouncer + scope `organization_id` |
| `feedbacks` | 2 | — | modèle `Feedback` + policy Bouncer + scope `organization_id` |
| `goal_activities` | 6 | goal_activities_require_employee_trg, goal_activities_set_updated_at | modèle `GoalActivitie` + policy Bouncer + scope `organization_id` |
| `goals` | 6 | goals_require_owner_trg, goals_set_updated_at | modèle `Goal` + policy Bouncer + scope `organization_id` |
| `jobs` | 4 | — | modèle `Job` + policy Bouncer + scope `organization_id` |
| `leave_requests` | 4 | leave_requests_after_insert_balance, leave_requests_before_delete_balance, leave_requests_guard, leave_requests_set_updated_at, leave_requests_validate_org | modèle `LeaveRequest` + policy Bouncer + scope `organization_id` |
| `nfc_badge_history` | 2 | — | modèle `NfcBadgeHistory` + policy Bouncer + scope `organization_id` |
| `notifications` | 5 | — | modèle `Notification` + policy Bouncer + scope `organization_id` |
| `okr_checkins` | 5 | okr_checkins_set_updated_at | modèle `OkrCheckin` + policy Bouncer + scope `organization_id` |
| `okrs` | 2 | okrs_require_employee_trg | modèle `Okr` + policy Bouncer + scope `organization_id` |
| `organization_members` | 4 | — | modèle `OrganizationMember` + policy Bouncer + scope `organization_id` |
| `organizations` | 6 | organizations_guard_subscription, organizations_seed_holidays_trg | modèle `Organization` + policy Bouncer + scope `organization_id` |
| `performance_cycles` | 4 | perf_cycles_updated_at | modèle `PerformanceCycle` + policy Bouncer + scope `organization_id` |
| `performance_plans` | 4 | trg_perf_plans_updated_at | modèle `PerformancePlan` + policy Bouncer + scope `organization_id` |
| `performance_reviews` | 8 | perf_reviews_updated_at, performance_reviews_guard_manager_fields, reviews_require_plan_or_cycle_trg | modèle `PerformanceReview` + policy Bouncer + scope `organization_id` |
| `plans` | 2 | plans_set_updated_at | modèle `Plan` + policy Bouncer + scope `organization_id` |
| `platform_admins` | 0 | platform_admins_set_updated_at | modèle `PlatformAdmin` + policy Bouncer + scope `organization_id` |
| `platform_settings` | 0 | platform_settings_set_updated_at | modèle `PlatformSetting` + policy Bouncer + scope `organization_id` |
| `prepaid_email_codes` | 0 | — | modèle `PrepaidEmailCode` + policy Bouncer + scope `organization_id` |
| `profiles` | 3 | — | modèle `Profile` + policy Bouncer + scope `organization_id` |
| `public_holidays` | 4 | public_holidays_set_updated_at | modèle `PublicHoliday` + policy Bouncer + scope `organization_id` |
| `recruitment_webhook_configs` | 3 | trg_recruitment_webhook_configs_updated_at | modèle `RecruitmentWebhookConfig` + policy Bouncer + scope `organization_id` |
| `review_goal_comments` | 7 | rgc_updated_at | modèle `ReviewGoalComment` + policy Bouncer + scope `organization_id` |
| `reviews` | 3 | reviews_guard_manager_fields | modèle `Review` + policy Bouncer + scope `organization_id` |
| `skills` | 2 | — | modèle `Skill` + policy Bouncer + scope `organization_id` |
| `social_accounts` | 7 | social_accounts_scrub_metadata_trg | modèle `SocialAccount` + policy Bouncer + scope `organization_id` |
| `social_posts` | 6 | — | modèle `SocialPost` + policy Bouncer + scope `organization_id` |
| `subscription_payments` | 1 | subscription_payments_set_updated_at | modèle `SubscriptionPayment` + policy Bouncer + scope `organization_id` |
| `succession_plans` | 2 | — | modèle `SuccessionPlan` + policy Bouncer + scope `organization_id` |
| `system_log` | 0 | — | modèle `SystemLog` + policy Bouncer + scope `organization_id` |
| `time_logs` | 3 | — | modèle `TimeLog` + policy Bouncer + scope `organization_id` |
| `usage_events` | 0 | — | modèle `UsageEvent` + policy Bouncer + scope `organization_id` |
| `user_roles` | 4 | — | modèle `UserRole` + policy Bouncer + scope `organization_id` |
| `webhook_events` | 0 | — | modèle `WebhookEvent` + policy Bouncer + scope `organization_id` |
| `work_zones` | 2 | — | modèle `WorkZone` + policy Bouncer + scope `organization_id` |

## Fonctions SQL → service AdonisJS
| Fonction | Rôle actuel | Destination |
|---|---|---|
| `private.has_role` | rôle utilisateur | Bouncer policy / helper `AuthorizationService` |
| `private.is_employee_manager` | manager de l'employé | Bouncer policy / helper `AuthorizationService` |
| `private.is_in_my_subtree` | sous-arbre manager | Bouncer policy / helper `AuthorizationService` |
| `private.is_org_admin` | owner/hr_admin | Bouncer policy / helper `AuthorizationService` |
| `private.is_org_member` | appartenance org | Bouncer policy / helper `AuthorizationService` |
| `private.is_platform_admin` | super-admin | Bouncer policy / helper `AuthorizationService` |
| `private.is_recruitment_staff` | accès recrutement | Bouncer policy / helper `AuthorizationService` |
| `private.is_self_employee` | employé lui-même | Bouncer policy / helper `AuthorizationService` |
| `private.org_has_module` | droit module par offre | Bouncer policy / helper `AuthorizationService` |
| `public._leave_balance_adjust` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.accrue_monthly_leave` | acquisition mensuelle | job BullMQ planifié |
| `public.achievements_require_employee` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.admin_assign_employee_badge` | attribution badge auditée | service de domaine (transaction + audit) |
| `public.admin_revoke_employee_badge` | révocation badge | service de domaine (transaction + audit) |
| `public.candidate_activities_validate` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.compute_working_days` | jours ouvrés | service de domaine (transaction + audit) |
| `public.employees_badge_audit` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.employees_enforce_plan_quota` | quota employés | service de domaine (transaction + audit) |
| `public.employees_guard_insert_sensitive` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.employees_guard_org_assignment` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.get_employee_leave_balance` | solde de congé | service de domaine (transaction + audit) |
| `public.get_employee_sensitive` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.get_public_organization` | page carrières | service de domaine (transaction + audit) |
| `public.get_social_account_token` | jeton réseau social | service de domaine (transaction + audit) |
| `public.goal_activities_require_employee` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.goals_require_owner` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.handle_new_user` | création profil à l'inscription | service de domaine (transaction + audit) |
| `public.has_role` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.is_org_admin` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.is_org_member` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.leave_requests_after_insert_balance` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.leave_requests_before_delete_balance` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.leave_requests_guard_status` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.leave_requests_validate` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.list_public_organization_slugs` | sitemap | service de domaine (transaction + audit) |
| `public.okrs_require_employee` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.organizations_guard_subscription_columns` | protection abonnement | service de domaine (transaction + audit) |
| `public.organizations_seed_holidays` | fériés initiaux | service de domaine (transaction + audit) |
| `public.performance_reviews_guard_manager_fields` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.record_punch` | pointage | service de domaine (transaction + audit) |
| `public.resolve_nfc_badge` | résolution badge | service de domaine (transaction + audit) |
| `public.reviews_guard_manager_fields` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.reviews_require_plan_or_cycle` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.seed_fixed_holidays_for_org` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.seed_movable_holidays_for_org` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.set_leave_request_status` | décision congé | service de domaine (transaction + audit) |
| `public.set_updated_at` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.social_accounts_scrub_metadata` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.update_employee_profile_details` | garde / validation / déclencheur | service de domaine (transaction + audit) |
| `public.verify_cron_token` | protection cron | service de domaine (transaction + audit) |

## Types énumérés
Reprendre tels quels (enum PostgreSQL ou contrainte `CHECK`) :

- `app_role` : 'owner', 'hr_admin', 'manager', 'employee', 'recruiter'
- `candidate_activity_type` : 'created', 'stage_changed', 'scored', 'note_added', 'note_deleted'
- `candidate_stage` : 'new', 'screening', 'interview', 'offer', 'hired', 'rejected'
- `contract_status` : 'draft', 'active', 'terminated'
- `contract_type` : 'cdi', 'cdd', 'stage', 'freelance', 'apprenticeship'
- `employee_status` : 'active', 'on_leave', 'terminated'
- `feedback_kind` : 'kudos', 'suggestion', 'concern'
- `goal_activity_status` : 'planned', 'in_progress', 'done'
- `goal_category` : 'business', 'development', 'behavioral'
- `goal_status` : 'active', 'achieved', 'cancelled'
- `job_status` : 'draft', 'published', 'closed'
- `leave_status` : 'pending','approved','rejected','cancelled'
- `leave_type` : 'annuel','maladie','maternite','sans_solde'
- `okr_review_status` : 'draft','pending','validated','needs_revision'
- `okr_status` : 'draft', 'active', 'completed', 'archived'
- `perf_cycle_frequency` : 'annual','semestrial','quarterly','custom'
- `perf_cycle_status` : 'draft','open','closed'
- `perf_plan_status` : 'draft', 'active', 'closed'
- `perf_review_status` : 'not_started','in_progress','submitted'
- `performance_model` : 'classic', 'sap'
- `plan_type` : 'trial', 'starter', 'pro', 'enterprise'
- `punch_type` : 'ARRIVEE', 'DEPART'
- `review_status` : 'draft', 'self_done', 'manager_done', 'finalized'
- `social_account_status` : 'active', 'expired', 'revoked'
- `social_post_status` : 'pending', 'published', 'failed'
- `social_provider` : 'facebook', 'linkedin', 'twitter'
- `timelog_status` : 'pending', 'approved', 'rejected'

## Stockage
| Bucket | Usage | Destination |
|---|---|---|
| `applications` | CV et pièces de candidature, privé, 2 Mo | S3 privé, URLs signées courtes, chemin construit par le serveur |
| `avatars` | photos employés, membres de l'org | S3 privé, URL signée |
| logos d'organisation | page carrières, en-tête | S3 public en lecture |
| images de publications sociales | 5 Mo | S3 |

## Server functions et routes publiques
Voir `docs/frontend/03-integration-api.md` (table de correspondance complète).

## Points de sécurité acquis à conserver
- `prepaid_email_codes` : serveur uniquement ; code remis à disposition si le paiement échoue.
- Candidatures anonymes : offre publiée de l'organisation, droit `recruitment`, doublon e-mail/téléphone bloqué avant envoi, chemin de fichier construit côté serveur, pas d'écrasement.
- Mutations de badge et décisions de congé auditées avec l'acteur.
- Jetons sociaux nettoyés des métadonnées, jamais renvoyés.
- Données sensibles employé réservées à owner/hr_admin.
