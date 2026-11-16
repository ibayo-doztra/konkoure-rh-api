# Passer l'organisation de bayo.ibrahima@doztra.com en offre Entreprise

## Constat
Le compte `bayo.ibrahima@doztra.com` appartient à l'organisation **Doztra**, actuellement sur l'offre **Gratuit** (5 employés max, 50 crédits IA, statut « trialing », sans échéance).

## Ce qui sera fait
Une migration met à jour l'organisation Doztra :

- Offre : **Entreprise** (200 employés, 5 000 crédits IA/mois, tous les modules)
- Statut d'abonnement : **actif**
- Cycle : **annuel**
- Échéance (`periode_fin`) : dans 1 an, pour éviter tout repli automatique sur Gratuit par le CRON de cycle de vie
- Une ligne de traçabilité dans `billing_audit_log` (événement d'attribution manuelle, sans paiement)

Aucun paiement Djomy n'est créé : c'est une attribution interne pour tests.

## Détails techniques
- `UPDATE public.organizations SET plan_id = <id plan entreprise>, statut_abo = 'active', cycle = 'annuel', periode_fin = now() + interval '1 year'` ciblée sur l'organisation liée à cet utilisateur via `organization_members`.
- Le trigger `organizations_guard_subscription_columns` protège ces colonnes côté application ; la migration s'exécute en rôle privilégié, ce qui est compatible.
- Aucun changement de code : `useSubscription` lit déjà l'offre depuis la base, la page `/app/billing` affichera « Entreprise — Actif » automatiquement.
