# Suivi en temps réel du paiement Djomy

Objectif : à tout moment — avant comme après la création du compte — l'utilisateur peut voir l'état de son paiement (en attente, confirmé, échoué/annulé, rattaché) grâce à un bloc de suivi unique réutilisé partout.

## Ce qui existe déjà

- `/paiement` interroge le statut toutes les 3 s, mais uniquement tant que l'onglet reste ouvert après le clic sur « Payer ».
- `/paiement/retour` fait de même au retour du paiement par carte.
- Le code de rattachement est mémorisé (session + local storage) et appliqué à la création de l'organisation.

Manque : une page consultable à tout moment avec le code de rattachement, et un rappel de l'état du paiement une fois le compte créé.

## Ce qui est ajouté

### 1. Bloc de suivi réutilisable
Un composant `PaymentStatusTracker` (dans `src/components/billing/`) affichant :
- une frise en 3 étapes : Paiement initié → Paiement confirmé → Abonnement rattaché ;
- un badge d'état coloré (en attente / confirmé / échoué / annulé / montant incohérent / rattaché) ;
- l'offre, le cycle, le montant, l'e-mail masqué, le code de rattachement (copiable) ;
- le compteur d'attente et un bouton « Actualiser » manuel ;
- l'action contextuelle : « Créer mon compte » si payé et non rattaché, « Réessayer le paiement » si échoué, « Voir mon abonnement » si rattaché.

Rafraîchissement automatique toutes les 3 s tant que le paiement est en attente (arrêt au bout de 3 minutes, puis rafraîchissement manuel), et arrêt immédiat dès un état final.

### 2. Page publique `/paiement/suivi`
Accessible avec `?claim=<code>` (ou en saisissant le code dans un champ si le paramètre est absent, avec pré-remplissage depuis le code mémorisé dans le navigateur). Elle affiche le bloc de suivi. Titre et description propres, `noindex`.

Les pages `/paiement` et `/paiement/retour` remplacent leur affichage de statut actuel par ce bloc et proposent le lien « Suivre ce paiement » (à conserver / partager).

### 3. Après création du compte
- Sur `/signup` avec un code : bandeau existant enrichi de l'état réel du paiement (le même bloc en version compacte).
- Sur l'onboarding organisation : si le rattachement échoue (paiement encore en attente, e-mail différent, déjà rattaché), le motif est affiché explicitement avec un lien vers `/paiement/suivi`.
- Sur `/app/billing` : si un code de rattachement non consommé est mémorisé dans le navigateur, affichage du bloc de suivi en haut de page avec un bouton « Rattacher à mon organisation » qui rejoue le rattachement, puis nettoyage du code.

## Détails techniques

- `src/lib/billing.server.ts` : `getClaimSummary` renvoie en plus `merchantReference`, `amount`, `currency`, `createdAt`, `planCode` et le motif de non-rattachement ; ajout d'un helper `syncClaimStatus(admin, claimToken)` qui retrouve la référence puis appelle `syncPaymentStatus` avant de renvoyer le résumé.
- `src/lib/public-billing.functions.ts` : `getPrepaidSummary` accepte un indicateur `refresh` et passe par `syncClaimStatus` ; validation Zod inchangée (jeton UUID). Aucune donnée sensible supplémentaire n'est exposée (e-mail toujours masqué, pas d'identifiant Djomy).
- Nouvelle route `src/routes/paiement.suivi.tsx` (publique, SSR, `head()` avec `robots: noindex`), qui n'appelle que des fonctions serveur publiques — pas de `requireSupabaseAuth` dans un loader.
- Le bloc de suivi vit dans `src/components/billing/PaymentStatusTracker.tsx` et réutilise les primitives de `checkout-shared.tsx` (formatage GNF, libellés d'offre). Un hook `usePaymentClaimStatus(claimToken)` centralise le polling pour éviter la duplication actuelle entre `/paiement` et `/paiement/retour`.
- Tokens sémantiques uniquement pour les couleurs d'état (`bg-success`, `bg-warning`, `bg-destructive`, `text-muted-foreground`), pas de classes de couleur codées en dur.
- Aucune migration de base de données n'est nécessaire.
