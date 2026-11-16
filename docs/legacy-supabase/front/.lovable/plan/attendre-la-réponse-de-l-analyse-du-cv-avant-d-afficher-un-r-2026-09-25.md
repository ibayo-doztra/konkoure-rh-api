# Attendre la réponse de l'analyse du CV avant d'afficher un résultat

## Cause
La plateforme abandonne l'attente après 20 secondes. L'analyse du CV prend environ 40 à 60 secondes, donc le candidat reçoit « Le service d'évaluation est injoignable » alors que l'analyse continue.

## Correction
1. Allonger l'attente à 3 minutes. Pendant ce temps, la modale « Analyse de votre CV en cours » reste affichée.
2. Aucun message de résultat (succès ou erreur) ne s'affiche avant la réponse de l'analyse.
3. Si l'analyse dépasse vraiment 3 minutes, afficher un message distinct et honnête : « L'analyse de votre CV prend plus de temps que prévu. Merci de réessayer plus tard. » Le message « injoignable » reste réservé aux vraies pannes (service arrêté, erreur, réponse invalide).
4. Dans la modale, après 30 secondes, ajouter une ligne rassurante : « Cela peut prendre jusqu'à une minute, merci de ne pas fermer la page. »

## Détails techniques
- `src/lib/recruitment-webhooks.server.ts` (`runCandidateScoring`) : délai porté de 20 000 à 180 000 ms ; un dépassement renvoie `reason: "timeout"` au lieu de `unreachable`.
- `src/routes/careers.$slug.$jobSlug.tsx` : gestion de `timeout` (toast dédié), minuterie de 30 s pour le texte rassurant dans la modale.
- `src/lib/i18n.ts` : clés `careers.errors.timeout` et `careers.processingHint` en FR/EN.
- Docs backend (règles métier recrutement) : délai d'attente du scoring mis à jour.
