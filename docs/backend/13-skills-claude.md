# 13 — Règles de travail pour Claude Code

Ce fichier est la fiche opératoire. À lire avant chaque session de
développement, avec `00-README.md`.

Il constitue le guide global d'orchestration. Les véritables skills activables
se trouvent dans `.claude/skills/konkoure-*/SKILL.md` et leur catalogue complet
dans [`14-skills-ia-claude-code.md`](./14-skills-ia-claude-code.md).

> **Accès facile** : un miroir de consultation est disponible dans
> `docs/backend/skills/konkoure-*/SKILL.md`. Le chargement automatique par
> Claude Code utilise uniquement `.claude/skills/`.

> **Terminologie** : ces skills guident Claude Code pendant le développement.
> Ils sont distincts du module métier `skills` / `employee_skills`, qui gère les
> compétences professionnelles des employés dans Konkouré.

### Chargement automatique

Claude Code sélectionne les skills grâce à leur champ `description`. Toute
fonctionnalité charge `konkoure-feature-workflow`, son skill métier,
`konkoure-tenant-security` et `konkoure-testing-quality`. Ajouter
`konkoure-api-contracts`, `konkoure-database`, `konkoure-auth-rbac`,
`konkoure-performance-scale`, `konkoure-integrations-jobs` ou
`konkoure-operations` selon les éléments touchés. Les règles de composition et
des exemples sont détaillés dans le document 14.

## 1. Avant d'écrire une ligne de code

