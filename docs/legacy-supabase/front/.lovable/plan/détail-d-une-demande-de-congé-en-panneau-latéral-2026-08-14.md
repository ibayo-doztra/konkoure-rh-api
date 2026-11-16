# Détail d'une demande de congé en panneau latéral

## Objectif

Depuis la liste des congés, ouvrir un panneau vertical qui glisse depuis la droite et affiche toutes les informations de la demande sélectionnée.

## Comportement

- Un clic sur une ligne du tableau (ou sur la carte en mobile) ouvre le panneau.
- Une entrée « Détails » est aussi disponible dans les actions de la ligne.
- Le panneau occupe toute la hauteur, largeur confortable en desktop et plein écran en mobile, avec défilement interne.

## Contenu du panneau

- En-tête : nom complet de l'employé, poste, statut (badge coloré).
- Bloc « Demande » : type de congé, date de début, date de fin, nombre de jours ouvrables, date de création.
- Bloc « Solde » : solde acquis, jours demandés, solde restant estimé (uniquement pour le congé annuel, réservé aux personnes autorisées à valider).
- Bloc « Motif » : texte du motif affiché en paragraphe avec retours à la ligne, ou « Aucun motif ».
- Bloc « Décision » : décideur et date de décision quand la demande est approuvée ou refusée.
- Pied du panneau : mêmes actions que dans le tableau selon les droits et le statut (Approuver, Refuser, Annuler). Après action, le panneau se ferme et la liste se rafraîchit.

## Détails techniques

- Nouveau composant `src/components/leaves/LeaveDetailSheet.tsx` basé sur `@/components/ui/sheet` (`side="right"`), props : `request`, `canManage`, `isMine`, callbacks `onApprove` / `onReject` / `onCancel` / `onClose`.
- Solde via le server fn existant `getEmployeeLeaveBalance` (`useQuery`, activé seulement si `canManage`).
- `src/routes/_authenticated.app.leaves.index.tsx` : état `selected`, passage de `onRowClick` à `ResponsiveTable` (déjà supporté), ajout du bouton « Détails » dans la colonne actions, `stopPropagation` sur les boutons d'action pour ne pas ouvrir le panneau.
- Textes ajoutés dans `src/locales/fr/hrm.ts` et `src/locales/en/hrm.ts` (clés `leaves.detailsTitle`, `leaves.details`, `leaves.createdAt`, `leaves.decidedBy`, `leaves.noReason`…).
- Uniquement des tokens sémantiques de thème, aucune couleur codée en dur.
- Aucun changement de schéma ni de logique serveur.
