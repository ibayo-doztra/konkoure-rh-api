# Devise unique GNF

## Constat vérifié

- La nouvelle organisation « Ziama Tech » est enregistrée en `XOF` ; « Doztra » est en `GNF`.
- La base pose encore `XOF` comme valeur automatique pour deux endroits : la devise de l'organisation et la devise d'un contrat.
- Les abonnements et paiements sont déjà entièrement en `GNF`.
- Le formulaire de création d'organisation et les réglages n'affichent aucun choix de devise : la valeur vient uniquement de la base.

## Ce qui change

- La devise automatique devient `GNF` partout (organisations et contrats).
- L'organisation déjà créée en `XOF` est corrigée en `GNF`.
- Aucun choix de devise n'est ajouté à l'interface : il n'y en a toujours pas à saisir.
- Les montants affichés (salaires de contrats, masse salariale, abonnements) restent présentés en GNF comme aujourd'hui.

## Détails techniques

Une seule migration, additive et non destructive :

- `ALTER TABLE public.organizations ALTER COLUMN default_currency SET DEFAULT 'GNF'`
- `ALTER TABLE public.contracts ALTER COLUMN currency SET DEFAULT 'GNF'`
- `UPDATE public.organizations SET default_currency = 'GNF' WHERE default_currency <> 'GNF'`
- `UPDATE public.contracts SET currency = 'GNF' WHERE currency IS NOT NULL AND currency <> 'GNF'`

Aucun changement de code applicatif nécessaire : `formatCurrency` a déjà `GNF` par défaut et `src/lib/organizations.functions.ts` ne transmet pas de devise.

## Vérification

Relecture en base des valeurs de devise des organisations et des contrats après migration.
