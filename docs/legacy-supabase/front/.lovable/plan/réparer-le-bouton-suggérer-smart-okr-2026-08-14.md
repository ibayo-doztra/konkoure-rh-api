# Réparer le bouton « Suggérer SMART » (OKR)

## Constat

Le bouton appelle bien l'IA, mais le client et la fonction ne parlent pas le même langage :

- La page envoie `{ objective: "..." }` (`src/routes/_authenticated.app.performance.okrs.tsx:55`).
- La fonction IA `ai-suggest-okr` lit `{ context, role, quarter, language }` — l'objectif saisi n'est donc jamais transmis, le prompt part vide.
- La fonction répond `{ suggestions: [{ objective, key_results: [{ name, target, unit }] }] }`, alors que la page lit `data.key_results` — toujours `undefined`, donc le champ « Résultats clés » reste vide.

Résultat : rien ne se passe visiblement, sans message d'erreur.

## Ce qui va changer

1. La page envoie l'objectif saisi, le trimestre et la langue active de l'interface.
2. La fonction IA génère 3 à 5 résultats clés mesurables pour cet objectif précis et renvoie une liste simple de textes.
3. Le champ « Résultats clés » se remplit avec un résultat par ligne, prêt à être édité.
4. Retour visuel clair : indicateur de chargement pendant la génération, message d'erreur explicite si l'IA est indisponible (limite de requêtes atteinte, crédits épuisés, autre erreur), et message si aucune suggestion n'est renvoyée.
5. Textes des messages ajoutés en français et en anglais.

## Détails techniques

- `supabase/functions/ai-suggest-okr/index.ts` : accepter `{ objective, quarter, language }`, refuser un objectif vide avec un 400, prompt recentré sur un objectif unique, format de réponse `{ key_results: string[] }` via `response_format: json_object`, tolérance au parsing (accepter aussi bien des chaînes que des objets `{ name, target, unit }` que le modèle pourrait renvoyer, et les aplatir en texte). Modèle conservé : `google/gemini-2.5-flash`.
- `src/routes/_authenticated.app.performance.okrs.tsx` : `suggest()` envoie `{ objective: form.objective, quarter: form.quarter, language: i18n.language }`, fusionne les suggestions dans `form.key_results` (une par ligne) sans écraser silencieusement une saisie existante non vide, et gère les codes 429/402 avec des toasts dédiés.
- Nouvelles clés i18n sous `okrs.*` dans `src/locales/fr/performance.ts` et `src/locales/en/performance.ts`.
