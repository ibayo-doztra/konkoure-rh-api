# 08 — Jobs, événements et intégrations

## 1. Infrastructure de files

BullMQ sur Redis (base logique dédiée). Un processus **worker** séparé du
processus HTTP (`node ace queue:work`), scalable indépendamment.

| File | Concurrence | Priorité | Contenu |
|---|---|---|---|
| `critical` | 10 | 1 | webhooks paiement, activation d'abonnement |
| `default` | 20 | 5 | e-mails, notifications, agrégats |
| `ai` | 4 | 5 | scoring CV, génération d'annonce, suggestions OKR, synthèses |
| `outbound` | 5 | 5 | webhooks sortants, publications sociales |
| `maintenance` | 2 | 9 | purges, partitions, exports, réconciliation |

Politique commune : 3 à 5 tentatives, backoff exponentiel (base 30 s, plafond
1 h), `removeOnComplete: 1000`, `removeOnFail: 5000`.
Les jobs portant un lien à usage unique (`mail.send`) ne sont pas conservés dans Redis
après leur fin. `QUEUE_DRIVER=sync` exécute les jobs dans le processus, sans worker
(développement et tests) ; la production utilise `bullmq`.
Tout job est **idempotent** : il vérifie l'état cible avant d'agir.
Échec définitif ⇒ écriture dans `system_logs` niveau `error` + alerte.

## 2. Tâches planifiées

| Fréquence (heure locale) | Tâche | Effet |
|---|---|---|
| Toutes les 5 min | `payments:poll-pending` | Vérifie auprès de Djomy les paiements `pending` de moins de 30 min |
| Toutes les 15 min | `attendance:consolidate` | Recalcule `attendance_days` modifiés |
| Toutes les heures | `payments:reconcile` | Rapproche les 48 dernières heures : un paiement `failed`/`expired` payé chez Djomy reçoit `failure_reason = 'remote_succeeded'` et une alerte (action manuelle `root`, lot 10) |
| Toutes les heures | `payments:expire` | `pending` > 30 min ⇒ `expired` |
| 00h05 | `leaves:apply-started` | Marque les congés commençant aujourd'hui, passe l'employé en `on_leave` |
| 00h10 | `leaves:end` | Repasse en `active` les employés dont le congé s'achève |
| 00h20 | `goals:mark-late` | Objectifs échus non atteints ⇒ `late` |
| 00h30 | `jobs:auto-close` | Offres expirées depuis 7 jours ⇒ `closed` |
| 01h00 | `subscriptions:lifecycle` | Fin d'essai, échéances, `past_due`, `expired`, descente programmée, notification `trial.ending` J−7/J−1 aux owners (une fois par échéance) |
| 02h00 | `contracts:expiring` | Notifie les contrats arrivant à terme dans 30 jours |
| 03h00 | `retention:purge` | Applique les durées de rétention (05 §13) |
| 03h30 | `partitions:ensure` | Crée 3 mois de partitions à l'avance, détache celles > 24 mois |
| 04h00 | `usage:rollup` | Agrège `usage_events` du jour |
| 23h59 | `attendance:close-day` | Clôt la journée, détecte `missing_out` |
| Le 1er à 00h15 | `ai_credits:reset` | Remet à zéro les compteurs mensuels |
| Le 25 à 09h00 | `okr:checkin-reminder` | Rappel de check-in mensuel |
| 1er janvier 00h30 | `leaves:annual-rollover` | Report et réinitialisation des soldes |
| Lundi 08h00 | `reviews:reminders` | Rappels d'évaluations en retard : auto-évaluation non soumise dont la fermeture tombe dans les 7 jours ou est passée, et évaluations soumises en attente du manager (cycles ouverts) ; notification `review.reminder` |

