# Évaluation : enregistrement refusé et sélecteur de note inutilisable

## Problème 2 — « new row violates row-level security policy for performance_reviews » (cause confirmée)

Les règles d'accès de la table des évaluations n'autorisent la **création** d'une évaluation qu'aux administrateurs / RH de l'organisation. La lecture et la modification, elles, sont bien ouvertes au collaborateur concerné et à son manager.

Résultat : quand une collaboratrice remplit sa propre auto-évaluation et clique sur « Enregistrer », la création de sa fiche d'évaluation est refusée.

### Correctif
Nouvelle migration ajoutant une règle de création pour le collaborateur lui-même :
- un utilisateur peut créer une évaluation **uniquement pour sa propre fiche employé** (`employee_id` rattaché à son compte), dans son organisation ;
- le manager désigné de l'employé peut aussi en créer une ;
- la règle existante pour les admins/RH et le verrou lié au plan d'abonnement (module Performance) restent inchangés.

Les règles pour les commentaires par objectif autorisent déjà le collaborateur : rien à changer de ce côté.

## Problème 1 — la liste des notes ne s'ouvre pas et la page remonte en haut (à confirmer)

Le comportement décrit (clic sur la liste → remontée brutale vers l'en-tête, liste jamais affichée) n'est pas encore reproduit ; je ne veux pas affirmer une cause non vérifiée. Première étape du travail : reproduire la page d'évaluation dans un navigateur automatisé, ouvrir le sélecteur de note et relever le comportement réel (déplacement du focus, verrou de défilement, erreur console).

Pistes à vérifier dans cet ordre :
1. déplacement de focus vers la zone principale de la mise en page (`main` focalisable) à l'ouverture du menu, ce qui ferait défiler la page en haut ;
2. verrou de défilement du menu déroulant en conflit avec la mise en page (barre latérale + zone principale) ;
3. erreur JavaScript à l'ouverture qui referme immédiatement le menu.

Le correctif sera appliqué au composant de liste déroulante ou à la mise en page selon ce que la reproduction montre, puis revérifié à l'écran en thème clair et sombre, sur les deux sélecteurs de note (auto-évaluation et note manager).

## Détails techniques

- Migration : `CREATE POLICY` en INSERT sur `public.performance_reviews` pour `authenticated`, `WITH CHECK` = organisation courante ET (`employee_id` ∈ fiches employés de `auth.uid()` OU `manager_id` ∈ fiches employés de `auth.uid()`). Politique admin existante conservée ; politique restrictive `plan module gate` inchangée.
- Pages concernées : `src/routes/_authenticated.app.performance.reviews.new.$planId.$employeeId.tsx` (création) et `src/routes/_authenticated.app.performance.reviews.$id.tsx` (édition/soumission).
- Sélecteur de note : `src/components/ui/select.tsx`, éventuellement `src/routes/_authenticated.tsx` (conteneur `main` focalisable) selon le diagnostic.
- Aucun changement de logique métier ni de barème de notation.
