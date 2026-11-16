# Plan : Simplifier les actions des employés

## Contexte
Dans la liste des employés (`/app/employees`), chaque carte affiche actuellement :
- un bouton **Voir**
- un menu déroulant **⋮** contenant un seul item : "Inviter à rejoindre" / "Renvoyer l'invitation"

Comme ce menu n'a qu'un seul bouton, il est inutile.

## Objectif
Remplacer le menu déroulant par un bouton **direct** "Inviter à rejoindre" / "Renvoyer l'invitation" à côté du bouton "Voir".

## Changements prévus

1. Modifier `src/routes/_authenticated.app.employees.index.tsx`
   - Supprimer le composant `<ActionMenu ... />` utilisé pour l'invitation.
   - Ajouter un `<Button>` direct à la place avec :
     - `variant="outline"` ou `variant="default"` selon l'harmonie visuelle
     - taille `sm`
     - icône `Send`
     - label dynamique : "Inviter à rejoindre" quand `accountStates[e.id] === "none"` et "Renvoyer l'invitation" sinon
     - `disabled={inviting === e.id}`
     - `onClick={() => void invite(e.id)}`
2. Nettoyer les imports
   - Supprimer l'import `ActionMenu` si ce fichier n'en a plus besoin.
   - Conserver l'import `Send`.

## Non concerné
- Le bouton "Voir" reste inchangé.
- La logique d'invitation (`invite`, `accountStates`, `inviting`) reste inchangée.
- Aucun changement serveur ou base de données.
