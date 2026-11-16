# Page de paiement Konkouré (sans portail Djomy pour le Mobile Money)

## Objectif

Garder le paiement Djomy en place, mais réaliser le parcours Orange Money et MTN MoMo
entièrement sur une page Konkouré : choix de l'offre, du cycle, du moyen de paiement,
saisie du numéro, puis suivi en direct de la validation (le client confirme sur son téléphone).
La carte Visa/Mastercard continue de passer par la page sécurisée Djomy (3‑D Secure obligatoire).

## Parcours utilisateur

```text
Landing (offres)            Paramètres > Abonnement
        |                              |
   non connecté                    connecté
        |                              |
   /signup (offre + cycle mémorisés)   |
        |                              |
        +---------> /app/billing/checkout?plan=…&cycle=… <---------+
                              |
        Récapitulatif offre + montant GNF + choix du moyen
                              |
      +-----------------------+------------------------+
      | Orange Money / MTN MoMo                        | Carte
      | Saisie du numéro -> demande envoyée            | Redirection page Djomy
      | Écran d'attente : « Validez sur votre          |
      | téléphone », statut rafraîchi automatiquement  |
      +-----------------------+------------------------+
                              |
                    Succès / Échec -> retour Abonnement
```

## Ce qui est construit

1. **Nouvelle page `/app/billing/checkout`**
   - Résumé de l'offre choisie (nom, cycle, montant GNF, 2 mois offerts en annuel).
   - Sélecteur de cycle mensuel/annuel.
   - Trois moyens de paiement : Orange Money, MTN MoMo, Carte Visa/Mastercard.
   - Champ numéro guinéen (9 chiffres) validé pour le Mobile Money.
   - Écran d'attente intégré : compte à rebours, message « Composez le code de
     confirmation sur votre téléphone », rafraîchissement du statut toutes les 3 s,
     bouton « J'ai payé, vérifier » et « Annuler ».
   - Résultat final : succès (abonnement activé) ou échec avec possibilité de réessayer.
   - Thème clair/sombre via les tokens sémantiques, format GNF et dates JJ/MM/AAAA.

2. **Paiement direct Mobile Money côté serveur**
   - Nouvelle fonction serveur `createDirectPayment` : même contrôle de rôle
     administrateur, même calcul de montant depuis la base, même écriture d'une ligne
     `subscription_payments` en `pending` que le flux actuel.
   - Appel de l'API Djomy de collecte directe (push OM/MoMo) au lieu du gateway
     avec redirection ; réponse = identifiant de transaction, pas d'URL.
   - Le statut réel reste alimenté par le webhook signé existant, complété par une
     vérification serveur du statut Djomy lors des rafraîchissements (aucune confiance
     accordée au client).

3. **Entrées vers la page**
   - Paramètres > Abonnement : les boutons « Choisir cette offre » ouvrent la nouvelle
     page au lieu de la modale actuelle.
   - Landing : chaque carte tarifaire envoie vers `/app/billing/checkout` si l'utilisateur
     est connecté, sinon vers `/signup` en mémorisant l'offre et le cycle ; après création
     du compte et de l'organisation, l'utilisateur arrive directement sur la page de paiement.

4. **Carte bancaire**
   - Conservation du flux Djomy existant (redirection + page de retour `/app/billing/return`),
     désormais déclenché depuis la nouvelle page, avec un message explicite indiquant que
     la banque demande une validation 3‑D Secure.

## Détails techniques

- `src/routes/_authenticated.app.billing.checkout.tsx` : nouvelle route (search params
  `plan`, `cycle`), composants d'étape (résumé, moyens, attente, résultat).
- `src/lib/billing.functions.ts` : ajout de `createDirectPayment` (Zod : organizationId,
  planCode, cycle, paymentMethod, payerNumber) et de `refreshPaymentStatus` qui interroge
  Djomy côté serveur puis applique `settlePayment` si le paiement est confirmé.
- `src/lib/billing.server.ts` : `startDirectSubscriptionPayment` réutilisant la logique
  d'insertion existante ; `src/lib/djomy.server.ts` : `createDirectCharge` (POST collecte
  directe) et `getPaymentStatusRemote` (GET statut). L'endpoint exact de collecte directe
  sera confirmé contre l'API Djomy au moment de l'implémentation ; en cas d'indisponibilité
  du direct-charge pour un opérateur, repli automatique sur le gateway avec message clair.
- `src/routes/_authenticated.app.billing.index.tsx` : suppression de la modale de paiement,
  redirection vers la nouvelle page.
- `src/components/landing/PricingCard.tsx` : CTA dynamique (checkout ou signup + mémorisation
  du plan dans `sessionStorage`), lu après connexion pour rediriger vers le checkout.
- Aucune modification du webhook signé ni des règles de sécurité : le montant et le statut
  restent calculés et validés exclusivement côté serveur.
