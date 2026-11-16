# Limiter les documents de candidature à 2 Mo

## Objectif
Réduire le temps d'attente avant le démarrage du workflow n8n : tout document de candidature (CV, lettre de motivation, pièces jointes), quel que soit son format (PDF, Word, JPG, PNG), est limité à **2 Mo maximum**.

## Changements
1. **Vérification avant l'envoi** (page publique de candidature) : tout fichier dépassant 2 Mo est refusé immédiatement, avant tout téléversement, avec un message clair.
2. **Message dédié FR/EN** : « Fichier trop volumineux : 2 Mo maximum. » / « File too large: 2 MB maximum. » — distinct des autres erreurs d'envoi.
3. **Cohérence avec le stockage** : aligner la limite du bucket de stockage des candidatures (actuellement 5 Mo) sur 2 Mo, afin qu'un fichier trop lourd soit refusé même si le contrôle navigateur est contourné.
4. **Indication dans le formulaire** : le texte d'aide sous le champ de fichier mentionne la limite de 2 Mo.

## Vérification
- Tester en visiteur anonyme : un PDF de moins de 2 Mo passe ; un fichier de plus de 2 Mo est refusé avec le message clair, sans envoi réseau.
- Confirmer que le parcours complet (upload → analyse IA → confirmation) reste fonctionnel pour un fichier accepté.

## Détails techniques
- Fichiers : page publique de candidature (`src/routes/careers.$slug.$jobSlug.tsx`), traductions FR/EN (`src/lib/i18n.ts`), limite du bucket `applications` via l'outil de configuration du stockage.
- Constante unique `MAX_APPLICATION_FILE_SIZE = 2 * 1024 * 1024` réutilisée pour le contrôle et le message.
- Aucun changement du workflow n8n ni des règles de sécurité du stockage.
