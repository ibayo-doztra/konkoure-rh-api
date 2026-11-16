# Archive Supabase / Lovable — référence fonctionnelle uniquement

Ce dossier contient l'ancien backend Supabase de Konkouré, retiré du frontend
(`konkoure-rh-front`) le 2026-11-16. Il sert de **référence fonctionnelle** pour
implémenter l'API AdonisJS. Ce n'est **pas** l'architecture cible : ne rien
copier tel quel, ne rien exécuter, ne rien importer depuis `app/`.

| Dossier | Contenu | Utile pour |
|---|---|---|
| `supabase/migrations/` | Schéma SQL, politiques RLS, fonctions (`record_punch`, `set_leave_request_status`, `compute_working_days`…) | Règles métier et contraintes à reproduire (voir `docs/backend/15-inventaire-supabase.md`) |
| `supabase/functions/` | Edge Functions IA (`ai-score-cv`, `ai-generate-job`, `ai-suggest-okr`…) | Prompts et flux IA |
| `front/src/lib/*.functions.ts` | Server functions TanStack (validation Zod, contrôles d'autorisation, appels base) | Entrées attendues par les écrans, règles d'autorisation |
| `front/src/lib/*.server.ts` | Djomy, e-mails, audit, entitlements, pointage, webhooks recrutement | Intégrations fournisseurs |
| `front/src/routes/api.public.*` | Endpoints HTTP publics (webhook Djomy, badge, OAuth social, cron) | Webhooks et jobs planifiés |
| `front/src/integrations/supabase/types.ts` | Types générés de la base Supabase | Correspondance des colonnes |
| `front/.lovable/` | Plans de modification Lovable (historique des décisions) | Contexte des règles produit |

La correspondance entre ces fonctions et les endpoints cibles est dans
`konkoure-rh-front/docs/frontend/03-integration-api.md` et, côté écrans, dans
`konkoure-rh-front/src/lib/api/legacy-functions.ts`. En cas de contradiction,
`docs/backend/` fait foi.
