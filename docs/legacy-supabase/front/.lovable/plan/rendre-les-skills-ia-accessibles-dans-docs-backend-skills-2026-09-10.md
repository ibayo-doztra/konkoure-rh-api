# Rendre les skills IA accessibles dans docs/backend/skills

## Contexte
Les 17 skills IA Claude Code existent dans `.claude/skills/konkoure-*/SKILL.md`. Ce dossier est caché et n'apparaît pas facilement dans l'explorateur de fichiers de Lovable. L'utilisateur souhaite pouvoir les consulter rapidement depuis `docs/backend/`.

## Important
Les skills IA doivent rester physiquement dans `.claude/skills/` pour que Claude Code puisse les charger automatiquement selon leur `description`. Les déplacer définitivement casserait ce mécanisme.

## Solution retenue
Créer un miroir accessible dans `docs/backend/skills/` tout en conservant les originaux dans `.claude/skills/`.

## Étapes

1. **Créer le dossier cible**
   - `docs/backend/skills/`

2. **Copier les 17 skills**
   - Copier chaque dossier `.claude/skills/konkoure-<nom>/` vers `docs/backend/skills/konkoure-<nom>/`.
   - Conserver les fichiers `SKILL.md` intacts.

3. **Mettre à jour la documentation**
   - `docs/backend/14-skills-ia-claude-code.md` : ajouter une note indiquant que les skills sont consultables aussi dans `docs/backend/skills/`, mais que la source active reste `.claude/skills/`.
   - `docs/backend/13-skills-claude.md` : idem, préciser l'emplacement caché vs. emplacement lisible.
   - `CLAUDE.md` : ajouter une ligne indiquant le miroir de consultation.

4. **Vérification**
   - Confirmer que `docs/backend/skills/` contient bien 17 sous-dossiers.
   - Confirmer que `.claude/skills/` contient toujours les 17 originaux.
   - Vérifier qu'aucun lien interne ne pointe vers l'ancien chemin de manière exclusive.

## Livrables
- Dossier `docs/backend/skills/` avec les 17 skills lisibles.
- Documentation mise à jour pour distinguer emplacement actif (`.claude/skills/`) et emplacement de lecture (`docs/backend/skills/`).
