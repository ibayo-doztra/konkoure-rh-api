# Messages d'erreur de formulaire bilingues (FR/EN)

Aujourd'hui, les libellés des champs suivent la langue active, mais les messages de validation restent figés en français ("Nom trop court", "Téléphone requis", et le message brut de Zod pour la taille d'entreprise). En anglais, le formulaire affiche donc un mélange de langues.

## Ce qui change

- Tous les messages d'erreur de validation s'affichent dans la langue active (FR ou EN), y compris ceux qui viennent de la liste déroulante "Taille de l'entreprise" (aujourd'hui un message technique du type "Invalid enum value...").
- Les messages d'erreur affichés en toast (échec d'envoi, erreur inattendue) suivent aussi la langue active.
- Le changement de langue met immédiatement à jour les erreurs déjà affichées.

## Périmètre

Formulaire de demande de démo (`/demo`) en priorité, avec une base réutilisable pour les autres formulaires publics (inscription, candidature carrière, paiement) au fur et à mesure.

## Détails techniques

- `src/lib/demo-requests.schema.ts` : transformer le schéma en fabrique `createDemoRequestSchema(lang)` avec un dictionnaire de messages FR/EN (`min`, `max`, `email`, enum invalide via `errorMap`). Conserver un export par défaut FR pour la validation serveur dans `src/lib/demo-requests.functions.ts`, qui reste la source de vérité côté sécurité.
- `src/routes/demo.tsx` : utiliser `createDemoRequestSchema(lang)` (lang issu de `useLandingCopy`) dans le `safeParse`, ajouter les clés de toast (succès/erreur) dans le bloc `TEXT` déjà présent, et revalider/vider les erreurs quand `lang` change.
- Aucune modification de base de données ni de logique métier.
