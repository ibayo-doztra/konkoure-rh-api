# Logo Konkouré officiel (icône + logo complet, clair/sombre)

## Objectif

Remplacer le logo textuel actuel (carré violet « K » + mot « Konkouré ») par les visuels fournis : l'icône « K cascade » et le logo complet « KONKOURE », en choisissant automatiquement selon la place disponible et le thème.

## Ce qui change

1. **Assets** : les trois images sont ajoutées via le CDN Lovable (pointeurs `.asset.json` dans `src/assets/`) :
   - `konkoure-icon.png` (icône K) — utilisée en favicon, sur mobile et dans les espaces étroits ;
   - `konkoure-wordmark.png` (logo complet, fond transparent) — thème clair ;
   - `konkoure-wordmark-light-bg.jpg` — variante fond clair, utilisée quand un fond blanc plein est souhaitable.

2. **Favicon** : copie carrée de l'icône K dans `public/favicon.png` (redimensionnée 64x64, sans déformation), référencée dans `src/routes/__root.tsx`, et suppression de l'ancien `public/favicon.svg`.

3. **Composant `src/components/brand/Logo.tsx`** réécrit :
   - `variant="auto"` (défaut) : icône seule en dessous de `sm`, logo complet au‑delà — remplace l'actuel `responsive`.
   - `variant="icon"` / `variant="full"` pour forcer l'un ou l'autre.
   - Le texte du logo étant bleu nuit, en thème sombre l'image est posée sur une **plaque blanche arrondie** (padding léger, coins arrondis) pour rester lisible ; en thème clair, aucune plaque.
   - Reste un `<Link to="/">` avec `aria-label` « Konkouré – accueil », hauteurs fixes pour éviter tout décalage de mise en page.
   - Prop `responsive` conservée en alias de `variant="auto"` pour ne pas casser les appels existants (`AppHeader`, `konkoureoffice`).

4. **`SplashScreen`** : utilise l'icône K au lieu de `/favicon.svg`.

5. Aucune autre page à modifier : toutes importent déjà `@/components/brand/Logo`.

## Détails techniques

- La plaque blanche en thème sombre est appliquée via `dark:` sur un conteneur, sans couleur codée en dur dans la logique (blanc technique assumé, comme pour les QR codes).
- Dimensions `width`/`height` renseignées sur les `<img>` + `loading="eager"` dans les en‑têtes pour éviter le CLS.
- Le logo d'organisation dans la barre latérale reste inchangé.

## Vérification

- En‑tête landing, app, back‑office, pages auth et paiement : logo complet en desktop, icône en mobile, lisible en clair et en sombre.
- Onglet du navigateur : nouveau favicon K.