Ordonnancement via `@adonisjs/scheduler` ou BullMQ repeatable jobs, avec
**verrou Redis** pour éviter les exécutions concurrentes en multi-réplicas.
**Retenu** : *job schedulers* BullMQ (`SCHEDULES` dans `app/shared/queue/jobs.ts`,
fuseau `Africa/Conakry`), déclarés au démarrage de `node ace queue:work` ; Redis
n'enfile qu'une occurrence par échéance, quel que soit le nombre de workers.
Chaque tâche parcourt les organisations, chacune dans sa transaction et son fuseau.
`partitions:ensure` est en place pour `time_logs` (mois courant + 3) ; un mois dont
des lignes sont déjà dans la partition `DEFAULT` est signalé en erreur, pas créé.
Exécution manuelle (développement, rattrapage) : `node ace schedule:run <job>`
(ex. `leaves.end`, `contracts.expiring`).
`attendance:*` (2026-11-20) : après le commit d'un pointage, d'une correction (ancien
et nouveau jour) ou d'une suppression, le jour local est ajouté à l'ensemble Redis
`attendance:dirty` et un job `attendance.recompute` est mis en file avec
`jobId = attendance_<org>_<employé>_<jour>` et `delay` 60 s (débounce : BullMQ ignore
un job de même id en attente). `attendance:consolidate` recalcule ce qui reste dans
l'ensemble ; `attendance:close-day` clôt les jours incomplets d'aujourd'hui et d'hier
(rattrapage). En `sync`, le recalcul est immédiat.
`notifications.purge` (03h00, 2026-11-20) applique la rétention de 180 jours des
notifications (première brique de `retention:purge`). Les notifications in-app sont
écrites après le commit par les services émetteurs (congés, contrats, badges), dans leur
propre transaction ; un échec est journalisé, jamais remonté.
`contracts:expiring` couvre tous les contrats `active` finissant dans les 30 jours
(fuseau de l'organisation), pour rattraper une nuit manquée ; un marqueur Redis par
contrat et date de fin garantit un seul e-mail `contract_expiring`, envoyé aux
`hr_admin`, à défaut aux `owner`.

## 3. Événements applicatifs

Émis par les services via `emitter.emit(...)`, consommés par des listeners
qui se contentent de **mettre en file** (jamais de traitement lourd en ligne).

| Événement | Charge utile | Listeners |
|---|---|---|
| `user:registered` | userId | e-mail de vérification |
| `user:invited` | invitationId | e-mail d'invitation |
| `employee:created` | employeeId | audit, notification RH |
| `leave:requested` | leaveId | notification approbateur, e-mail |
| `leave:decided` | leaveId, decision | notification demandeur, ledger |
| `punch:recorded` | timeLogId | agrégat `attendance_days` (débounce) |
| `badge:assigned` \| `badge:revoked` | badgeId | audit, notification employé |
| `candidate:applied` | candidateId | scoring IA, notification recruteurs |
| `candidate:scored` | candidateId | notification, `candidate_events` |
| `candidate:hired` | candidateId | création d'employé, audit |
| `okr:submitted` \| `okr:validated` \| `okr:revision_requested` | okrId | notifications |
| `review:*` (opened, submitted, sent_back, validated, signed) | reviewId | notifications, e-mails |
| `feedback:created` | feedbackId | notification, alerte RH si `concern` |
| `payment:succeeded` \| `payment:failed` | paymentId | activation, facture, e-mail |
| `subscription:changed` | subscriptionId | invalidation du cache d'entitlements |
| `job:published` | jobId | publication sociale si demandée |

## 4. E-mails transactionnels (Resend)

Transport HTTP Resend via `@adonisjs/mail`. Expéditeur par défaut
`Konkouré <no-reply@doztra.com>`, `Reply-To` = e-mail de support de
l'organisation quand il existe.

| Gabarit | Déclencheur | Destinataire | Variables |
|---|---|---|---|
| `verify_email` | inscription | utilisateur | lien, expiration |
| `reset_password` | mot de passe oublié | utilisateur | lien, expiration |
| `invitation` | invitation | invité | organisation, rôle, lien, inviteur |
| `leave_requested` | demande | approbateur | demandeur, dates, jours, solde |
| `leave_decided` | décision | demandeur | décision, motif |

Destinataires des congés : `leave_requested` va au manager direct s'il a un compte
actif, sinon à tous les `hr_admin`, sinon aux `owner` ; `leave_decided` (approbation
ou refus) va au compte de l'employé. Jamais à l'auteur de l'action (07 §8). Envoi
après commit ; les notifications in-app viendront avec la table `notifications`.
| `review_opened` | ouverture de cycle | employé | cycle, échéance |
| `review_sent_back` | renvoi | employé | commentaire du manager |
| `review_signed` | signature | manager + RH | employé, date |
| `candidate_applied` | candidature | recruteurs | offre, candidat |
| `application_received` | candidature | candidat | offre, organisation |
| `payment_succeeded` | paiement | owner | plan, montant, période, facture |
| `payment_failed` | échec | owner | motif, lien de réessai |
| `trial_ending` | J−7 et J−1 | owner | date de fin, lien d'abonnement |
| `contract_expiring` | J−30 | RH | employé, date de fin |
| `demo_request` | demande de démo | `bayo.ibrahima@doztra.com` | société, taille, message, contact |

Chaque gabarit existe en **français et en anglais** (langue de l'utilisateur,
à défaut langue de l'organisation, à défaut `fr`). Version texte brut fournie.

Suivi de délivrabilité : le webhook Resend met à jour `email_status`,
`email_sent_at`, `email_error` sur les enregistrements concernés
(notamment `demo_requests`).
Trois tentatives d'envoi ; échec définitif ⇒ `system_logs` + alerte.

## 5. Webhooks

### Entrants

`POST /webhooks/djomy/:token` (décision du 2026-11-24 : format réel de Djomy,
qui n'envoie pas d'horodatage) :
1. jeton de chemin `DJOMY_WEBHOOK_PATH_TOKEN`, puis corps brut → HMAC-SHA256 avec
   `DJOMY_CLIENT_SECRET` comparé à `X-Webhook-Signature` (`v1:<hex>`),
   `timingSafeEqual` ;
2. anti-rejeu par `event_id` (pas d'horodatage chez Djomy) ;
3. `webhook_receipts` avec `UNIQUE(provider, event_id)` ;
4. mise en file `critical` ;
5. réponse `200` immédiate ;
6. le worker vérifie l'état auprès de l'API Djomy avant d'activer quoi que ce
   soit (07 §7.4).

`POST /webhooks/n8n/scoring` : même schéma, secret par organisation, charge
utile validée par `n8nResponseSchema`, qui accepte un **tableau à un élément ou
un objet** et normalise l'ancien et le nouveau format :
`candidate_name`/`is_valid_cv`/`match_score`/`strengths`/
`weaknesses_or_missing`/`summary_opinion`/`fraud_alert`/`cv_url`, ou
`score`/`justification`/`weaknesses` (héritage). Score borné 0–100, listes
bornées, chaînes tronquées.

Règles de traitement :
- le scoring est déclenché par l'événement `candidate:applied` uniquement ;
- idempotence par candidat : un résultat plus récent écrase, une charge utile
  invalide **conserve** les valeurs existantes et journalise l'erreur ;
- `cv_url` reçu n'est jamais stocké tel quel comme lien public : le CV reste
  accessible par URL signée de courte durée (15 min) générée à la demande ;
- aucune transition de pipeline ni notification de refus n'est automatisée.

`POST /webhooks/resend` : mise à jour des statuts d'e-mail.

### Sortants

Configurés par organisation (`recruitment_webhook_configs`), environnements
`off` / `test` / `prod`. Chaque appel :
`validateOutboundUrl()` (05 §10) → signature HMAC → timeout 20 s →
`redirect: manual` → réponse plafonnée à 256 Ko → 3 tentatives.
Un endpoint `POST /org/recruitment/webhooks/ping` envoie un événement de test
`webhook.ping` et renvoie le diagnostic (code HTTP, latence, erreur).

## 6. Stockage de fichiers

`@adonisjs/drive`, driver S3 compatible. Deux espaces :

| Bucket | Visibilité | Contenu |
|---|---|---|
| `public-assets` | public | logos d'organisation, images d'offres |
| `private-docs` | privé | CV, lettres, passeports, contrats, pièces de congé, factures |

Chemins : `<bucket>/<organizationId>/<domaine>/<ownerId>/<uuidv7>.<ext>`.
Accès privé exclusivement par **URL signée TTL 15 min** (1 h pour les envois
vers n8n), générée après autorisation Bouncer, et journalisée pour les documents
sensibles.

Hors production, `FILE_STORAGE_DISK=fs` (ajouté le 2026-11-23, refusé au démarrage
en production) envoie les deux espaces sur le disque local `storage/` et sert les
liens signés sous `/uploads/*` : environnements sans S3, comme les tests de bout en
bout du front. Par défaut (`s3`), rien ne change.

Upload : taille et MIME réels vérifiés (05 §3), checksum SHA-256 stocké,
entrée dans `files`. Les fichiers orphelins (aucun propriétaire après 24 h)
sont supprimés par le job de maintenance. Analyse antivirus optionnelle
(`FILE_SCAN_ENABLED`) : tant que `scanned_at` est nul, le fichier n'est pas
téléchargeable.

## 7. Intelligence artificielle

Passerelle unique `AiService` (`app/modules/integrations/services/ai_service.ts`),
fournisseur configurable (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`). Décision du
2026-11-24 : OpenAI via le SDK `openai`, sorties structurées (`json_schema` strict)
puis validation VineJS. `job.generate`, `okr.suggest` et `review.summary` sont
livrés ; `social.post` reste pour le lot intégrations. Un job dont la dernière
tentative échoue peut déclarer un crochet `failed` (ex. rendre le crédit du scoring).

| Usage | Entrée | Sortie attendue | Coût |
|---|---|---|---|
| `job.generate` | titre, département, contrat, notes | description + prérequis structurés | 1 crédit |
| `candidate.score` | offre + CV (texte extrait) | score, justification, forces, faiblesses | 1 crédit |
| `okr.suggest` | objectif, contexte | 3 à 5 résultats clés SMART (JSON) | 1 crédit |
| `review.summary` | auto-évaluation, évaluation manager, objectifs | synthèse ≤ 250 mots | 1 crédit |
| `social.post` | offre, réseau | texte + hashtags | 1 crédit |

Règles : sortie **JSON strictement validée** par VineJS ; toute réponse non
conforme est rejetée et retentée une fois, puis abandonnée sans effet de bord ;
timeout 45 s ; aucune donnée sensible (salaire, pièce d'identité, UID de badge)
n'est envoyée au fournisseur ; les prompts sont versionnés dans
`app/modules/integrations/prompts/` ; chaque appel écrit un `usage_events`
(`kind='ai'`, module, coût) et décrémente `usage_counters`.

## 8. Réseaux sociaux

OAuth par organisation (Facebook, LinkedIn, X). Tokens chiffrés
(`APP_KEY`), rafraîchis par un job quotidien ; en cas d'échec le compte passe
`expired` et une notification part vers les administrateurs.
Publication : file `outbound`, statut `pending → published | failed`,
`external_post_id` et `external_url` conservés, message d'erreur en clair pour
diagnostic. Aucun jeton n'est jamais renvoyé par l'API.

## 9. Exports

Exports volumineux (employés, pointages, journaux) traités en asynchrone :
`POST …/export` renvoie `202` + `jobId` ; le fichier est déposé dans
`private-docs`, une notification et un e-mail contiennent une URL signée
valable 24 h. Formats CSV (UTF-8 BOM) et XLSX. Limite : 5 exports/h/utilisateur.
Employés : job `employees.export` (file `maintenance`), fichier enregistré dans
`files` (`owner_type = 'employee_export'`), e-mail au demandeur ; aucune
notification in-app tant que la table `notifications` n'existe pas.
Pointages : job `time-logs.export` (file `maintenance`), au plus 366 jours et
1 000 000 de lignes, écrit en flux (CSV ou `exceljs` en mode streaming) puis déposé
avec `owner_type = 'time_log_export'` (06 §6, décision du 2026-11-20).
XLSX lu et écrit avec `exceljs` (dépendance validée le 2026-11-19 ; `uuid` forcé
en 11.x par `pnpm-workspace.yaml`, GHSA-w5hq-g745-h8pq).
