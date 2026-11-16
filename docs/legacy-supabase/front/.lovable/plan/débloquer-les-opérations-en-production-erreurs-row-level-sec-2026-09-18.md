# Débloquer les opérations en production (erreurs « row-level security »)

## Ce qui se passe réellement

Vérifications faites sur la base de production :

- **Création d'entreprise cassée** : une seule organisation existe, créée le 4 mai. Depuis, aucun testeur n'a pu créer la sienne. La création se fait aujourd'hui en 4 écritures séparées depuis le navigateur (entreprise, membre, rôle propriétaire, départements) et la toute première échoue parce que l'application relit immédiatement la ligne créée alors que l'utilisateur n'est pas encore enregistré comme membre.
- **Fiches employés** : les droits d'écriture et de lecture manquent sur la table des employés pour les comptes connectés. Toute création, modification ou consultation de fiche échoue.
- **Comptes réseaux sociaux** : lecture seule, donc impossible de connecter un compte.
- **Modules d'offre** : quand une organisation n'a pas le module dans son offre, l'utilisateur reçoit un message technique « violates row-level security policy » au lieu d'une explication.

## Ce que je vais faire

1. **Création d'entreprise fiabilisée**
   Une seule opération côté serveur crée l'entreprise, inscrit le créateur comme membre et propriétaire, et crée les départements de départ. Si une étape échoue, rien n'est créé à moitié. Message d'erreur clair en cas de nom ou d'adresse déjà utilisés.

2. **Droits rétablis table par table**
   Audit complet : pour chaque table, les permissions techniques sont alignées sur les règles d'accès existantes. Correction des tables employés et comptes sociaux, retrait des permissions inutiles accordées aux visiteurs non connectés (les pages publiques carrières, candidature et demande de démo restent intactes).

3. **Règles d'accès par rôle, cohérentes partout**
   - Propriétaire et RH : tout créer, modifier, supprimer dans leur entreprise.
   - Manager : consulte son équipe, valide congés et évaluations, sans créer ni modifier de fiche employé.
   - Employé : ses propres données uniquement.
   - Recruteur : recrutement uniquement.
   - Agent de sécurité : pointage uniquement.
   - Le salaire de base reste réservé au propriétaire, aux RH et à l'employé concerné.

4. **Tous les modules ouverts pendant les tests**
   Un interrupteur unique côté réglages plateforme ouvre tous les modules à toutes les organisations. Il est activé maintenant et se désactive plus tard sans toucher au code, ce qui rétablira les limites par offre.

5. **Messages compréhensibles**
   Les erreurs techniques de base de données sont traduites en français et anglais : « Vous n'avez pas les droits pour cette action », « Ce module n'est pas inclus dans votre offre », « Cette valeur existe déjà » — au lieu du jargon actuel.

6. **Vérification réelle avant de conclure**
   Je crée un compte de test, je crée une entreprise, puis je passe en revue les créations/modifications/suppressions sur employés, départements, contrats, congés, objectifs, évaluations, offres et candidats, pointage, zones. Contrôle final avec l'analyse de sécurité pour vérifier qu'aucune table n'est laissée ouverte.

## Détails techniques

- Nouvelle fonction serveur `createOrganization` dans `src/lib/organizations.functions.ts` (middleware `requireSupabaseAuth`, client admin, vérification `created_by = userId`, slug normalisé serveur, unicité) ; `src/routes/onboarding.organization.tsx` l'appelle au lieu des 4 inserts client.
- Migration SQL : ajout policy `organizations` SELECT `created_by = auth.uid()` (filet), `GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated`, grants manquants sur `social_accounts`, `REVOKE` des privilèges `anon` sur les tables sans policy `anon`, harmonisation des policies INSERT/UPDATE/DELETE manquantes par rôle (`private.is_org_admin`, `private.is_recruitment_staff`, `private.is_employee_manager`).
- `private.org_has_module` lit un drapeau `platform_settings.key = 'modules_open_for_testing'` : quand il vaut `true`, la fonction renvoie `true`. `src/lib/entitlements.ts` / `useSubscription` alignés pour l'UI.
- Nouveau helper `src/lib/db-errors.ts` : mapping des codes `42501`, `23505`, `23503` et des messages RLS vers des clés i18n, utilisé dans les toasts d'erreur.
- Aucune donnée existante supprimée ; toutes les migrations sont additives.
