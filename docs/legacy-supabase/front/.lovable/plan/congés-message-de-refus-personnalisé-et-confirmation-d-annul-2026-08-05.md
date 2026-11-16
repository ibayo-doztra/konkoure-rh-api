# Congés : message de refus personnalisé et confirmation d'annulation

## 1. Message de refus avec le nom de l'employé

Dans la boîte de dialogue « Refuser la demande de congés », remplacer le texte actuel :

> Cette action est définitive : la demande sera marquée comme refusée et l'employé devra en soumettre une nouvelle.

par :

> La demande sera marquée comme refusée et **Fadima Diawara** devra en soumettre une nouvelle.

Le prénom et le nom sont ceux de l'employé concerné par la demande (déjà disponibles dans la ligne sélectionnée). Si le nom est indisponible, le texte retombe sur « l'employé ».

## 2. Confirmation avant annulation d'une demande

Aujourd'hui, le bouton corbeille annule immédiatement la demande. Ajouter une boîte de dialogue de confirmation, construite sur le même modèle que celle du refus :

- Titre : « Annuler la demande de congés »
- Rappel : nom de l'employé, type de congé, période, nombre de jours demandés
- Message : la demande sera annulée et devra être soumise à nouveau si besoin
- Boutons : « Retour » (secondaire) et « Confirmer l'annulation » (destructif, avec état de chargement)

L'annulation réelle n'est déclenchée qu'après confirmation.

## Détails techniques

- Fichier : `src/routes/_authenticated.app.leaves.index.tsx`
- Nouveau composant local `CancelLeaveDialog`, aligné sur le standard des modales du projet (`DialogContent > DialogHeader + DialogBody`, actions dans `DialogActions`).
- Nouvel état `toCancel` piloté par le bouton corbeille ; l'appel `cancel(id)` existant est exécuté depuis `onConfirm`.
- Aucun changement côté base de données ou serveur.