1. Lire la section pertinente de ce dossier (schéma, règles métier, contrat
   d'API). **Ne jamais inventer un endpoint, un champ ou une règle** : s'il
   manque, le signaler et demander, ou l'ajouter d'abord à la documentation.
2. Chercher un module existant qui fait déjà 80 % du travail et suivre son
   modèle plutôt que d'inventer une nouvelle structure.
3. Vérifier si la fonctionnalité touche un module soumis à abonnement
   (`recruitment`, `talents`, `integrations`, `api`) : le middleware
   d'entitlement est alors obligatoire.

## 2. Ordre de création d'une fonctionnalité

Toujours dans cet ordre, sans sauter d'étape :

```text
1. migration        database/migrations/XXXX_<table>.ts        (up + down, index, contraintes)
2. modèle           app/models/<entity>.ts                      (TenantModel, relations, serializeAs)
3. validator        app/modules/<mod>/validators/<entity>_validator.ts
4. repository       app/modules/<mod>/repositories/<entity>_repository.ts  (scopé org)
5. service          app/modules/<mod>/services/<entity>_service.ts         (métier, transaction, événement)
6. policy           app/policies/<entity>_policy.ts             (une méthode par action)
7. controller       app/modules/<mod>/controllers/<entity>_controller.ts
8. routes           start/routes/<mod>.ts                        (middlewares : auth, tenant, entitlement, limiter)
9. traductions      resources/lang/{fr,en}/<mod>.json
10. tests           tests/functional/<mod>/<entity>.spec.ts + unitaires
11. documentation   docs/backend/06-api-reference.md (+ 07 si règle métier)
```

## 3. Gabarits

### Controller

```ts
export default class LeavesController {
  constructor(private service: LeaveService) {}

  async store({ request, response, auth, tenant, bouncer }: HttpContext) {
    const payload = await request.validateUsing(createLeaveValidator, {
      meta: { organizationId: tenant.organizationId },
    })
    await bouncer.with('LeavePolicy').authorize('create', payload.employeeId ?? null)
    const leave = await this.service.create(tenant, auth.user!, payload)
    return response.created({ data: leave.serialize() })
  }
}
```
Un controller ne contient jamais : requête Lucid, calcul métier, `try/catch`
générique (l'exception handler s'en charge), lecture de `process.env`.

### Service

```ts
@inject()
export class LeaveService {
  constructor(private repo: LeaveRepository, private balances: LeaveBalanceService) {}

  async create(tenant: TenantContext, actor: User, data: CreateLeaveDto) {
    return withTenant(tenant.organizationId, async (trx) => {
      const employee = await this.repo.employee(data.employeeId ?? tenant.employeeId!, trx)
      const days = await this.balances.computeDays(tenant, data)      // 07 §3.1
      await this.balances.assertAllowed(tenant, employee, data.type, days)
      const leave = await this.repo.create({ ...data, requestedDays: days }, trx)
      await this.balances.reservePending(leave, trx)
      await audit(trx, { action: 'leave.requested', targetId: leave.id, after: leave })
      trx.after('commit', () => emitter.emit('leave:requested', { leaveId: leave.id }))
      return leave
    })
  }
}
```

### Route

```ts
router.group(() => {
  router.get('/leaves', [LeavesController, 'index'])
  router.post('/leaves', [LeavesController, 'store']).use(idempotency())
  router.post('/leaves/:id/approve', [LeavesController, 'approve'])
})
  .prefix('/api/v1/org')
  .use([middleware.auth(), middleware.tenant(), middleware.entitlement('leaves')])
  .use(throttle('org'))
```

## 4. Interdictions formelles

| Interdit | À la place |
|---|---|
| `Model.query()` sans `where('organization_id', …)` | repository scopé |
| `Model.find(id)` sur un identifiant client | `repo.findOrFail(id)` |
| Décision d'autorisation dans le controller ou le front | policy Bouncer |
| Renvoyer `403` pour une ressource d'une autre organisation | `404` |
| `process.env` hors `start/env.ts` | `env.get(...)` |
| Secret, mot de passe, token, UID de badge en clair dans un log | masquer |
| Salaire, pièce d'identité, UID dans une réponse par défaut | sérialiseur dédié après autorisation |
| Appel HTTP, e-mail ou job à l'intérieur d'une transaction | `trx.after('commit', …)` |
| Montant de paiement reçu du client | calcul serveur depuis le plan |
| `requestedDays` de congé reçu du client | calcul serveur |
| `slug` reçu du client | génération serveur |
| Boucle avec accès relationnel (N+1) | `preload` / `withCount` |
| `OFFSET` élevé sur une grande table | curseur |
| `CHECK` dépendant du temps | trigger |
| Nouvelle table sans `organization_id` ni index | corriger la migration |
| Modifier une migration déjà déployée | nouvelle migration |
| `any`, `@ts-ignore`, `console.log` | typer, logger |
| Dépendance npm non justifiée | discuter d'abord |

## 5. Conventions de nommage

| Élément | Convention | Exemple |
|---|---|---|
| Table | snake_case pluriel | `leave_requests` |
| Colonne | snake_case | `decision_comment` |
| Enum SQL | snake_case singulier | `leave_status` |
| Modèle | PascalCase singulier | `LeaveRequest` |
| Fichier | snake_case | `leave_request.ts` |
| Service / Repository | suffixé | `LeaveService`, `LeaveRepository` |
| Policy | `<Entity>Policy` | `LeavePolicy` |
| Route | kebab-case pluriel | `/org/leave-requests` |
| Événement | `domaine:action` | `leave:requested` |
| Action d'audit | `entité.action` | `leave.approved` |
| Job | `domaine:tâche` | `payments:reconcile` |
| Clé de traduction | `module.clé` | `leaves.errors.overlap` |
| Code d'erreur | `E_MAJUSCULES` | `E_LEAVE_OVERLAP` |

## 6. Checklist avant chaque commit

- [ ] `node ace check` (types + lint) passe
- [ ] tests ajoutés et verts, y compris isolation tenant et refus par rôle
- [ ] migration réversible, index et contraintes présents, GRANT/RLS à jour
- [ ] validator complet avec bornes sur tous les champs
- [ ] policy appelée avant toute mutation
- [ ] audit écrit si la mutation est sensible (05 §7)
- [ ] traductions fr **et** en ajoutées
- [ ] rate limit et entitlement déclarés sur les nouvelles routes
- [ ] documentation du dossier `docs/backend/` mise à jour
- [ ] aucun secret, aucune donnée sensible dans les réponses ni les logs
- [ ] message de commit conventionnel (`feat(leaves): …`, `fix(auth): …`)

## 7. Procédure : ajouter un nouveau module de bout en bout

Exemple, module « notes de frais » :

1. **Documenter d'abord** : ajouter les tables à `02-schema-db.md`, les règles à
   `07-regles-metier.md`, les endpoints à `06-api-reference.md`, les droits à
   la matrice de `04-auth-rbac.md`, le module à la liste `07 §6.1`.
2. Migration + enum + index + trigger `updated_at`.
3. Modèle, repository scopé, service, validators, policy.
4. Controller et routes sous `/api/v1/org/expenses`, middlewares
   `auth`, `tenant`, `entitlement('expenses')`, `throttle('org')`.
5. Ajouter `expenses` aux `modules` des plans concernés (seeder + migration de
   données pour les plans existants).
6. Événements et notifications (soumission, validation, refus).
7. Traductions fr/en, y compris les messages d'erreur.
8. Tests : unitaires (calculs), fonctionnels (chaque endpoint × chaque rôle),
   isolation tenant, entitlement refusé sans le module.
9. Index vérifiés par `EXPLAIN` sur la liste principale.
10. Mise à jour du tableau de bord et des exports si pertinent.

## 8. Quand demander plutôt que décider

Demander systématiquement avant : ajouter une dépendance externe, changer le
contrat d'un endpoint existant, écrire une migration destructive, modifier une
règle métier documentée, introduire un nouveau fournisseur tiers, désactiver un
contrôle de sécurité, stocker une nouvelle catégorie de donnée personnelle.

Décider seul : nommage interne, découpage en fonctions, choix d'un index,
formulation d'un message d'erreur, organisation des tests.

## 9. Rappels métier à ne jamais oublier

- Référence géographique par défaut : **Guinée**, Conakry (`9.6412`, `-13.5784`),
  fuseau `Africa/Conakry`, devise **GNF**. Jamais Dakar ni le Sénégal comme
  exemple ou valeur de repli.
- Interface et messages **bilingues fr/en**, français par défaut.
- L'annulation d'un abonnement **ne coupe jamais l'accès immédiatement**.
- Un manager **n'approuve jamais** sa propre demande de congé.
- Le **motif est obligatoire** au refus d'un congé et au renvoi d'une évaluation.
- Le commentaire du manager reste **visible en lecture seule** par l'employé
  après renvoi, validation et signature.
- Une évaluation **signée** est définitivement figée.
- L'UID d'un badge NFC est **normalisé, haché et masqué** — jamais en clair.

## 10. Maintenance des skills IA

1. Modifier d'abord le document métier ou technique qui fait autorité.
2. Mettre ensuite à jour la checklist des skills concernés ; ne jamais faire du
   `SKILL.md` une source de vérité concurrente.
3. Toute description commence par un déclencheur explicite de type « Use
   automatically when… » et cite les mots employés dans les demandes réelles,
   en français ou en anglais lorsque pertinent.
4. Lorsqu'un nouveau domaine apparaît, créer un skill `konkoure-<domaine>`,
   l'ajouter au catalogue 14 et déclarer sa composition dans `CLAUDE.md`.
5. Si plusieurs skills s'appliquent, leurs contrôles se cumulent. Le document
   backend le plus spécifique tranche toute divergence.


## Complément : intégration du frontend

`konkoure-frontend-integration` — migration et maintenance de `apps/web` contre l'API AdonisJS. Charger avec `konkoure-api-contracts`, le skill du domaine et `konkoure-testing-quality`. Références : `docs/frontend/`.
