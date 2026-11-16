# Envoi par e-mail des demandes de démo + suivi en base

## Ce qui change

1. À chaque demande envoyée depuis `/demo`, un e-mail récapitulatif part vers **bayo.ibrahima@doztra.com** (nom, e-mail, téléphone, entreprise, taille, message, date/heure).
2. La demande enregistrée en base conserve désormais l'état de cet envoi :
   - statut d'envoi : `pending`, `sent` ou `failed`
   - date et heure de l'envoi
   - message d'erreur en cas d'échec (utile pour comprendre un non-reçu)
3. Le visiteur voit toujours le message de confirmation même si l'e-mail échoue : la demande n'est jamais perdue, elle reste consultable en base avec le statut `failed`.
4. Répondre directement à l'e-mail répond au demandeur (adresse du visiteur en « Reply-To »).

## Prérequis : domaine d'envoi

Aucun domaine d'e-mail vérifié n'est disponible pour ce projet (le seul domaine de l'espace de travail, `tutor24.doztra.cloud`, est en échec de provisionnement). Il faut configurer et vérifier un domaine d'envoi (par exemple `doztra.com` ou un sous-domaine) avant que les e-mails puissent réellement partir. Je proposerai la configuration au moment de l'implémentation ; d'ici là le code enregistrera `failed` sans bloquer le formulaire.

## Détails techniques

- **Migration** : ajout sur `public.demo_requests` des colonnes `email_status text not null default 'pending'` (contrainte `in ('pending','sent','failed')`), `email_sent_at timestamptz`, `email_error text`. Aucune modification des politiques d'accès existantes (insertion publique, lecture réservée aux administrateurs plateforme).
- **Envoi** : helper serveur `src/lib/emails.server.ts` (Resend via l'infrastructure e-mail Lovable, clé lue dans `process.env` à l'intérieur du handler) + gabarit HTML/texte de la demande de démo.
- **Fonction serveur** : `submitDemoRequest` (`src/lib/demo-requests.functions.ts`) insère la ligne avec `.select('id')`, tente l'envoi, puis met à jour la ligne (`email_status`, `email_sent_at = now()`, `email_error`). L'échec d'envoi est journalisé côté serveur et ne fait pas échouer la réponse au visiteur.
- Destinataire par défaut `bayo.ibrahima@doztra.com`, surchargeable via une variable d'environnement `DEMO_REQUEST_NOTIFY_EMAIL`.
- Aucun changement de l'interface `/demo` (validation bilingue et champs inchangés).
