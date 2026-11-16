# Motif de rejet des congés + badges verts

## Ce qui change

1. **Motif de rejet obligatoire** — quand un manager ou un admin refuse une demande de congé, la modale de refus demande un motif (texte court,  optionnel). Ce motif est enregistré avec la décision.
2. **Motif visible** — le motif de refus s'affiche dans le panneau de détail de la demande (section Décision), en lecture seule, pour le demandeur comme pour les responsables.
3. **Badges verts** — les statuts positifs (« Approuvé » pour les congés, « Validé » et « Signé » pour les évaluations) passent du bleu primaire au vert de la charte (token `success`), au lieu du style par défaut.

## Détails techniques

- Base de données : ajout de la colonne `decision_comment` (texte, nullable) sur `leave_requests` ; la fonction `set_leave_request_status` reçoit un paramètre optionnel `p_comment` enregistré lors d'un refus (et remis à null pour une approbation). Aucune modification des règles d'accès existantes.
- `src/lib/leaves.functions.ts` : `decideLeaveRequest` accepte `comment` (obligatoire côté validation lorsque la décision est « rejected », max 500 caractères) et le transmet à la RPC ; `listLeaveRequests` sélectionne la nouvelle colonne.
- `src/routes/_authenticated.app.leaves.index.tsx` : `RejectLeaveDialog` ajoute un `Textarea` de motif, bouton de confirmation désactivé tant que le champ est vide ; le motif remonte via `onConfirm(comment)`.
- `src/components/leaves/LeaveDetailSheet.tsx` : affichage du motif de refus dans la section Décision.
- Badges : `STATUS_VARIANT.approved` → `success` dans la page congés et le panneau de détail ; statuts `validated` / `signed` → `success` dans les pages d'évaluation. Le variant `success` existe déjà dans `badge.tsx`.
- Traductions FR/EN ajoutées dans `src/locales/{fr,en}/hrm.ts` (libellé du champ, placeholder, message d'erreur, libellé « Motif du refus »).