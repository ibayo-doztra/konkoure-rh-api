# Validation des congés avec solde négatif autorisé

## Problème confirmé

La fonction base de données `_leave_balance_adjust` bloque toute approbation dès que le solde deviendrait négatif :

```
IF p_delta < 0 AND (v_balance + p_delta) < 0 THEN
  RAISE EXCEPTION 'Solde de congés insuffisant';
```

C'est ce message qui apparaît à la validation. Par ailleurs, le manager valide aujourd'hui d'un simple clic sur la coche, sans aucun récapitulatif du solde.

## Ce qui va changer

### 1. Autoriser le solde négatif (migration base de données)

Retirer le blocage dans `_leave_balance_adjust`. Le solde peut descendre en dessous de zéro et sera récupéré par les acquisitions mensuelles suivantes (2,5 jours/mois). Tout le reste de la fonction (verrou de concurrence, employé introuvable) reste identique.

### 2. Boîte de dialogue de confirmation avant validation

Sur la page Congés, un clic sur la coche « Approuver » ouvre désormais une boîte de dialogue récapitulative :

- Employé et période demandée
- **Solde acquis** (solde actuel de l'employé)
- **Nombre de jours demandés**
- **Solde restant après validation** — affiché en rouge avec une mention d'avertissement s'il est négatif, indiquant que le déficit sera récupéré sur les acquisitions futures

Deux boutons : « Annuler » et « Confirmer la validation ». Le manager reste libre de valider même en solde négatif.

Le refus et l'annulation gardent le comportement actuel (action directe).

## Détails techniques

- Migration : `CREATE OR REPLACE FUNCTION public._leave_balance_adjust` sans la vérification de solde, en conservant `SECURITY DEFINER` et `search_path = public`.
- `src/routes/_authenticated.app.leaves.index.tsx` : état local pour la demande en attente de confirmation, récupération du solde de l'employé concerné via la fonction serveur existante `getEmployeeLeaveBalance` (déjà autorisée pour un admin/manager), et un `Dialog` de confirmation. Aucune modification des fonctions serveur `decideLeaveRequest` / `cancelLeaveRequest`.
- Uniquement les congés de type « annuel » débitent le solde ; pour les autres types la boîte affiche le solde à titre informatif, inchangé après validation.
