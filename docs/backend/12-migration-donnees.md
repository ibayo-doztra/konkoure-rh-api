# 12 — Migration des données depuis l'existant

Objectif : basculer de l'application Supabase actuelle vers le backend AdonisJS
sans perte de données ni interruption prolongée.

## 1. Stratégie

Bascule en **trois temps** :

```text
Phase 1 — Préparation      : nouveau backend déployé, base vide, ETL testé sur staging
Phase 2 — Reprise à blanc  : import complet en staging, contrôles, corrections de l'ETL
Phase 3 — Bascule          : gel des écritures (fenêtre 2 h, nuit du samedi),
                             import final, vérifications, ouverture du nouveau front
```

Pas de double écriture ni de synchronisation bidirectionnelle : la complexité et
le risque d'incohérence dépassent le bénéfice pour une fenêtre de 2 heures.

## 2. Outil d'ETL

Commande Ace dédiée, exécutable par table et rejouable :

```bash
node ace migrate:legacy --source=<postgres_url_supabase> --only=employees --dry-run
node ace migrate:legacy --source=... --all --batch-size=500
```

Caractéristiques : idempotent (`ON CONFLICT DO UPDATE` sur les clés d'origine),
conservation des `id` uuid existants quand ils sont valides, table de
correspondance `legacy_id_map(entity, legacy_id, new_id)` pour les cas de
recréation, rapport final par table (lus, insérés, mis à jour, ignorés, erreurs).

## 3. Ordre d'import

```text
1. plans                    (catalogue)
2. users                    (depuis auth.users + profiles)
3. organizations
4. user_roles               (user_roles ∪ organization_members)
5. subscriptions            (déduites de organizations + plans)
6. departments → employees → departments.manager_id (2e passe)
7. contracts, skills, employee_skills
8. work_zones, nfc_badges, nfc_badge_events
9. time_logs → attendance_days (recalcul)
10. public_holidays, leave_requests → leave_balances + ledger (recalcul)
11. jobs, candidates, candidate_notes, candidate_events
12. performance_cycles, performance_plans, goals, goal_activities
13. okrs → okr_key_results (éclatement du JSON), okr_checkins
14. performance_reviews (fusion avec reviews), review_goal_comments
15. feedbacks, achievements, succession_plans
16. payments (depuis subscription_payments), invoices (générées)
17. notifications (90 derniers jours), audit_logs (12 derniers mois)
18. platform_admins, platform_settings, demo_requests
19. social_accounts (sans tokens — reconnexion obligatoire), social_posts
20. fichiers du stockage (copie bucket à bucket)
```

## 4. Correspondances table par table

| Source (Supabase) | Cible | Transformation |
|---|---|---|
| `auth.users` + `profiles` | `users` | `email`, `full_name`, `avatar_url`, `preferred_language`, `email_verified_at` ; `password_hash = NULL`, `must_reset_password = true` |
| `organizations` | `organizations` + `subscriptions` | `plan`/`plan_id`/`statut_abo`/`cycle`/`periode_fin`/`max_employes_override`/`modules_override` → `subscriptions` ; `settings` construit depuis les valeurs par défaut |
| `user_roles` + `organization_members` | `user_roles` | union dédupliquée ; un membre sans rôle devient `employee` |
| `employees` | `employees` | `position` fusionné dans `job_title` si `job_title` vide ; `nfc_badge_uid/active/assigned_at` → `nfc_badges` ; `leave_balance` → `leave_balances(year, 'annual')` ; `profile_details` conservé |
| `nfc_badge_history` | `nfc_badge_events` | `uid` → `uid_masked` (4 derniers) ; `event` normalisé |
| `time_logs` | `time_logs` | `type` `ARRIVEE`→`in`, `DEPART`→`out` ; `timestamp`→`punched_at` ; `source` texte → enum (`nfc`, `manual`, `mobile_gps`, défaut `import`) ; rattachement de `work_zone_id` par calcul géographique |
| `work_zones` | `work_zones` | `shape` texte → enum ; `polygon` validé, sinon repli `circle` |
| `leave_requests` | `leave_requests` | `type` `annuel`→`annual`, `maladie`→`sick`, `maternite`→`maternity`, `sans_solde`→`unpaid` ; `decision_comment` conservé |
| — | `leave_balances`, `leave_balance_ledger` | **recalculés** depuis `employees.leave_balance` (ligne d'ouverture) et l'historique des congés approuvés |
| `contracts` | `contracts` | `type` `Journalier`→`daily` ; `document_url` → `document_path` (+ copie du fichier) |
| `jobs` | `jobs` | `slug` regénéré si nul ou en collision ; `published_at` = `created_at` si `status='published'` |
| `candidates` | `candidates` | `cv_url`/`cover_letter_url` → chemins privés ; `documents` jsonb conservé ; `ai_score`, `ai_justification`, `ai_strengths`, `ai_weaknesses`, `ai_scored_at`, `ai_candidate_name`, `ai_is_valid_cv`, `ai_fraud_alert` repris tels quels (aucun re-scoring pendant la reprise) ; `phone` normalisé au format `NNN NN NN NN` quand les 9 chiffres sont présents, sinon conservé brut et signalé |
| `candidate_activities` | `candidate_events` | enum étendu, `payload` conservé |
| `okrs` | `okrs` + `okr_key_results` | éclatement du tableau `key_results` : `position`, `title`, `is_done` ; `progress` recalculé par trigger |
| `reviews` + `performance_reviews` | `performance_reviews` | fusion sur `(organization_id, employee_id, période)` ; `self_text`→`self_global_comment`, `manager_text`→`manager_global_comment`, `ai_summary`, `performance_score`, `potential_score` conservés ; conflit ⇒ `performance_reviews` prioritaire |
| `subscription_payments` | `payments` | `org_id`→`organization_id` ; `status` texte → enum ; `method` → enum ; `claim_token` → `claim_token_hash` (les jetons non réclamés et non expirés sont **invalidés** et regénérés sur demande) |
| `audit_log` + `billing_audit_log` | `audit_logs` | `billing_audit_log.event` préfixé `billing.` |
| `system_log` | `system_logs` | tel quel, 30 derniers jours |
| `usage_events` | `usage_events` | tel quel, 12 derniers mois |
| `recruitment_webhook_configs` | idem | URLs revalidées par `validateOutboundUrl` ; une URL invalide passe l'environnement à `off` avec notification |
| `social_accounts` | `social_accounts` | **tokens non repris** ; `status='revoked'`, reconnexion OAuth requise |
| `platform_admins`, `platform_settings`, `demo_requests` | idem | tels quels |

Tables **non reprises** : `webhook_events` (remplacée par `webhook_receipts`,
repartir à vide), `profiles` (fusionnée), `organization_members` (fusionnée).

## 5. Fichiers

Copie bucket à bucket avec conservation du chemin logique, réécriture des
chemins en base, vérification du checksum. Les fichiers orphelins (référencés en
base mais absents du stockage) sont consignés dans un rapport et la référence
est mise à `NULL`. Les URLs publiques Supabase deviennent des chemins privés :
aucune URL publique de document n'est reprise.

## 6. Contrôles de cohérence (bloquants)

Après import, tous ces contrôles doivent passer :

```sql
-- Cardinalités identiques (tolérance 0)
SELECT 'employees', (SELECT count(*) FROM legacy.employees WHERE deleted_at IS NULL),
                    (SELECT count(*) FROM employees WHERE deleted_at IS NULL);
-- idem pour organizations, time_logs, leave_requests, candidates, goals, okrs,
-- performance_reviews, payments

-- Aucune ligne orpheline
SELECT count(*) FROM employees e
 LEFT JOIN organizations o ON o.id = e.organization_id WHERE o.id IS NULL;   -- = 0

-- Aucun organization_id nul sur les tables métier
-- Aucune FK croisant deux organisations
SELECT count(*) FROM employees e JOIN departments d ON d.id = e.department_id
 WHERE d.organization_id <> e.organization_id;                                -- = 0

-- Soldes de congés cohérents
SELECT count(*) FROM leave_balances lb
 WHERE lb.entitled + lb.carried_over_days - lb.taken_days - lb.pending_days
       <> (SELECT COALESCE(sum(delta_days),0) FROM leave_balance_ledger l
            WHERE l.employee_id = lb.employee_id AND l.year = lb.year);       -- = 0

-- Progression OKR conforme aux résultats clés
SELECT count(*) FROM okrs o WHERE o.progress <> (
  SELECT COALESCE(round(100.0 * count(*) FILTER (WHERE is_done) / NULLIF(count(*),0)), 0)
    FROM okr_key_results k WHERE k.okr_id = o.id);                            -- = 0

-- Unicité des badges actifs
SELECT uid_hash FROM nfc_badges WHERE revoked_at IS NULL
 GROUP BY uid_hash HAVING count(*) > 1;                                       -- vide

-- Chaque organisation a au moins un owner
SELECT o.id FROM organizations o WHERE NOT EXISTS (
  SELECT 1 FROM user_roles r WHERE r.organization_id = o.id AND r.role='owner'); -- vide

-- Chaque organisation a exactement un abonnement non terminal
SELECT organization_id FROM subscriptions
 WHERE status NOT IN ('expired','canceled')
 GROUP BY organization_id HAVING count(*) <> 1;                               -- vide
```

Contrôles fonctionnels manuels : ouvrir 5 organisations représentatives et
vérifier effectifs, soldes de congés, derniers pointages, évaluations signées,
abonnement et échéance.

## 7. Fenêtre de bascule

```text
T−7 j  : annonce aux clients (e-mail), rappel du changement de mot de passe
T−1 j  : import à blanc sur staging depuis une copie fraîche, contrôles verts
T+0h00 : mise en lecture seule de l'application actuelle
T+0h10 : sauvegarde complète de la base source
T+0h20 : ETL complet (estimé 40 min pour ~5 M de pointages)
T+1h10 : contrôles de cohérence automatisés
T+1h30 : bascule DNS / configuration du front et de l'app mobile
T+1h45 : tests de fumée (connexion, pointage, congé, tableau de bord)
T+2h00 : ouverture aux utilisateurs, surveillance renforcée 48 h
```

Critère d'abandon : un contrôle bloquant en échec ou un dépassement de 3 h ⇒
retour à l'application actuelle (encore intacte, simplement remise en écriture).

## 8. Bascule des clients

### Front web
Réécriture de la couche d'accès : les `createServerFn` et appels
`supabase.from(...)` sont remplacés par un client HTTP typé
(`src/lib/api/client.ts`) qui gère `Authorization`, `X-Organization-Id`, le
rafraîchissement de jeton et le format d'erreur normalisé. Migration module par
module, derrière un drapeau `VITE_API_BASE_URL`.

### Application mobile Flutter
Nouveaux points d'entrée : `POST /api/v1/auth/login`, `/auth/refresh`,
`POST /api/v1/org/timeclock/scan`, `/timeclock/sync`, `/me/employee`.
Le stockage sécurisé conserve `accessToken`, `refreshToken`, `organizationId`.
Le mode hors-ligne s'appuie sur `clientPunchId` et `/timeclock/sync`.
Publier la nouvelle version **avant** la bascule, avec bascule d'URL par
configuration distante, et prévoir un écran de mise à jour obligatoire pour les
versions antérieures.

### Intégrations
- n8n : nouvelle URL de rappel, nouveau secret HMAC par organisation.
- Djomy : nouvelle URL de webhook, nouveau secret.
- Resend : nouvelle URL de webhook de délivrabilité.
- Réseaux sociaux : reconnexion OAuth par chaque organisation.

## 9. Retour arrière

Pendant 30 jours, la base Supabase source est conservée en lecture seule.
Un retour arrière consiste à remettre l'ancien front en écriture ; les données
créées dans le nouveau backend pendant cette période devraient alors être
réimportées manuellement — d'où la surveillance renforcée et la décision de
retour arrière limitée aux **6 premières heures** suivant la bascule.

## 10. Après la bascule

- J+1 : rapport d'écarts, tickets ouverts, taux de connexion réussie.
- J+7 : purge des tables temporaires d'ETL, revue des index réellement utilisés
  (`pg_stat_user_indexes`), suppression des index inutiles.
- J+30 : archivage de la base source, clôture du chantier.

## Compléments : comptes et fichiers
- Utilisateurs : exporter `auth.users` (id, e-mail, confirmation, métadonnées non sensibles) ; conserver les UUID. Si les hachages bcrypt sont importables, les vérifier en bcrypt puis re-hacher en Argon2id à la première connexion ; sinon, réinitialisation forcée avec e-mail Resend.
- Rôles : `user_roles`, `organization_members`, `platform_admins`.
- Fichiers : copier les buckets `applications`, `avatars` et logos vers S3 en conservant les chemins ; vérifier le nombre et la taille.
- Comptes OAuth Google : relier par e-mail vérifié.
- Jetons sociaux : non migrés ; reconnexion demandée aux organisations.
