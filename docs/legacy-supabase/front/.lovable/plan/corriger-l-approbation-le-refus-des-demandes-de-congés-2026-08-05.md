# Corriger l'approbation / le refus des demandes de congés

## Problème confirmé

La fonction base de données `set_leave_request_status` reçoit le statut sous forme de texte (`p_status text`) et l'écrit tel quel dans la colonne `status`, qui est de type énuméré `leave_status`. Postgres refuse la conversion implicite, d'où l'erreur :

`column "status" is of type leave_status but expression is of type text`

Tous les boutons d'action (valider, refuser, annuler) passent par cette fonction, donc aucun n'aboutit.

## Correction

Une migration qui remplace la fonction par une version identique, à un détail près : le statut est explicitement converti vers le type énuméré avant l'écriture.

- Conserver la signature, les contrôles d'autorisation (admin / manager / soi-même), le verrou anti-concurrence et les champs `decided_by` / `decided_at`.
- Écrire `status = p_status::public.leave_status`.
- Conserver `SECURITY DEFINER`, `search_path = public` et les droits d'exécution actuels (aucun élargissement).

Aucun changement côté interface ni côté fonctions serveur : `decideLeaveRequest` et `cancelLeaveRequest` restent inchangés.

## Vérification

Après application : approuver puis annuler une demande de test et confirmer que la ligne change bien de statut en base.
