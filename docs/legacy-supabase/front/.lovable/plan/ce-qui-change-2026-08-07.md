Marquer les champs obligatoires et inverser la contrainte téléphone/message du formulaire de démo

## Ce qui change

1. **Formulaire `/demo`** — les champs obligatoires affichent un astérisque rouge (`*`) dans leur label :
   - Nom complet
   - E-mail professionnel
   - Téléphone (devient obligatoire)
   - Nom de l'entreprise
   - Taille de l'entreprise
2. **Téléphone** passe d'optionnel à obligatoire (avec validation minimum 1 caractère, maximum 40).
3. **Message / besoin** passe d'obligatoire (10 caractères min.) à optionnel (max. 2000 caractères).
4. Alignement de la base de données et des RLS avec ces nouvelles règles.

## Détails techniques

- **Schéma** (`src/lib/demo-requests.schema.ts`) :
  - `phone` : `z.string().trim().min(1, "Téléphone requis").max(40)`
  - `message` : `z.string().trim().max(2000).optional().or(z.literal(""))`
- **Fonction serveur** (`src/lib/demo-requests.functions.ts`) :
  - Insérer `data.phone` directement (non null).
  - Insérer `data.message || null` pour stocker un `NULL` en base quand le champ est vide.
- **Migration SQL** (`supabase/migrations/`) :
  - `ALTER TABLE public.demo_requests ALTER COLUMN phone SET NOT NULL;`
  - `ALTER TABLE public.demo_requests ALTER COLUMN message DROP NOT NULL;`
  - Mettre à jour la policy `WITH CHECK` :
    - `phone IS NOT NULL AND length(phone) BETWEEN 1 AND 40`
    - `message IS NULL OR length(message) <= 2000`
- **UI** (`src/routes/demo.tsx`) :
  - Ajouter une prop `required` au composant `Field` pour afficher le `*` dans le label.
  - Mettre à jour les labels : retirer "(optionnel)" du téléphone, ajouter "(optionnel)" au message.
  - Conserver les textes FR/EN.
- **Vérification** : build et test d'envoi du formulaire avec message vide et téléphone renseigné.
