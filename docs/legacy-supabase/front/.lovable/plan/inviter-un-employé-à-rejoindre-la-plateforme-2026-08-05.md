# Inviter un employé à rejoindre la plateforme

Objectif : depuis la fiche ou la liste des employés, un RH/owner peut envoyer une invitation par email. L'employé clique sur le lien reçu, définit obligatoirement son mot de passe, puis accède à son espace.

## Parcours

```text
RH -> bouton "Inviter" sur l'employé
   -> email d'invitation envoyé (lien sécurisé)
Employé -> clic sur le lien -> page /invitation
   -> définition du mot de passe (obligatoire)
   -> redirection vers /app
```

## Ce qui est construit

1. **Action "Inviter"** dans le menu d'actions de la liste des employés et sur la fiche employé.
   - Visible uniquement pour owner / hr_admin.
   - Désactivée si l'employé n'a pas d'email, ou s'il a déjà un compte actif.
   - Badge d'état sur l'employé : « Sans compte » / « Invitation envoyée » / « Compte actif ».
   - Possibilité de renvoyer l'invitation.

2. **Envoi de l'invitation** (côté serveur, sécurisé) :
   - vérifie que l'appelant est owner/hr_admin de l'organisation de l'employé ;
   - crée (ou retrouve) le compte utilisateur avec l'email de l'employé ;
   - envoie l'email d'invitation avec un lien à usage unique pointant vers `/invitation` ;
   - rattache le compte à l'employé (`employees.user_id`), l'ajoute à `organization_members` et lui donne le rôle `employee` dans `user_roles` ;
   - marque le compte comme « doit changer son mot de passe ».

3. **Page publique `/invitation`** :
   - valide la session issue du lien ; si le lien est expiré/invalide, message clair + possibilité de demander un nouveau lien au RH ;
   - formulaire nouveau mot de passe + confirmation, avec l'indicateur de robustesse déjà existant ;
   - à la validation : mise à jour du mot de passe, retrait du marqueur « doit changer », redirection vers `/app`.

4. **Verrou de première connexion** : tant que le marqueur est présent, toute navigation dans `/app` renvoie vers `/invitation`. L'employé ne peut donc pas utiliser la plateforme avec le mot de passe provisoire.

5. Textes en français, cohérents avec le reste de la plateforme (thème clair/sombre, tokens sémantiques).

## Détails techniques

- Nouvelle server function `inviteEmployeeUser` dans `src/lib/employees.functions.ts` (middleware `requireSupabaseAuth`, contrôle de rôle via `user_roles`, puis `supabaseAdmin.auth.admin.inviteUserByEmail` avec `redirectTo = <origin>/invitation` et `data: { must_change_password: true, employee_id }`).
- Cas « email déjà utilisé » : on retrouve l'utilisateur existant et on renvoie un lien de type recovery vers `/invitation` au lieu d'échouer.
- Écritures `employees.user_id`, `organization_members`, `user_roles` via le client admin après contrôle d'autorisation (les policies RLS bloquent ces écritures côté client).
- Nouvelle route publique `src/routes/invitation.tsx` (SSR par défaut, `robots: noindex`), réutilisant `PasswordInput` et `PasswordStrength`.
- Marqueur stocké dans `user_metadata.must_change_password`, effacé par `supabase.auth.updateUser` en même temps que le mot de passe.
- Vérification du marqueur dans le layout `src/routes/_authenticated.tsx` (redirection `/invitation`).
- Aucune migration nécessaire : `employees.user_id`, `organization_members` et `user_roles` existent déjà.
- Les emails d'invitation partent via l'email d'authentification managé de la plateforme ; un domaine d'envoi personnalisé (expéditeur « Konkouré ») pourra être branché plus tard sans changer ce parcours.
