# Bouton « Demander une démo » + page de demande

## Ce qui change

1. Le bouton secondaire du hero passe de « Voir la démo » à « Demander une démo » (EN : « Request a demo ») et pointe vers une nouvelle page `/demo` au lieu de l'ancre `#modules`.
2. Nouvelle page publique `/demo` avec le même en-tête/pied de page que la landing (logo cliquable, thème clair/sombre) et un formulaire :
   - Nom complet
   - Email professionnel
   - Téléphone (optionnel)
   - Nom de l'entreprise
   - Taille de l'entreprise (liste : 1-10, 11-50, 51-200, 201-500, 500+)
   - Message : description du besoin
3. À l'envoi : enregistrement de la demande en base, message de succès (toast + état « demande envoyée »), formulaire réinitialisé.

## Détails techniques

- **Base de données** : table `public.demo_requests` (id, created_at, full_name, email, phone, company_name, company_size, message, status). RLS activée : INSERT autorisé pour `anon` et `authenticated` (formulaire public), lecture réservée aux administrateurs plateforme. GRANT explicites pour `anon`, `authenticated`, `service_role`.
- **Validation** : schéma Zod partagé (longueurs max, email valide, taille dans l'énumération) appliqué côté client et de nouveau côté serveur dans la fonction serveur d'insertion (`src/lib/demo-requests.functions.ts`).
- **Route** : `src/routes/demo.tsx` (`createFileRoute("/demo")`) avec `head()` dédié (title, description, og:title, og:description, og:type, twitter:card).
- **Copie** : textes FR/EN ajoutés dans `src/lib/landing/copy.ts` ; `hero.ctaSecondary` mis à jour.
- **UI** : composants shadcn existants (Input, Textarea, Select, Button, Card) et tokens sémantiques uniquement ; boutons d'action conformes au standard du projet.
