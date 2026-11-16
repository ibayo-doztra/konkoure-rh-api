# Back-office super-administrateur (/admin)

Un espace séparé de l'app RH, réservé aux comptes « root », permettant de piloter toute la plateforme sans passer par le code : organisations, abonnements, offres et tarifs, utilisateurs, réglages globaux, et journal d'activité.

## Accès root

- Nouvelle table `platform_admins` (utilisateur, niveau `root` / `support`, actif, date, qui l'a ajouté), amorcée avec **bayo.ibrahima@doztra.com**.
- La variable d'environnement `PLATFORM_ADMIN_EMAILS` reste un filet de sécurité : un compte qui y figure est reconnu root même si la table est vide (évite de se verrouiller dehors).
- Ajout/retrait d'un admin plateforme se fait depuis le back-office. Le dernier root actif ne peut pas être supprimé.
- Toutes les données du back-office passent par des fonctions serveur qui revérifient le statut root à chaque appel : masquer le menu ne suffit pas.

## Navigation

Espace dédié `/admin`, mise en page propre (barre latérale distincte, thème clair/sombre, français), avec :

```text
/admin                    Vue d'ensemble (organisations, comptes, revenus, activité 7 j)
/admin/organisations      Liste + fiche détaillée d'une organisation
/admin/offres             Offres, tarifs, quotas, modules et features
/admin/utilisateurs       Comptes, rôles, admins plateforme
/admin/demandes           Demandes de démo + statut d'envoi des e-mails
/admin/paiements          Transactions d'abonnement
/admin/reglages           Réglages globaux de la plateforme
/admin/journal            Journal d'audit, statistiques d'usage, logs techniques
```

Un lien « Administration » remplace l'actuel élément « Plateforme » de la barre latérale de l'app, visible uniquement pour un root.

## Organisations & abonnements

Liste filtrable (nom, offre, statut, échéance, nombre d'employés, date de création) avec recherche et export CSV. Fiche organisation :

- changer d'offre et de cycle (mensuel/annuel) ;
- prolonger ou raccourcir l'essai, fixer la date d'échéance ;
- suspendre / réactiver / marquer comme annulée ;
- surcharger ponctuellement le plafond d'employés ou les modules pour cette organisation seulement ;
- voir ses membres, ses paiements, son volume de données.

Chaque action est journalisée avec l'auteur, la valeur avant et après.

## Offres & tarifs

Édition complète de la table des offres depuis l'écran, sans toucher au code : code, nom, prix GNF, plafond d'employés, crédits IA, ordre d'affichage, modules cochés (Personnel, Départements, Pointage, Congés, Contrats, Recrutement, Performance, Talents, Intégrations) et features. Création et archivage d'une offre. Aperçu de l'impact (nombre d'organisations concernées) avant enregistrement.

La page Tarifs publique et les gardes d'accès liront ces valeurs depuis la base, avec les valeurs actuelles du code comme repli.

## Utilisateurs & rôles

Recherche par e-mail ou nom ; pour chaque compte : organisations, rôles, dernière connexion, statut. Actions : changer un rôle dans une organisation, envoyer une réinitialisation de mot de passe, désactiver un compte, promouvoir/révoquer un admin plateforme. Les actions destructrices demandent une confirmation.

## Réglages globaux

Table `platform_settings` (clé/valeur) éditable : e-mail destinataire des demandes de démo, expéditeur des e-mails, durée de l'essai gratuit, devise et fuseau par défaut, activation/désactivation d'un module au niveau plateforme, mode maintenance, webhooks n8n (reprise de l'écran existant), niveau de journalisation. Les secrets (clés Djomy, Resend…) restent hors de portée : le back-office affiche seulement leur présence, jamais leur valeur.

## Journal & statistiques

- **Audit** : nouvelle table `audit_log` (auteur, organisation, action, cible, détails avant/après, IP, date). Alimentée par les actions sensibles : changements d'offre et de rôle, invitations, attribution/révocation de badge, décisions de congés, modifications de réglages, actions du back-office.
- **Statistiques d'usage** : table `usage_events` légère + agrégats — organisations actives, connexions, modules les plus consultés, volumétrie par organisation, courbes sur 7/30/90 jours.
- **Logs techniques** : table `system_log` pour les erreurs serveur, les appels webhooks/paiements Djomy et les envois d'e-mails, avec statut, durée et message d'erreur.
- Écran unique à trois onglets, filtres (période, organisation, auteur, type, gravité), recherche plein texte et export CSV. Purge automatique au-delà d'une rétention configurable.

## Notes techniques

- Tables nouvelles : `platform_admins`, `platform_settings`, `audit_log`, `usage_events`, `system_log`, plus quelques colonnes de surcharge sur `organizations`. Chacune avec GRANT explicites, RLS activée et aucune policy pour `anon`/`authenticated` : lecture et écriture uniquement par les fonctions serveur root (service role).
- Fonction SQL `private.is_platform_admin(uid)` pour les vérifications en base.
- Couche serveur `src/lib/admin/*.functions.ts` avec un middleware `requirePlatformAdmin` commun ; le client d'administration n'est chargé qu'après vérification du root.
- Écriture d'audit centralisée dans `src/lib/audit.server.ts`, appelée par les mutations sensibles existantes (congés, badges, rôles, facturation) — sans changer leur comportement.
- Front : routes sous `src/routes/admin.*`, composants réutilisés (PageHeader, ActionMenu, standard de modales DialogBody/DialogActions), tokens sémantiques uniquement, dates en JJ/MM/AAAA et montants en GNF.

## Livraison par étapes

1. Socle : table `platform_admins`, garde serveur, mise en page `/admin`, vue d'ensemble.
2. Organisations & abonnements.
3. Offres & tarifs pilotables depuis la base.
4. Utilisateurs & rôles, demandes de démo, paiements.
5. Réglages globaux.
6. Journal d'audit, statistiques d'usage, logs techniques + branchement des actions sensibles existantes.
