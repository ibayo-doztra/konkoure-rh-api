# 07 — Règles métier

Référence temporelle : fuseau de l'organisation (`Africa/Conakry` par défaut).
Tous les calculs de jours se font dans ce fuseau, jamais en UTC brut.

## 1. Employés et organisation

1.1 **Quota du plan** — la création ou la réactivation d'un employé `active` est
refusée (`403 E_QUOTA_EXCEEDED`) si `count(employees WHERE status <> 'terminated'
AND deleted_at IS NULL) >= max_employees` (override d'abonnement prioritaire).
Les employés `terminated` ne comptent pas.

1.2 **Lien compte ↔ employé** — un `users` est lié à au plus un `employees` par
organisation. Lier un compte déjà lié renvoie `409`.

1.3 **Hiérarchie** — `manager_id` ne peut pas être l'employé lui-même, ni un de
ses subordonnés directs ou indirects. Vérification par remontée de chaîne
(profondeur max 10) avant écriture ⇒ `422 E_HIERARCHY_CYCLE`.

1.4 **Responsables éligibles** — la liste proposée comme « Manager (N+1) »
contient uniquement les employés `active` qui sont soit responsables d'un
département (`departments.manager_id`), soit déjà `manager_id` d'au moins un
employé, soit porteurs du rôle `manager`. Jamais tous les employés.

1.5 **Fin de contrat** — passer un employé à `terminated` :
clôture le contrat actif (`status='terminated'`, `end_date`), révoque ses badges
NFC, annule ses congés `pending`, retire ses rôles applicatifs, conserve
l'historique. Ses subordonnés sont rattachés à son propre manager.

1.6 **Suppression** — soft delete uniquement. Un employé supprimé disparaît des
listes mais reste référencé dans les journaux, pointages et évaluations.

1.7 **Import en masse** — le fichier (XLSX/CSV, ≤ 5 Mo, ≤ 2 000 lignes) passe par
une phase `preview` : validation ligne à ligne, détection des doublons
(matricule, e-mail), résolution des départements et managers par nom.
Le `commit` est **transactionnel et tout ou rien** ; il renvoie un rapport
`{ created, updated, skipped, errors[{ line, field, message }] }`.
Précisions (2026-11-19) : le `preview` conserve les lignes 30 min derrière un
`importToken` ; le `commit` les revalide puis écrit tout ou rien ; correspondance
par matricule puis e-mail, mise à jour des seules cellules non vides ; manager
résolu par « Prénom Nom » parmi les employés existants et les lignes du fichier.
Format détaillé : 06 §4.

## 2. Pointage

2.1 **Zones** — une zone `circle` valide si `radius_meters` ∈ [20, 5000].
Une zone `polygon` doit être fermée, non auto-intersectante, ≤ 100 points.
Le test d'appartenance : distance haversine ≤ rayon (cercle) ou algorithme
ray-casting (polygone).

2.2 **Normalisation d'UID NFC** — obligatoire avant toute comparaison :

```text
1. supprimer espaces, ':', '-', '.'
2. passer en MAJUSCULES
3. si la chaîne est hexadécimale, la conserver telle quelle
4. si elle est purement décimale (lecteurs Android renvoyant un entier),
   convertir en hexadécimal grand-boutiste, puis compléter à un nombre pair
   de caractères
5. supprimer les zéros de tête au-delà de 8 caractères
6. résultat = uid_normalized ; uid_hash = sha256(uid_normalized + NFC_UID_PEPPER)
```
Exemple : `0c:9c:6b:3e` → `0C9C6B3E`. `210872894` → `0C9C6B3E`.

2.3 **Recherche de badge** — par `uid_hash`, badge actif et non révoqué,
**dans l'organisation courante**. Un UID actif dans une autre organisation
renvoie `404 E_BADGE_UNKNOWN` (pas d'information croisée) et écrit
`nfc_badge_events(event='scan_rejected')`.

2.4 **Déduction du type** — si `type` n'est pas fourni : dernier pointage du
même employé le même jour ; absent ou `out` ⇒ `in`, sinon `out`.

2.5 **Anti-doublon** — un pointage du même employé, du même type, dans la
fenêtre `settings.timeclock.duplicateWindowSeconds` (défaut 120 s) est refusé
avec `409 E_DUPLICATE_PUNCH`. Avec `clientPunchId` déjà connu, la réponse est
idempotente : l'enregistrement existant est renvoyé en `200`.

2.6 **Contrôle de zone** — si `settings.timeclock.requireZone = true` et
qu'aucune zone active ne contient le point, le pointage est **refusé**
(`422 E_OUT_OF_ZONE`). Sinon il est accepté avec `is_within_zone = false` et
`anomaly = 'out_of_zone'`. Si `accuracy_meters > maxAccuracyMeters`, le pointage
est accepté mais marqué `anomaly = 'low_accuracy'` et n'est jamais utilisé pour
rejeter la présence.

2.7 **Hors-ligne** — `punchedAt` fourni par le client est accepté dans une
fenêtre de −72 h à +5 min par rapport à l'heure serveur ; hors fenêtre, il est
remplacé par `recorded_at` et marqué `anomaly = 'clock_drift'`.

2.8 **Agrégation quotidienne** — un job recalcule `attendance_days` :
`first_in`, `last_out`, `worked_minutes` (somme des paires in/out),
`is_complete` (nombre de pointages pair et se terminant par `out`),
`anomaly` (`missing_out` si `in` sans `out` à la clôture du jour).
Recalcul déclenché à chaque écriture de `time_logs` (débounce 60 s) et par un
job nocturne de consolidation à 23h59 heure locale.

2.9 **Correction** — seuls `owner`/`hr_admin` corrigent ou suppriment un
pointage ; l'ancienne valeur est enregistrée dans `audit_logs.before_data`.

## 3. Congés

3.1 **Décompte des jours** — `requested_days` est calculé serveur, jamais reçu
du client :
```text
jours = nombre de dates de start_date à end_date incluses
      − week-ends si settings.leave.countWeekends = false
      − jours fériés de l'organisation si countHolidays = false
      − 0,5 si halfDayStart, − 0,5 si halfDayEnd
```
Si le résultat est ≤ 0 ⇒ `422 E_VALIDATION`.

3.2 **Chevauchement** — interdit avec toute demande `pending` ou `approved` du
même employé (contrainte d'exclusion GiST + contrôle applicatif) ⇒
`409 E_LEAVE_OVERLAP`.

3.3 **Types et solde** — seuls `annual` et `special` consomment le solde.
`sick`, `maternity`, `paternity`, `unpaid` sont suivis sans déduction du solde
annuel (compteurs distincts dans `leave_balances`).

3.4 **Solde négatif** — autorisé si `settings.leave.allowNegativeBalance = true`,
dans la limite de `maxNegativeDays` (défaut 5). Au-delà ⇒
`422 E_INSUFFICIENT_BALANCE`. L'approbateur voit toujours le solde prévisionnel
avant décision.

3.5 **Cycle de vie**
```text
pending ──approve──► approved ──cancel(O/H)──► cancelled
   │                     │
   │                     └──(date passée)──► verrouillé, non annulable
   ├──reject──► rejected      (decision_comment OBLIGATOIRE, 5..1000 car.)
   └──cancel(auteur)──► cancelled
```
Aucune transition depuis `approved` vers `rejected`.

3.6 **Mouvements de solde** — à l'approbation : `taken_days += requested_days`,
`pending_days -= requested_days`, `balance_applied = true`, une ligne
`leave_balance_ledger` est écrite. À l'annulation d'un congé approuvé non
commencé : mouvement inverse. À la création : `pending_days += requested_days`.
Le solde n'est jamais modifié en dehors du ledger.

3.7 **Approbateur** — le manager direct ; à défaut (ou si le demandeur est ce
manager) un `hr_admin`, à défaut l'`owner`. Un employé ne peut jamais approuver
sa propre demande, quel que soit son rôle.

3.7 bis **Décisions d'implémentation (validées le 2026-11-19)**
- `annual` **et** `special` consomment chacun leur propre solde et sont soumis à la
  limite de solde négatif (3.3 prime sur la mention « seul le type annuel » des
  règles complémentaires). Le droit initial de `special` est 0 : sans ajustement RH
  (`/leaves/balances/adjust`), une demande `special` passe en négatif dans la limite
  de `maxNegativeDays`.
- Un solde absent pour une année est ouvert à la première utilisation avec
  `entitled_days = settings.leave.annualEntitlementDays` (`annual`) ou 0, sans prorata,
  et une ligne de ledger `entitlement`.
- Une demande est rattachée à l'année de `start_date` ; une demande à cheval sur deux
  années est refusée.
- Demi-journée : elle ne retire 0,5 que si le jour concerné est lui-même décompté.
- Ledger : une ligne à chaque mouvement (`entitlement`, `leave_requested`,
  `leave_updated`, `leave_approved` (delta 0), `leave_rejected`, `leave_cancelled`,
  ajustement) ; la somme du ledger d'un employé, d'une année et d'un type égale
  toujours le solde affiché.
- `employees.leave_balance` est un cache du solde `annual` de l'année courante,
  mis à jour dans la transaction de chaque mouvement.
- Approbateurs : tout manager ayant l'employé dans son sous-arbre, owner et
  hr_admin ; jamais l'employé lui-même.
- Annulation d'un congé approuvé : owner et hr_admin uniquement, avant son premier
  jour (fuseau de l'organisation) ; le ledger est inversé.

3.8 **Reprise annuelle** — job au 1er janvier : `carried_over_days` =
min(solde restant, `settings.leave.maxCarryOverDays`, défaut 10),
`entitled_days` réinitialisé, `taken_days` remis à 0, ligne de ledger par
employé.
Précisions (validées le 2026-11-19) : type `annual` uniquement ; les soldes étant
annuels, la ligne de l'année N est ouverte (droit plein) et reçoit le report ; un
solde N−1 négatif n'est **pas** reporté (plancher 0) ; la ligne de ledger
`carry_over` rend le job idempotent ; employés licenciés exclus.

3.9 **Statut `on_leave`** — `leaves:apply-started` passe en `on_leave` un employé
`active` ayant un congé approuvé couvrant le jour ; `leaves:end` repasse en
`active` un employé `on_leave` dont un congé approuvé s'est terminé dans les
7 derniers jours et qui n'en a aucun en cours. Un `on_leave` saisi à la main sans
congé n'est pas modifié.

## 4. Recrutement

4.1 **Publication** — passer une offre à `published` exige un titre, une
description, un type de contrat et un `slug` unique (généré serveur à partir du
titre, suffixé si collision). `published_at` est horodaté.

4.2 **Expiration** — une offre dont la `deadline` est dépassée n'apparaît plus
publiquement et refuse les candidatures (`410 E_JOB_CLOSED`), sans changer de
statut automatiquement (un job nocturne la passe en `closed` après 7 jours).

4.3 **Candidature** — anti-doublon sur `(job_id, lower(email))`. Les documents
exigés proviennent de `job.required_documents` ; une pièce manquante ⇒
`422 E_VALIDATION`. Un `candidate_events` `created` est écrit.

4.4 **Scoring IA** — déclenché **uniquement** à la soumission de la candidature,
en asynchrone, si `recruitment_webhook_configs.active_env <> 'off'` et que le
quota IA n'est pas épuisé. Il n'existe **aucune relance manuelle** : ni bouton
« scorer », ni « relancer l'analyse », ni endpoint de rejeu côté organisation.
Le payload envoyé contient l'organisation, l'offre et le candidat avec des
**URLs signées 1 h** limitées au dossier du candidat.

Réponse attendue du workflow n8n (tableau à un élément ou objet) :
```jsonc
[{ "candidate_name": "…", "is_valid_cv": true, "match_score": 0..100,
   "strengths": ["…"], "weaknesses_or_missing": ["…"],
   "summary_opinion": "…", "fraud_alert": false, "cv_url": "…" }]
```
L'ancien format (`score`, `justification`, `weaknesses`) reste accepté et
normalisé vers les mêmes colonnes. Correspondance :
`candidate_name` → `ai_candidate_name`, `is_valid_cv` → `ai_is_valid_cv`,
`match_score` → `ai_score`, `summary_opinion` → `ai_justification`,
`weaknesses_or_missing` → `ai_weaknesses`, `fraud_alert` → `ai_fraud_alert`,
`ai_scored_at = now()`.

Toute réponse non conforme est ignorée — les valeurs déjà enregistrées sont
conservées — et journalisée. Trois tentatives avec backoff exponentiel
(30 s, 5 min, 30 min) ; aucun effet de bord après échec définitif.

4.4bis **Lecture du résultat** — le score est affiché avec trois seuils :
inférieur à 40 (alerte), 40 à 69 (à surveiller), 70 et plus (favorable).
`ai_is_valid_cv = false` affiche un avertissement « document non exploitable »
et `ai_fraud_alert = true` une alerte de fraude à vérifier humainement. Ces
signaux sont **strictement indicatifs** : aucun rejet, aucune progression et
aucune notification de refus ne sont automatisés. Le CV est consultable sans
quitter la page via une **URL signée** de courte durée (15 min).

4.5 **Pipeline** — transitions autorisées :
```text
new → screening → interview → offer → hired
 └──────────────── rejected ◄──────────┘  (depuis n'importe quel état)
```
Le retour en arrière est permis à `owner`/`hr_admin` uniquement.
`hired` est terminal et déclenche la règle 4.6.

4.6 **Embauche** — `POST /candidates/:id/hire` crée un `employees` (nom, e-mail,
téléphone, poste = titre de l'offre, département de l'offre), lie
`candidates.hired_employee_id`, passe l'offre à `closed` si c'était le dernier
poste, et respecte le quota du plan (`403 E_QUOTA_EXCEEDED` sinon).

4.7 **Suppression de note** — l'auteur (s'il est staff recrutement) ou un
administrateur RH ; un `candidate_events` `note_deleted` est écrit.

## 5. Performance

5.1 **Modèle** — `organizations.performance_model` détermine l'expérience :
`classic` (objectifs pondérés) ou `okr`. Les deux jeux de données coexistent en
base ; seul l'affichage et les règles de validation diffèrent.

5.2 **Objectifs** — la somme des `weight` d'un employé sur un plan actif ne peut
dépasser 100 (`422 E_WEIGHT_OVERFLOW`). Le champ « propriétaire » n'est
proposé qu'aux managers et administrateurs ; un employé crée toujours pour
lui-même. `progress` 100 % passe automatiquement `status` à `achieved` ;
`due_date` dépassée avec `progress < 100` ⇒ `late` (job quotidien).

5.3 **Cycle de vie OKR**
```text
draft ──submit──► pending ──validate──────► validated ──(fin trimestre)──► completed
                     │                            
                     └──request_revision──► needs_revision ──submit──► pending
```
- `draft` / `needs_revision` : l'employé modifie librement objectif et résultats.
- `pending` : lecture seule pour l'employé ; le manager valide ou renvoie
  (commentaire obligatoire pour un renvoi).
- `validated` : l'objectif et les résultats clés sont figés ; seule la
  progression (`is_done`, `current_value`) et les check-ins restent modifiables.
- Un OKR sans résultat clé ne peut pas être soumis (`422`).

5.4 **Progression OKR** — `progress = round(100 × résultats terminés / total)`,
recalculé par trigger. Badges d'état côté client :
0 % ⇒ aucun badge · 1–99 % ⇒ « En cours » · 100 % ⇒ « Atteint » (succès).

5.5 **Check-ins** — au moins un check-in mensuel attendu par OKR `validated` ;
un job crée une notification de rappel le 25 de chaque mois pour les OKR sans
check-in du mois courant.

5.6 **Rôle du manager sur les OKR** — cadrer (valider ou renvoyer), suivre
(lire les check-ins, commenter), et reprendre les OKR dans l'évaluation de fin
de cycle en lecture seule. Le manager ne modifie jamais le contenu d'un OKR
validé à la place de l'employé.

5.7 **Cycle de vie d'une évaluation**
```text
not_started ─(l'employé saisit)─► in_progress ─submit_self─► submitted
    ▲                                                            │
    │                                        manager complète    │
    │                                                            ▼
 sent_back ◄──send_back(commentaire obligatoire)──── (évaluation manager)
    │                                                            │
    └─(l'employé corrige et resoumet)                    validate│
                                                                 ▼
                                                            validated
                                                                 │ sign (employé)
                                                                 ▼
                                                              signed  (terminal)
```
- Le commentaire du manager reste **visible en lecture seule par l'employé**
  dans les états `sent_back`, `validated` et `signed`.
- Les commentaires en lecture seule s'affichent en texte, jamais en champ grisé.
- `signed` est terminal : plus aucune modification, seule l'exportation PDF
  reste possible. `signed_at` et `signed_by` sont horodatés.
- Une évaluation ne peut être validée que si `manager_score` et
  `manager_global_comment` sont renseignés.

5.8 **Notifications** — ouverture du cycle, rappel J−7 avant clôture de
l'auto-évaluation, soumission (vers le manager), renvoi (vers l'employé),
validation (vers l'employé), signature (vers le manager et les RH).

5.9 **Feedback continu** — trois natures : `kudos`, `suggestion`, `concern`.
Destinataire obligatoire, expéditeur enregistré (pas d'anonymat, sauf
`is_private` qui masque l'auteur pour tous sauf les RH). Un `concern` notifie
automatiquement les RH. Le feedback alimente la synthèse IA de l'évaluation et
la matrice 9-box ; il n'est jamais supprimable par le destinataire.

5.10 **9-box** — axe performance = `performance_score` (ou moyenne des
`manager_score` des évaluations signées du cycle) ; axe potentiel =
`potential_score` saisi par les RH. Grille 3×3, seuils configurables
(défaut : 1–2 bas, 3 moyen, 4–5 haut).

## 6. Abonnements, plans et droits d'accès

6.1 **Modules** — identifiants normalisés :
`hr`, `timeclock`, `leaves`, `performance`, `recruitment`, `talents`,
`settings`, `integrations`, `api`.

6.2 **Plan gratuit / essai** — à la création d'une organisation :
`subscriptions(status='trialing', plan=free, trial_ends_at = now() + 30 jours)`.
Pendant l'essai, **tous les modules sont accessibles sauf `recruitment` et
`talents`**. À l'expiration sans paiement : `status='expired'`, accès réduit à
`hr` en lecture seule + `billing` (pour souscrire). Aucune donnée n'est
supprimée.

6.3 **Modules effectifs** — `subscriptions.modules_override` s'il est non nul,
sinon `plans.modules`. Le calcul est centralisé dans
`EntitlementService.resolve(organizationId)` et mis en cache Redis 60 s,
invalidé à tout changement d'abonnement.

6.4 **Contrôle d'accès** — `entitlement_middleware` déclaré sur chaque groupe de
routes (`.use(entitlement('recruitment'))`). Refus ⇒
`403 E_MODULE_NOT_INCLUDED` avec, dans `details`, `{ field: 'requiredModule', rule: <module> }`
et `{ field: 'currentPlan', rule: <code> }`, pour que le client propose la montée en
gamme. Abonnement suspendu ou expiré ⇒ `403 E_SUBSCRIPTION_INACTIVE`, mêmes détails. Le contrôle est **serveur uniquement** ;
masquer un menu côté client n'est pas une protection.

6.5 **Statuts d'abonnement**
| Statut | Accès |
|---|---|
| `trialing` | modules du plan d'essai, jusqu'à `trial_ends_at` |
| `active` | modules du plan, jusqu'à `current_period_end` |
| `past_due` | accès complet maintenu 7 jours de grâce, bannière d'alerte |
| `suspended` | lecture seule sur `hr`, écriture bloquée |
| `canceled` | **accès maintenu jusqu'à `current_period_end`**, puis `expired` |
| `expired` | `hr` lecture seule + `billing` |

6.6 **Annulation** — `cancel_at_period_end = true`, `canceled_at` horodaté.
L'accès n'est **jamais** coupé immédiatement. Une réactivation avant l'échéance
remet `cancel_at_period_end = false`.

6.7 **Changement de plan** — montée en gamme immédiate avec prorata calculé sur
les jours restants ; descente en gamme effective à l'échéance. Une descente est
refusée si l'effectif dépasse le `max_employees` du plan cible
(`409 E_QUOTA_EXCEEDED`, message listant le nombre d'employés à retirer).

6.8 **Crédits IA** — décrémentés dans `usage_counters` à chaque appel IA
(génération d'annonce, scoring, suggestion OKR, synthèse). Quota épuisé ⇒
`403 E_AI_QUOTA_EXCEEDED`. Réinitialisation le 1er de chaque mois.

## 7. Paiements Djomy

7.1 **Création** — `POST /billing/checkout` génère un `merchant_reference`
(uuid) et crée `payments(status='pending')` **avant** l'appel Djomy.
`expected_amount` est calculé serveur à partir du plan et du cycle ; le montant
n'est jamais accepté du client.

7.2 **Méthodes** — `orange_money` et `mtn_momo` : paiement direct via l'API
Djomy avec `payerPhone` (format guinéen `+224XXXXXXXX`), sans redirection ;
`card` : URL de portail renvoyée au client.

7.3 **Suivi** — le client interroge `GET /billing/payments/:id` toutes les 3 s,
60 fois maximum (3 min), puis affiche « en attente de confirmation ».
Le serveur ne fait jamais confiance au polling seul.

7.4 **Confirmation** — un paiement passe à `succeeded` uniquement si :
webhook signé reçu **et** vérification serveur auprès de Djomy
(`GET /transactions/:id`) confirmant l'état et le montant.
`paid_amount < expected_amount` ⇒ `status='failed'`, alerte plateforme.

7.5 **Activation** — à `succeeded` : création ou mise à jour de `subscriptions`
(`status='active'`, `current_period_start=now()`,
`current_period_end = now() + 1 mois ou 1 an`), génération de la facture,
e-mail de confirmation, entrée d'audit `payment.succeeded`.
Si l'abonnement était encore valide, la nouvelle période **prolonge** l'ancienne
au lieu de la remplacer.

7.6 **Expiration** — un paiement `pending` depuis plus de 30 minutes passe à
`expired` (job). Un paiement `expired` ne peut plus être activé même si un
webhook tardif arrive : il est journalisé pour réconciliation manuelle.

7.7 **Paiement avant inscription** — `claim_token` (hash en base) valable 7
jours, usage unique, lié à `claim_email`. La réclamation crée l'organisation et
active l'abonnement dans une seule transaction.

7.8 **Réconciliation** — job horaire comparant les `payments` non terminaux avec
l'API Djomy sur les dernières 48 h ; les écarts alimentent
`/platform/payments` avec une action manuelle `root`.

## 8. Notifications

Types émis : `leave.requested`, `leave.decided`, `review.opened`,
`review.submitted`, `review.sent_back`, `review.validated`, `review.signed`,
`okr.submitted`, `okr.validated`, `okr.needs_revision`, `okr.checkin_reminder`,
`candidate.applied`, `candidate.scored`, `contract.expiring`,
`trial.ending`, `payment.succeeded`, `payment.failed`, `badge.assigned`,
`feedback.received`.

Règles : jamais de notification à soi-même pour ses propres actions ;
regroupement des notifications identiques dans une fenêtre de 5 minutes ;
double canal (in-app systématique, e-mail selon les préférences utilisateur) ;
rétention 180 jours.

## 9. Jours fériés et calendrier guinéen

Jours fixes : 1er janvier, 3 avril (Jour de la Deuxième République),
1er mai (Fête du travail), 25 mai (Journée de l'Afrique),
15 août (Assomption), 2 octobre (Fête de l'indépendance),
1er novembre (Toussaint), 25 décembre (Noël).
Jours mobiles (`is_movable = true`, saisis chaque année) :
Laylat al-Qadr, Korité (Aïd el-Fitr), Tabaski (Aïd el-Adha), Maouloud.
Chaque organisation dispose de sa propre table ; l'import annuel copie la
référence et reste modifiable.


## Candidatures en double et crédits IA

- Avant tout appel au workflow de scoring IA (n8n), vérifier qu'aucune candidature n'existe déjà pour la même offre avec le même email (insensible à la casse) ou le même téléphone.
- Si oui : refuser avec `already_applied`, ne pas émettre d'URL d'upload, ne jamais appeler le workflow. Si la vérification échoue, ne pas appeler le workflow (fail closed).
- Délai d'attente du workflow de scoring : 180 s (analyse typique 40–60 s). Dépassement → `timeout` (message dédié), distinct de `unreachable` (panne réelle). Aucun message de résultat avant la réponse du workflow.

## Règles confirmées récemment (complément)
- Devise par défaut `GNF` pour organisations et contrats ; pas de paie, le salaire est un champ à accès restreint (05 §5).
- Création d'organisation : `performance_model = 'sap'` imposé, aucun choix proposé ; organisations existantes conservées.
- Essai gratuit 30 jours sans `recruitment` ni `talents`.
- Candidature publique : contrôle de doublon (e-mail ou téléphone, même offre) **avant** l'émission des URLs d'envoi, puis à nouveau à l'enregistrement ; un doublon ne consomme aucun crédit IA. Fichiers ≤ 2 Mo, téléphone `XXX XX XX XX`.
- Étapes candidat : `new → screening → interview → offer → hired | rejected`, changement libre entre étapes par le personnel recrutement, journalisé (`stage_changed`).
- Paiement avant inscription : le code e-mail consommé est remis à disposition si le démarrage du paiement échoue ; 5 codes par heure et par adresse.
- Solde de congé : visible par l'employé (le sien), le manager (son sous-arbre) et les RH ; seul le type `annuel` le débite ; solde négatif autorisé avec avertissement.
