# Mise à jour des documents backend AdonisJS et des skills IA

Aligner `docs/backend/` (00 à 14) et les skills IA sur les fonctionnalités livrées récemment : refonte du scoring CV par le workflow n8n, suppression du scoring manuel, format strict du téléphone guinéen, motif de décision des congés, cycle OKR complet et feedback continu.

## Écarts constatés

- Le schéma documenté des candidats liste `ai_score`, `ai_justification`, `ai_strengths`, `ai_weaknesses`, `ai_scored_at` mais pas les champs réellement utilisés : nom détecté par l'IA, validité du CV, alerte de fraude.
- Le contrat API expose encore une relance manuelle du scoring, alors que l'analyse est déclenchée uniquement à la soumission de la candidature.
- La forme exacte de la réponse du workflow n8n (ancienne et nouvelle) n'est décrite nulle part.
- Le téléphone est documenté comme texte libre jusqu'à 30 caractères, alors que le formulaire public et le serveur imposent `622 00 00 00` (9 chiffres, format guinéen).
- Les règles de lecture du résultat (score coloré, alerte CV invalide, aperçu du CV sans quitter la page) ne sont pas dans les règles métier.

## Modifications documentaires

### 02-schema-db.md
Compléter la table `candidates` : `ai_candidate_name`, `ai_is_valid_cv`, `ai_fraud_alert`, en gardant `ai_score`, `ai_justification`, `ai_strengths`, `ai_weaknesses`, `ai_scored_at`. Préciser que le téléphone suit le format guinéen normalisé.

### 06-api-reference.md
- Retirer la relance manuelle du scoring et indiquer que l'analyse est déclenchée à la soumission uniquement.
- Décrire le contrat du webhook de scoring : tableau ou objet, champs `candidate_name`, `is_valid_cv`, `match_score`, `strengths`, `weaknesses_or_missing`, `summary_opinion`, `fraud_alert`, `cv_url`, avec compatibilité de l'ancien format.
- Fixer la validation du téléphone au format `NNN NN NN NN`, côté public et privé.
- Documenter la réponse de lecture d'un candidat : champs IA et URL signée du CV.

### 07-regles-metier.md
Ajouter au module recrutement : scoring automatique et non rejouable manuellement, seuils d'affichage du score (moins de 40, 40 à 69, 70 et plus), traitement d'un CV jugé invalide, traitement d'une alerte de fraude, aucune décision automatique de rejet. Confirmer le motif de décision obligatoire pour les congés refusés et le cycle OKR déjà décrit.

### 08-jobs-events-integrations.md
Clarifier le déclenchement du scoring par l'événement de candidature, l'idempotence, la conservation des valeurs précédentes en cas de réponse invalide, et l'accès au CV par URL signée à durée limitée.

### 12-migration-donnees.md
Ajouter les nouveaux champs IA à la correspondance des candidats.

### 14-skills-ia-claude-code.md
Mettre à jour les déclencheurs du skill recrutement (validité du CV, alerte de fraude, format téléphone) sans changer la structure du catalogue.

### Skills IA
Mettre à jour `.claude/skills/konkoure-recruitment/SKILL.md` et son miroir `docs/backend/skills/konkoure-recruitment/SKILL.md` : scoring déclenché uniquement à la soumission, invariants sur les champs IA, alerte de fraude, format téléphone, aucun rejet automatique. Ajouter au skill `konkoure-api-contracts` la règle de validation du téléphone guinéen. Vérifier que les autres skills restent cohérents.

## Hors périmètre

Aucun code applicatif, aucune migration, aucun changement de comportement produit : la livraison est uniquement documentaire.
