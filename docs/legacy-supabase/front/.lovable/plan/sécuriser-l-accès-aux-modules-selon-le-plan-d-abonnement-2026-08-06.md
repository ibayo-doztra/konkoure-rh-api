# Sécuriser l'accès aux modules selon le plan d'abonnement

Aujourd'hui les modules inclus dans chaque offre existent bien en base (`plans.features.modules`), mais **rien ne les fait respecter** : le menu affiche tous les modules à tout le monde, l'accès direct par URL passe, et surtout les écritures en base ne vérifient jamais l'offre. Un compte Gratuit peut donc utiliser Recrutement, Performance ou Talents.

Objectif : l'organisation n'accède **qu'aux** modules de son offre, y compris en contournant l'interface.

## Modules par offre (état actuel en base)

| Module | Gratuit | Essentiel | Professionnel | Entreprise |
|---|---|---|---|---|
| Personnel, Départements, Pointage | oui | oui | oui | oui |
| Congés, Contrats | non | oui | oui | oui |
| Recrutement, Performance | non | non | oui | oui |
| Talents, Intégrations | non | non | non | oui |

Note : la page tarifs annonce « Congés » dans l'offre Gratuit alors que la base ne l'inclut pas. À trancher (voir question ci-dessous).

## Ce qui sera mis en place

1. **Source de vérité unique côté base**
   - Fonction `private.org_has_module(org, module)` : lit l'offre de l'organisation et renvoie vrai/faux.
   - Une offre expirée ou impayée (`statut_abo` = `past_due`/`canceled`) retombe automatiquement sur les modules de l'offre Gratuit.

2. **Blocage réel des données (couche la plus importante)**
   - Les règles d'accès des tables rattachées à un module payant (recrutement : offres, candidats, notes, activités ; performance : objectifs, OKR, évaluations, feedbacks ; talents : compétences, plans de succession ; congés ; contrats ; intégrations réseaux sociaux) exigent en plus que le module soit inclus dans l'offre.
   - Lecture et écriture sont bloquées, y compris depuis l'app mobile ou un appel direct à l'API.

3. **Blocage côté serveur applicatif**
   - Un garde `requireModule(orgId, "recruitment")` dans les fonctions serveur concernées, avec un message clair (« Module non inclus dans votre offre »).

4. **Interface cohérente**
   - Le menu latéral masque les groupes non inclus (ou les affiche grisés avec une pastille « Offre supérieure » — au choix, voir question).
   - L'accès direct par URL redirige vers une page « Module non inclus » proposant la mise à niveau vers l'offre adéquate, au lieu d'une erreur.
   - La page Abonnement liste clairement les modules actifs et ceux débloqués par le palier supérieur.

5. **Cohérence des quotas**
   - Le plafond d'employés est déjà appliqué en base ; on l'expose dans l'interface (compteur « 18 / 25 employés ») pour éviter l'échec surprise à la création.

## Détails techniques

- `private.org_has_module(uuid, text)` en SECURITY DEFINER, `STABLE`, utilisée dans les politiques RLS (aucune récursion : elle ne lit que `organizations` et `plans`).
- Migration : ajout de la condition module aux politiques existantes des tables listées, sans toucher aux règles de rôle/organisation déjà en place.
- `src/lib/entitlements.ts` : mapping unique route → module, réutilisé par la sidebar, le garde de route `_authenticated.tsx` et la page Abonnement (DRY).
- `useSubscription()` est déjà branché sur la base ; on y ajoute la retombée « Gratuit » si l'abonnement n'est pas actif.
- Garde serveur dans `src/lib/*.functions.ts` via un helper commun dans `billing.server.ts`.
- Aucune donnée existante supprimée : une organisation qui rétrograde conserve ses données, elle n'y accède simplement plus tant qu'elle n'a pas remonté d'offre.
