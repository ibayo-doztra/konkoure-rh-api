# Retrait des boutons Scorer / Relancer l'analyse

## Objectif

Le scoring est fait uniquement par le workflow n8n à la soumission de la candidature. Aucun bouton manuel ne doit permettre de relancer l'analyse depuis l'interface.

## Changements

1. **Page Candidats** (`src/routes/_authenticated.app.recruitment.candidates.tsx`)
   - Retirer le bouton « Scorer » des cartes du kanban.
   - Retirer le bouton « Relancer l'analyse » de la modale de détail.
   - Supprimer le code associé devenu inutile (mutation, états de chargement, imports `rescoreCandidate`, toasts dédiés).
   - Le score, l'avis de synthèse, les points forts/faibles et les badges d'alerte restent affichés en lecture seule ; l'icône d'aperçu du CV est conservée.

2. **Fonction serveur** (`src/lib/recruitment-webhooks.functions.ts`)
   - Supprimer la fonction serveur `rescoreCandidate` (plus aucun appelant) pour éviter une voie de re-scoring manuel non contrôlée.

3. **Nettoyage**
   - Retirer le schéma `rescoreSchema` de `src/lib/recruitment-webhooks.server.ts` s'il n'a plus d'usage.
   - Conserver les traductions orphelines ou les nettoyer selon usage restant (`rescoreDisabled`, `rescoreFailed`).

## Hors périmètre

- Le scoring automatique à la soumission (`recordPublicApplication` → workflow n8n) reste inchangé.
- Aucune modification de schéma de base de données.
