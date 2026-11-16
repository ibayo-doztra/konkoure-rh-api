# Fiabiliser la soumission d’une candidature publique

## Diagnostic confirmé

- La version actuellement publiée sert encore l’ancien formulaire : l’envoi du CV utilise le mode `upsert` et aucun voile de chargement n’est inclus dans son fichier JavaScript.
- Ce mode `upsert` fait aussi contrôler les droits de modification du stockage. Un candidat public n’a volontairement que le droit de créer un nouveau fichier ; cette étape peut donc produire `new row violates row-level security policy`.
- Le code de travail contient déjà le retrait de `upsert` et le loader, mais ces changements ne sont pas présents sur le site public.
- L’écriture finale du candidat passe côté serveur avec les droits prévus. Les erreurs de stockage, de scoring et d’enregistrement ne sont toutefois pas distinguées assez précisément pour l’utilisateur.

## Changements

1. **Rendre le loader immédiatement visible**
   - Forcer un rendu du nouvel état avant de commencer l’envoi du premier fichier.
   - Afficher un voile avec spinner et un libellé adapté à l’étape : préparation, transfert des documents, analyse du CV, puis enregistrement.
   - Verrouiller tous les champs et le bouton pendant toute l’opération, avec protection contre les doubles soumissions.

2. **Corriger chaque étape qui peut déclencher une erreur de droits**
   - Conserver la création unique des fichiers sans `upsert` dans le dossier généré pour la candidature.
   - Vérifier et enregistrer durablement les droits minimaux nécessaires à la lecture de l’offre et au dépôt public du document, sans ouvrir la lecture des CV ni élargir les droits des visiteurs.
   - Garder la création du candidat et de son activité côté serveur ; contrôler explicitement les erreurs de ces deux écritures au lieu d’ignorer la seconde.

3. **Remplacer toutes les erreurs techniques par des messages compréhensibles**
   - Mapper séparément : document non transféré, candidature déjà envoyée, offre fermée, analyse temporairement indisponible, enregistrement impossible et problème réseau.
   - Ne jamais afficher les textes bruts de la base, les noms de règles de sécurité ou les détails internes.
   - Ajouter les messages français et anglais correspondants.

4. **Vérifier le parcours réel cas par cas**
   - Tester en visiteur non connecté : offre publiée, dépôt du CV, loader visible, scoring, création du candidat et activité associée.
   - Tester les refus attendus : fichier invalide, doublon, offre non publiée et chemin de fichier falsifié.
   - Vérifier qu’un visiteur ne peut ni lire les CV privés, ni modifier/remplacer un fichier existant, ni choisir une autre organisation.
   - Contrôler le résultat stocké, supprimer les données de test, puis confirmer que la compilation est valide.

## Mise en ligne

- La correction du formulaire doit ensuite être publiée : le site public utilise aujourd’hui un ancien fichier, même si le code de travail contient déjà une partie du correctif.
- La publication ne sera lancée que sur demande explicite ; avant cela, la correction sera entièrement validée dans l’aperçu.

## Détails techniques

- Fichiers principaux : page publique de candidature, fonction serveur d’enregistrement, scoring serveur et traductions FR/EN.
- Une migration additive consignera uniquement les droits strictement nécessaires si les droits actuels ne sont pas déjà représentés dans les migrations du projet.
- Aucun changement du workflow métier de scoring n’est prévu.