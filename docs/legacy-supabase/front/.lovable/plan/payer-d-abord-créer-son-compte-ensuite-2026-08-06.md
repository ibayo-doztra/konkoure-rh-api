# Payer d'abord, créer son compte ensuite

Objectif : un visiteur qui n'a pas encore de compte peut choisir une offre depuis la landing, payer immédiatement (Orange Money, MTN MoMo ou carte), puis créer son compte et son organisation. L'abonnement payé est automatiquement rattaché à l'organisation créée.

## Parcours cible

```text
Landing (offre) → /paiement (public)
   choix offre + cycle + email + téléphone + moyen de paiement
        → paiement OM/MoMo sur le téléphone  (ou redirection carte)
        → paiement confirmé : reçu + code de rattachement
   → /signup?claim=<code>  (email pré-rempli, non modifiable)
   → /onboarding/organization
        → organisation créée : l'abonnement payé est appliqué (offre, cycle, période)
   → /app  avec l'offre déjà active
```

## Ce qui change

### 1. Paiements sans organisation
Aujourd'hui un paiement exige une organisation existante (`subscription_payments.org_id` obligatoire).
- `org_id` devient facultatif ; ajout de `claim_token`, `claim_email`, `claimed_at`.
- Contrainte : un paiement doit avoir soit une organisation, soit un email + jeton de rattachement.
- L'activation de l'abonnement (mise à jour de l'offre de l'organisation) ne s'exécute que si le paiement est déjà rattaché à une organisation ; sinon le paiement reste « payé, en attente de rattachement ».

### 2. Page de paiement publique `/paiement`
Reprend l'interface existante de la page de paiement interne (choix d'offre, bascule mensuel/annuel, montant en GNF, 3 moyens de paiement, suivi du statut), avec en plus un champ e-mail obligatoire.
- Mobile Money : validation sur le téléphone, la page interroge le statut jusqu'à confirmation.
- Carte : redirection vers le portail sécurisé, retour sur `/paiement/retour?ref=…`.
- Une fois confirmé : écran de succès avec le code de rattachement, bouton « Créer mon compte » vers `/signup?claim=<code>`, et rappel de conserver le code.

### 3. Inscription et création d'organisation
- `/signup` accepte `?claim=` : e-mail pré-rempli à partir du paiement, bandeau « Offre X déjà réglée », le code est conservé pendant tout le parcours (stockage de session, comme l'offre en attente aujourd'hui).
- Après création de l'organisation dans l'onboarding, appel d'une fonction serveur de rattachement : vérifie que le paiement est réglé, non déjà rattaché, et que l'e-mail du paiement correspond à celui du compte connecté ; puis rattache le paiement à l'organisation et active l'offre (offre, cycle, `periode_fin`).
- Si le code est absent ou invalide : le parcours actuel reste inchangé (organisation créée en offre d'essai).

### 4. Landing
Les boutons d'offre proposent, pour un visiteur non connecté, « Payer et créer mon compte » vers `/paiement?plan=…&cycle=…`. Le comportement pour un utilisateur déjà connecté reste inchangé (page de paiement interne).

## Détails techniques

- Migration : `ALTER TABLE public.subscription_payments` → `org_id` nullable, colonnes `claim_token uuid`, `claim_email text`, `claimed_at timestamptz`, index unique sur `claim_token`, `CHECK (org_id IS NOT NULL OR (claim_email IS NOT NULL AND claim_token IS NOT NULL))`. Aucune nouvelle policy publique : tout passe par des fonctions serveur avec client admin. Les lectures anonymes restent interdites.
- `src/lib/billing.server.ts` : `startAnonymousPayment` (offre + cycle + e-mail + méthode, montant recalculé depuis la table `plans`), `getClaimSummary(token)` (renvoie uniquement offre, cycle, statut, e-mail masqué), `claimPayment({ token, orgId, userId })`.
- `src/lib/djomy.server.ts` : `settlePayment` ne déclenche l'activation d'organisation que si `org_id` est renseigné ; sinon simple passage en `success`. L'activation est factorisée pour être réutilisée par le rattachement.
- Nouvelles fonctions serveur publiques (sans authentification) dans un fichier dédié `src/lib/public-billing.functions.ts` : création du paiement, consultation du statut par référence, résumé d'un code de rattachement. Validation Zod stricte (e-mail, téléphone guinéen 9 chiffres, offre parmi la liste), limitation simple par référence pour éviter les abus. Le rattachement, lui, exige une session authentifiée.
- Nouvelles routes publiques : `src/routes/paiement.index.tsx` et `src/routes/paiement.retour.tsx`, avec `head()` propre (titre, description, `noindex`).
- Réutilisation des composants existants de la page de paiement interne en extrayant la carte de récapitulatif/choix de moyen de paiement dans `src/components/billing/` afin de ne pas dupliquer la logique.
- Webhook Djomy inchangé : il continue de régler le paiement, y compris sans organisation.
