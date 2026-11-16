# Loader de soumission en modale centrée

## Objectif
Sur la page publique de candidature (`/careers/:slug/:jobSlug`), le voile plein écran actuel (`fixed inset-0`, fond opaque + flou) masque toute la page : le candidat a l'impression que la page s'est fermée. Remplacer par une modale centrée, responsive, avec la page encore visible (voile léger), et corriger un libellé.

## Changements

### 1. Modale de progression — `src/routes/careers.$slug.$jobSlug.tsx`
- Remplacer l'overlay plein écran par une vraie modale Radix (`Dialog`) ouverte uniquement pendant `submitting` :
  - `DialogContent` compact (`max-w-sm`), non fermable : la croix intégrée est masquée, `onOpenChange` ignore toute fermeture tant que l'envoi est en cours (impossible de fermer, pas de clic extérieur efficace).
  - Voile d'arrière-plan allégé (fond semi-transparent léger, pas de couverture opaque) : le contenu de la page reste perceptible derrière la modale.
  - Contenu centré : titre court + spinner `Loader2` animé + message de la phase en cours (préparation / transfert / analyse), via `DialogHeader` + `DialogBody` selon le standard projet.
  - Accessibilité conservée : `role="status"`, `aria-live`, `aria-busy` pendant l'envoi.
- La logique de soumission (upload URL signée, scoring n8n, phases) reste inchangée.

### 2. Libellé — `src/lib/i18n.ts` (clé `careers.processingTitle`)
- FR : « Analyse du CV et enregistrement… » → « Analyse de votre CV en cours »
- EN : « Analyzing your CV and saving… » → « Analyzing your CV in progress »

## Contraintes respectées
- Tokens sémantiques uniquement (page publique, aucune couleur codée en dur).
- FR/EN cohérents.
- Aucune logique métier modifiée : upload, validation, doublons, webhooks inchangés.
