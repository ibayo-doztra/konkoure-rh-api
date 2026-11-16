# Modales : une seule couleur, bouton Annuler en style d'origine

## Ce qui ne va pas aujourd'hui

- Le bouton « Annuler » a été passé en style « danger au survol » : à retirer.
- Les modales affichent deux couches de couleur (bandeau d'en-tête gris + carte interne plus claire), ce qui donne l'effet « double couche » visible sur la 1re capture.
- Certaines confirmations n'affichent aucun texte explicatif.

## Le style de référence (2e capture)

Une seule surface claire, coins arrondis, ombre douce :

- Titre en gras en haut
- Sous-titre en évidence (nom de l'élément concerné)
- Texte explicatif en gris décrivant la conséquence de l'action
- En bas à droite : « Annuler » (contour neutre, primaire au survol/clic) puis l'action principale
- Une action dangereuse (Supprimer, Révoquer, Annuler l'abonnement, Clôturer) est en rouge (style danger) ; les autres restent en primaire
- Ajouter une animation d'apparition de la modale

## Ce qui sera fait

1. **Bouton Annuler** — suppression de la variante « cancel » rouge ; retour au style contour d'origine (neutre au repos, primaire au survol et au clic). Tous les boutons Annuler des modales repassent dessus.
2. **Modale sans double couche** — l'en-tête et le corps partagent le même fond que la modale : plus de bandeau gris, plus de carte interne contrastée ni d'ombre intérieure. Séparateurs supprimés sur les confirmations ; conservés discrètement uniquement sur les grandes modales de formulaire si nécessaire à la lisibilité.
3. **Texte explicatif systématique** — chaque confirmation reçoit une description claire de la conséquence (ex. « Cette action est irréversible. L'objectif et son historique seront supprimés. »), en FR et EN.
4. **Style danger pour les actions destructives** — toutes les suppressions/révocations/annulations passent en bouton rouge ; les confirmations neutres (clôture de cycle, déconnexion d'intégration) gardent le bouton primaire ou rouge selon la gravité.
5. **Application à tout le projet** — le composant unique `ConfirmDialog` (et le hook `useConfirm`) sert déjà partout ; les changements sont donc répercutés automatiquement sur toutes les confirmations, et les modales de formulaire héritent du nouveau fond unique.

## Détails techniques

- `src/components/ui/button.tsx` : retrait de la variante `cancel`.
- `src/components/ui/dialog.tsx` : `DialogContent` en `bg-background` ; `DialogHeader` sans `bg-muted` ni `border-b` ; `DialogBody` sans marge/carte/ombre (simple padding) — surface unique.
- `src/components/ConfirmDialog.tsx` : `variant="outline"` sur Annuler, description obligatoire, largeur compacte, actions alignées à droite.
- Appelants (`useConfirm`, départements, contrats, offres, performance, réglages, abonnement, badge NFC, back-office) : ajout de `actionVariant="destructive"` et des descriptions manquantes ; nouvelles clés dans `src/locales/fr/*` et `src/locales/en/*`.
- Aucune modification de logique métier ni de base de données.