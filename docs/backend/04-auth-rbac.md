# 04 — Authentification et autorisation

## 1. Stratégie

Authentification **native AdonisJS**, guard `access_tokens` (aucune dépendance
externe). Deux jetons :

| Jeton | Nature | Durée | Transport | Stockage client |
|---|---|---|---|---|
| **Access token** | opaque, table `auth_access_tokens` | **15 min** | `Authorization: Bearer <token>` | mémoire (web) / secure storage (Flutter) |
| **Refresh token** | opaque 64 octets aléatoires, hash SHA-256 en base | **30 jours** (mobile 90) | corps JSON *ou* cookie httpOnly `SameSite=Strict; Secure` (web) | cookie httpOnly (web) / secure storage (mobile) |

Un access token expiré renvoie `401 E_TOKEN_EXPIRED` ; le client appelle
`POST /api/v1/auth/refresh` puis rejoue la requête. Le client ne doit **jamais**
boucler plus d'une fois sur un refresh pour une même requête.

### Rotation et détection de vol

- Chaque refresh **consomme** le token présenté et en émet un nouveau dans la
  même `family_id` (`replaced_at` renseigné sur l'ancien).
- Présenter un refresh token déjà consommé ou révoqué ⇒ **toute la famille est
  révoquée immédiatement**, l'utilisateur est déconnecté de cet appareil, un
  événement `security.refresh_reuse_detected` est journalisé et une notification
  e-mail part vers l'utilisateur.
- `POST /auth/logout` révoque l'access token courant + la famille de refresh.
- `POST /auth/logout-all` révoque toutes les familles de l'utilisateur.

## 2. Mots de passe

- Hash **argon2id** (`config/hash.ts`, driver `argon2`, `memory: 65536`,
  `iterations: 3`, `parallelism: 4`).
- Politique : ≥ 10 caractères, au moins une minuscule, une majuscule, un chiffre.
  Refus des 10 000 mots de passe les plus courants (liste embarquée) et de toute
  chaîne contenant l'e-mail ou le nom.
- Changement de mot de passe : exige le mot de passe actuel, révoque toutes les
  autres sessions.
- **Anti-force brute** : `failed_login_attempts` incrémenté à chaque échec ;
  au 5ᵉ échec, `locked_until = now() + 15 min` ⇒ `423 E_ACCOUNT_LOCKED`.
  Remise à zéro sur connexion réussie. En parallèle, limiteur Redis :
  10 tentatives / 15 min par IP, 5 par e-mail.
- **Réponse constante** : `/auth/login` renvoie le même message d'erreur et
  approximativement le même temps de réponse que l'e-mail existe ou non
  (hash factice exécuté si l'utilisateur est introuvable).

## 3. Cycle de vie des comptes

### Inscription (`POST /auth/register`)
1. Validation (e-mail, mot de passe, nom complet).
2. Création `users` avec `email_verified_at = null`.
3. Envoi d'un e-mail de vérification (token signé, TTL 24 h).
4. Réponse : tokens émis, mais toute route `/api/v1/org/*` reste bloquée
   (`403 E_EMAIL_NOT_VERIFIED`) tant que l'e-mail n'est pas vérifié — sauf
   `POST /org` (création de la première organisation) qui exige la vérification.

**Aucune inscription anonyme.** Pas d'auto-confirmation d'e-mail.

### Création d'organisation (onboarding)
Le créateur devient automatiquement `owner`, un `employees` lui est créé et lié,
une `subscriptions` en `trialing` (plan `free`, 30 jours) est ouverte.

### Invitation (`POST /org/invitations`)
1. Un `owner` ou `hr_admin` invite un e-mail avec un rôle et, optionnellement,
   un `employee_id` à lier.
2. Token aléatoire 32 octets, seul le hash est stocké, TTL 7 jours.
3. E-mail Resend avec lien `https://app/.../invitation?token=…`.
4. Acceptation : si l'e-mail existe déjà, on ajoute simplement le rôle ;
   sinon on crée le compte avec mot de passe choisi et `email_verified_at = now()`.
5. Une invitation acceptée, révoquée ou expirée n'est plus utilisable.
   Relance limitée à 3 envois / 24 h.

### Réinitialisation de mot de passe
`POST /auth/forgot-password` → toujours `204`, même si l'e-mail est inconnu.
Token à usage unique, TTL 1 h, hash stocké. `POST /auth/reset-password` révoque
toutes les sessions et journalise `security.password_reset`.

### Désactivation / suppression
`is_active = false` bloque immédiatement l'authentification et invalide les
tokens. La suppression RGPD anonymise `users` (`email` remplacé par
`deleted+<id>@invalid`, `full_name` vidé) et conserve les journaux d'audit avec
l'identifiant technique uniquement.

## 4. Rôles

### Rôles d'organisation (`app_role`)

| Rôle | Portée |
|---|---|
| `owner` | Tous les droits sur l'organisation, y compris facturation et suppression |
| `hr_admin` | Tous les droits RH, sauf facturation et gestion des `owner` |
| `manager` | Son périmètre : son équipe directe et indirecte (descendance de `manager_id`) |
| `employee` | Ses propres données uniquement |
| `recruiter` | Recrutement complet ; lecture minimale des employés |
| `security_agent` | Pointage : scan, zones (lecture), journaux de pointage |

Un utilisateur peut cumuler plusieurs rôles dans une organisation : les droits
sont l'**union** des rôles.

### Rôles plateforme (`platform_admin_level`)

| Niveau | Portée |
|---|---|
| `support` | Lecture du back-office, consultation des journaux, changement de statut des demandes de démo |
| `root` | Tout `support` + modification des plans, des abonnements, des rôles, des réglages plateforme, actions destructrices |

Les admins plateforme sont dans `platform_admins`. **Aucun repli par variable
d'environnement en production** ; `ROOT_ADMIN_EMAIL` ne sert qu'à créer le
premier enregistrement au seed.

## 5. Matrice d'autorisation

Légende : ✔ tout · **S** soi-même · **T** son équipe (descendance managériale) ·
**D** son département · ✖ interdit

### RH

| Ressource / action | owner | hr_admin | manager | employee | recruiter | security_agent |
|---|---|---|---|---|---|---|
| employees.list | ✔ | ✔ | T | S | ✔ (champs réduits) | ✔ (champs réduits) |
| employees.view | ✔ | ✔ | T | S | champs réduits | champs réduits |
| employees.create/update | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| employees.delete | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| employees.viewSalary | ✔ | ✔ | ✖ | S | ✖ | ✖ |
| employees.viewSensitive (`national_id`, passeport) | ✔ | ✔ | ✖ | S | ✖ | ✖ |
| employees.import | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| departments.* (écriture) | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| departments.list | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| contracts.list/view | ✔ | ✔ | T (sans salaire) | S | ✖ | ✖ |
| contracts.create/update/delete | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| skills.* | ✔ | ✔ | T (lecture) | S | ✖ | ✖ |

*Champs réduits* = `id`, nom, poste, département, photo. Ni e-mail personnel,
ni téléphone, ni salaire, ni pièce d'identité.

### Pointage

| Action | owner | hr_admin | manager | employee | recruiter | security_agent |
|---|---|---|---|---|---|---|
| workZones.list | ✔ | ✔ | ✔ | ✖ | ✖ | ✔ |
| workZones.create/update/delete | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| badges.assign/revoke | ✔ | ✔ | ✖ | ✖ | ✖ | ✔ |
| badges.viewUid | ✔ | ✔ | ✖ | ✖ | ✖ | ✔ (masqué) |
| timeLogs.scan | ✔ | ✔ | ✔ | ✖ | ✖ | ✔ |
| timeLogs.selfPunch | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| timeLogs.list | ✔ | ✔ | T | S | ✖ | ✔ |
| timeLogs.correct/delete | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |

### Congés

| Action | owner | hr_admin | manager | employee |
|---|---|---|---|---|
| leaves.request | ✔ (S) | ✔ (S) | ✔ (S) | ✔ (S) |
| leaves.list | ✔ | ✔ | T | S |
| leaves.approve / reject | ✔ | ✔ | T | ✖ |
| leaves.cancel | ✔ | ✔ | T | S (si `pending`) |
| leaves.adjustBalance | ✔ | ✔ | ✖ | ✖ |
| holidays.* (écriture) | ✔ | ✔ | ✖ | ✖ |

Un manager **ne peut jamais approuver sa propre demande** : elle remonte à son
propre manager, à défaut à un `hr_admin` ou `owner`.

### Recrutement

| Action | owner | hr_admin | recruiter | manager | employee |
|---|---|---|---|---|---|
| jobs.list/view | ✔ | ✔ | ✔ | D (lecture) | ✖ |
| jobs.create/update | ✔ | ✔ | ✔ | ✖ | ✖ |
| jobs.publish/close | ✔ | ✔ | ✔ | ✖ | ✖ |
| candidates.* | ✔ | ✔ | ✔ | ✖ | ✖ |
| candidates.notes.create | ✔ | ✔ | ✔ | ✖ | ✖ |
| candidates.notes.delete | ✔ | ✔ | auteur uniquement | ✖ | ✖ |
| candidates.hire | ✔ | ✔ | ✔ | ✖ | ✖ |
| webhookConfig.* | ✔ | ✔ | ✖ | ✖ | ✖ |

### Performance

| Action | owner | hr_admin | manager | employee |
|---|---|---|---|---|
| cycles/plans.* | ✔ | ✔ | ✖ | ✖ |
| goals.create pour soi | ✔ | ✔ | ✔ | ✔ |
| goals.create pour autrui (champ « propriétaire ») | ✔ | ✔ | T | ✖ |
| goals.update | ✔ | ✔ | T | S |
| okrs.submit | S | S | S | S |
| okrs.validate / needsRevision | ✔ | ✔ | T | ✖ |
| okrCheckins.create | ✔ | ✔ | T | S |
| reviews.selfEvaluation | S | S | S | S |
| reviews.managerEvaluation | ✔ | ✔ | T | ✖ |
| reviews.sendBack | ✔ | ✔ | T | ✖ |
| reviews.validate | ✔ | ✔ | T | ✖ |
| reviews.sign | ✖ | ✖ | ✖ | S (l'évalué signe) |
| reviews.view | ✔ | ✔ | T | S |
| feedback.create | ✔ | ✔ | ✔ | ✔ |
| feedback.view | ✔ | ✔ | T (si `visible_to_manager`) | reçus + émis |
| talents (9box, succession) | ✔ | ✔ | T (lecture) | ✖ |

### Facturation et réglages

| Action | owner | hr_admin | autres |
|---|---|---|---|
| billing.view / checkout / cancel | ✔ | ✖ | ✖ |
| invoices.download | ✔ | ✖ | ✖ |
| organization.settings.update | ✔ | ✔ | ✖ |
| organization.delete | ✔ | ✖ | ✖ |
| users.roles.update | ✔ | ✔ (sauf attribuer/retirer `owner`) | ✖ |
| invitations.* | ✔ | ✔ | ✖ |
| integrations.social.* | ✔ | ✔ | ✖ |

Règles structurelles : une organisation conserve **au moins un `owner` actif** ;
un utilisateur ne peut ni modifier son propre rôle, ni se retirer le rôle
`owner` s'il est le dernier.

### Back-office plateforme

| Action | support | root |
|---|---|---|
| organisations.list/view | ✔ | ✔ |
| organisation.updateSubscription | ✖ | ✔ |
| plans.* (écriture) | ✖ | ✔ |
| users.search / view | ✔ | ✔ |
| users.roles.update | ✖ | ✔ |
| platformAdmins.* | ✖ | ✔ |
| settings.update | ✖ | ✔ |
| logs (audit / système / usage) | ✔ | ✔ |
| payments.list / reconcile | ✔ (lecture) | ✔ |
| demoRequests.updateStatus | ✔ | ✔ |
| impersonation | ✖ | ✔ (journalisée, TTL 30 min, bannière obligatoire) |

## 6. Implémentation Bouncer

Une policy par ressource dans `app/policies/`. Signature type :

```ts
// app/policies/employee_policy.ts
export default class EmployeePolicy extends BasePolicy {
  constructor(private ctx: TenantContext) { super() }

  view(user: User, employee: Employee): AuthorizerResponse {
    if (employee.organizationId !== this.ctx.organizationId) return false
    if (this.ctx.hasRole('owner', 'hr_admin')) return true
    if (this.ctx.employeeId === employee.id) return true
    if (this.ctx.hasRole('manager')) return this.ctx.managesEmployee(employee.id)
    if (this.ctx.hasRole('recruiter', 'security_agent')) return true // champs réduits
    return false
  }

  viewSalary(user: User, employee: Employee) {
    return this.ctx.hasRole('owner', 'hr_admin') || this.ctx.employeeId === employee.id
  }

  update(user: User, employee: Employee) {
    return employee.organizationId === this.ctx.organizationId
        && this.ctx.hasRole('owner', 'hr_admin')
  }
}
```

`ctx.managesEmployee(id)` s'appuie sur une **CTE récursive** sur `manager_id`,
mise en cache Redis 5 min par manager (clé `mgr:<orgId>:<employeeId>`),
invalidée à chaque changement de `manager_id` ou de département.

```sql
WITH RECURSIVE team AS (
  SELECT id FROM employees WHERE manager_id = :managerEmployeeId AND deleted_at IS NULL
  UNION ALL
  SELECT e.id FROM employees e JOIN team t ON e.manager_id = t.id WHERE e.deleted_at IS NULL
) SELECT id FROM team;
```
Profondeur maximale 10 niveaux (garde-fou anti-cycle).

Le controller appelle systématiquement :

```ts
await bouncer.with('EmployeePolicy').authorize('update', employee)
```

Un `Gate` global `platform` couvre les routes back-office.

## 7. Reprise des comptes existants

Les mots de passe Supabase ne sont pas récupérables. Procédure :

1. Import des `users` (e-mail, nom, langue, `email_verified_at`) avec
   `password_hash = NULL` et `must_reset_password = true`.
2. À la première connexion, `/auth/login` renvoie
   `409 E_PASSWORD_RESET_REQUIRED` et déclenche l'envoi d'un lien de définition
   de mot de passe.
3. Campagne e-mail préalable annonçant la bascule, avec fenêtre de 30 jours.
4. Passé ce délai, les comptes non réactivés sont désactivés (`is_active=false`),
   sans suppression.
