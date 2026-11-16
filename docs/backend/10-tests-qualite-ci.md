# 10 — Tests, qualité et intégration continue

## 1. Pyramide de tests

| Niveau | Outil | Part | Contenu |
|---|---|---|---|
| Unitaire | Japa | ~40 % | services purs, calculs (jours de congés, normalisation UID, distance géo, progression OKR, prorata) |
| Intégration | Japa + base de test | ~20 % | repositories, transactions, contraintes SQL, triggers |
| Fonctionnel (API) | `@japa/api-client` | ~35 % | chaque endpoint, chaque rôle, chaque erreur |
| Bout en bout | k6 / scripts | ~5 % | parcours critiques et charge |

**Couverture minimale exigée** : 80 % global, **95 % sur** `app/policies/`,
`app/shared/entitlements/`, `app/modules/billing/`, `app/modules/timeclock/`,
`app/modules/leaves/`, `app/modules/auth/`.

## 2. Tests obligatoires par endpoint

Pour tout endpoint, quatre tests au minimum :

```ts
test.group('POST /api/v1/org/employees', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('un hr_admin crée un employé', async ({ client, assert }) => {
    const { org, user } = await seedOrg({ role: 'hr_admin' })
    const res = await client.post('/api/v1/org/employees')
      .loginAs(user).header('X-Organization-Id', org.id)
      .json({ firstName: 'Mariama', lastName: 'Diallo' })
    res.assertStatus(201)
    assert.equal(res.body().data.organizationId, org.id)
  })

  test('un employee ne peut pas créer', async ({ client }) => {
    const { org, user } = await seedOrg({ role: 'employee' })
    const res = await client.post('/api/v1/org/employees')
      .loginAs(user).header('X-Organization-Id', org.id)
      .json({ firstName: 'A', lastName: 'B' })
    res.assertStatus(403)
  })

  test('isolation tenant : org B invisible depuis org A', async ({ client }) => {
    const a = await seedOrg({ role: 'owner' })
    const b = await seedOrg({ role: 'owner' })
    const employeeB = await EmployeeFactory.merge({ organizationId: b.org.id }).create()
    const res = await client.get(`/api/v1/org/employees/${employeeB.id}`)
      .loginAs(a.user).header('X-Organization-Id', a.org.id)
    res.assertStatus(404)          // jamais 403
  })

  test('validation : prénom manquant', async ({ client }) => {
    const { org, user } = await seedOrg({ role: 'owner' })
    const res = await client.post('/api/v1/org/employees')
      .loginAs(user).header('X-Organization-Id', org.id).json({ lastName: 'B' })
    res.assertStatus(422)
    res.assertBodyContains({ error: { code: 'E_VALIDATION' } })
  })
})
```

Un endpoint sans test d'isolation tenant **n'est pas terminé**.

## 3. Scénarios métier à couvrir explicitement

- **Auth** : rotation de refresh, détection de réutilisation (famille révoquée),
  verrouillage après 5 échecs, réponse identique e-mail connu/inconnu,
  invitation expirée, invitation déjà acceptée.
- **Entitlements** : accès `recruitment` refusé en essai gratuit, accès rétabli
  après paiement, accès maintenu après annulation jusqu'à l'échéance, quota
  d'employés atteint.
- **Congés** : décompte avec week-ends et jours fériés, demi-journées,
  chevauchement refusé, solde négatif autorisé jusqu'à la limite puis refusé,
  motif obligatoire au refus, manager ne s'auto-approuve pas, ledger cohérent
  après approbation puis annulation.
- **Pointage** : normalisation d'UID (hex, décimal, deux-points, minuscules),
  badge d'une autre organisation ⇒ 404, doublon dans la fenêtre, hors zone
  accepté ou refusé selon le réglage, idempotence `clientPunchId`,
  synchronisation hors-ligne de 200 pointages.
- **Performance** : cycle OKR complet (soumission, renvoi, revalidation),
  progression recalculée par trigger, cycle d'évaluation complet jusqu'à
  signature, commentaire manager visible en lecture seule après renvoi,
  impossibilité de modifier une évaluation `signed`.
- **Recrutement** : candidature en doublon, document manquant, offre expirée,
  scoring en échec sans effet de bord, embauche créant l'employé.
- **Facturation** : webhook signé accepté, signature invalide rejetée, rejeu
  ignoré, montant insuffisant ⇒ échec, jeton de réclamation à usage unique,
  prolongation de période au lieu du remplacement.
- **Sécurité** : SSRF sur URL de webhook (IP privée, redirection, IPv6),
  upload avec extension mensongère, champs sensibles absents des réponses,
  audit écrit pour chaque mutation sensible.

## 4. Environnement de test

- Base PostgreSQL dédiée (`konkoure_test`), migrée avant la suite.
- Chaque test tourne dans une **transaction globale annulée** en fin de test.
- Redis en base logique séparée, vidée entre les groupes.
- Tous les services externes sont **mockés** : Djomy, Resend, IA, réseaux
  sociaux, S3 (driver `fake` de Drive). Aucun appel réseau réel en CI.
- Helper `seedOrg({ role, plan, employees })` : crée organisation, abonnement,
  utilisateur et rôle en une ligne.
- Horloge figée (`timekeeper` / `DateTime.local` mocké) pour les tests
  temporels (essais, échéances, reports annuels).

## 5. Qualité statique

- TypeScript `strict: true`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`. Aucun `any` implicite ni `@ts-ignore` sans
  justification écrite.
- ESLint (config Adonis) + Prettier, appliqués en pré-commit (lint-staged).
- Règles ESLint personnalisées bloquantes :
  - interdiction d'importer un modèle Lucid dans un controller ;
  - interdiction de `Model.query()` hors repository ;
  - interdiction de `process.env` hors `start/env.ts` ;
  - interdiction de `console.log` (logger uniquement).
- `node ace check` (types + lint) doit passer avant tout commit.

## 6. Intégration continue

```yaml
# .github/workflows/ci.yml (schéma)
jobs:
  quality:
    services: [postgres:16, redis:7]
    steps:
      - checkout
      - setup-node (22, cache npm)
      - npm ci
      - npm run lint
      - npm run typecheck
      - node ace migration:run --force
      - npm run test -- --coverage      # échec si < 80 %
      - npm audit --audit-level=high
      - docker build .
  migrations-reversibility:
    steps:
      - migration:run puis migration:rollback --batch=0 puis migration:run
  load (nightly):
    steps:
      - k6 run tests/load/timeclock_peak.js
```

Une pull request ne peut être fusionnée que si : CI verte, couverture non
dégradée, au moins une revue, aucune vulnérabilité `high`/`critical`, et la
documentation de ce dossier mise à jour si le contrat d'API change.

## 7. Définition de « terminé »

Une fonctionnalité est terminée quand :

- [ ] migration écrite, réversible, avec index et contraintes
- [ ] modèle, repository scopé, service, validator, policy, controller, route
- [ ] traductions fr/en des messages
- [ ] tests unitaires + fonctionnels (succès, refus, isolation, validation)
- [ ] audit et notifications branchés si la règle l'exige
- [ ] rate limit et entitlement déclarés sur la route
- [ ] `06-api-reference.md` mis à jour
- [ ] `EXPLAIN` vérifié sur les nouvelles requêtes de liste
- [ ] aucun secret, aucune donnée sensible dans les logs ni les réponses
