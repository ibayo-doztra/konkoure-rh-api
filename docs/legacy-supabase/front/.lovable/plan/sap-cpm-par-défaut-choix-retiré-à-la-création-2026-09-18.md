# SAP (CPM) par défaut, choix retiré à la création

## Ce qui change

- Le bloc « Modèle de gestion de la performance » (Classique / SAP) disparaît du formulaire de création d'organisation.
- Toute nouvelle organisation est créée directement en modèle SAP (CPM).
- Le choix reste modifiable plus tard dans les réglages de l'organisation (inchangé).
- Les organisations existantes gardent leur modèle actuel.

## Détails techniques

- `src/routes/onboarding.organization.tsx` : suppression de l'état `perfModel`, du `RadioGroup` et des imports devenus inutiles (`RadioGroup`, `Target`, `Layers`) ; envoi de `performanceModel: "sap"` à `createOrganization`.
- `src/lib/organizations.functions.ts` : valeur par défaut du schéma passée de `classic` à `sap`.
- Aucune migration : la colonne `organizations.performance_model` garde son défaut SQL, la valeur est fournie explicitement par le serveur.
