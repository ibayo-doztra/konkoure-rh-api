# Refonte du scoring des CV (recrutement)

## Objectif

Exploiter le résultat complet renvoyé par le workflow n8n, le stocker en base et l'afficher clairement sur la page Candidats, avec lecture du CV sans quitter la page.

## Ce que le workflow renvoie

Nom du candidat, validité du document, note d'adéquation, points forts, points faibles ou manquants, avis de synthèse, alerte de fraude, lien vers le CV.

## Stockage

Les nouvelles informations sont enregistrées pour chaque candidature :

- note d'adéquation (0–100)
- avis de synthèse (justification)
- liste des points forts
- liste des points faibles ou manquants
- document conforme : oui/non
- alerte de fraude : oui/non
- nom du candidat tel que lu dans le CV
- date de l'analyse

Les anciennes candidatures déjà scorées gardent leur note et leur justification actuelles.

## Affichage — page Candidats (kanban conservé)

Les colonnes par étape restent inchangées.

Sur chaque carte :
- nom complet et poste visé
- note d'adéquation avec code couleur (rouge < 40, orange 40–69, vert ≥ 70)
- badge d'alerte rouge « Document non conforme » et/ou « Suspicion de fraude » le cas échéant
- icône permettant d'ouvrir le CV

Dans la fiche détaillée (modale) :
- nom complet, téléphone, e-mail, poste visé
- note d'adéquation en évidence
- avis de synthèse
- points forts en liste
- points faibles ou manquants en liste
- badges d'alerte s'il y a lieu
- bouton de relance de l'analyse

## Lecture du CV

Une icône ouvre une fenêtre d'aperçu au-dessus de la page affichant le PDF (ou l'image) directement, avec un bouton de téléchargement. Aucune navigation, la page reste en place. L'accès au fichier passe par un lien temporaire signé, réservé au personnel de recrutement de l'organisation.

## Détails techniques

- Migration : ajout sur `public.candidates` de `ai_strengths jsonb`, `ai_weaknesses jsonb`, `ai_is_valid_cv boolean`, `ai_fraud_alert boolean`, `ai_candidate_name text`, `ai_scored_at timestamptz`. Valeurs par défaut non nulles pour les tableaux, GRANT inchangés (table existante), pas de nouvelle politique nécessaire.
- `src/lib/recruitment-webhooks.server.ts` : `n8nResponseSchema` remplacé par un schéma tolérant qui accepte le nouveau format (`match_score`, `summary_opinion`, `weaknesses_or_missing`, `is_valid_cv`, `fraud_alert`, `candidate_name`, `cv_url`) et conserve la compatibilité avec l'ancien (`score`, `justification`, `weaknesses`). `runCandidateScoring` retourne l'objet normalisé complet.
- `src/lib/recruitment-webhooks.functions.ts` : `recordPublicApplication` insère les nouveaux champs au lieu de concaténer forces/faiblesses dans `ai_justification`.
- Fonction serveur de re-scoring (bouton « Relancer l'analyse ») : mise à jour des mêmes colonnes, activité `scored` journalisée.
- Nouveau composant `src/components/recruitment/CvPreviewDialog.tsx` : signature d'URL puis rendu en `<iframe>` pour les PDF, `<img>` pour les images, avec téléchargement.
- `src/routes/_authenticated.app.recruitment.candidates.tsx` : cartes enrichies, modale de détail réécrite sur les nouveaux champs, icône CV branchée sur l'aperçu.
- Traductions FR/EN ajoutées dans `src/locales/{fr,en}/hrm.ts`.
- Tokens sémantiques uniquement ; modales au standard DialogContent > DialogHeader + DialogBody.
