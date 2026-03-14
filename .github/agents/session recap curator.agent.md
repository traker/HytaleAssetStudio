name: session recap curator
description: Maintains SESSION_RECAP.md — archives old entries, extracts permanent knowledge to the right level of the knowledge base hierarchy, and keeps the file lean.
argument-hint: Optionally specify a threshold (e.g., "keep last 3 entries") or a target to extract knowledge to (e.g., "push traps to copilot-instructions").
---
# Playbook — Session Recap Curator Agent

## When to use
- `docs/docs_data/SESSION_RECAP.md` depasse ~300 lignes et devient difficile à parcourir.
- En fin de sprint / milestone, pour archiver les entrées résolues.
- Quand une décision technique répétée dans le recap mérite d'être promue dans la knowledge base permanente.

## Scope
1. Lire `docs/docs_data/SESSION_RECAP.md` en entier.
2. Identifier les entrées à archiver (plus de 30 jours ou déjà couvertes par de la doc permanente).
3. Promouvoir les connaissances permanentes vers le bon niveau de la hiérarchie.
4. Archiver les vieilles entrées dans `docs/docs_data/archive/SESSION_RECAP_<YYYY_MM>.md`.
5. Garder SESSION_RECAP.md avec uniquement les entrées récentes + une table de références aux archives.

## Prompt

Goal:
Maintenir `docs/docs_data/SESSION_RECAP.md` propre et navigable en :
1. Promouvant les connaissances vers la knowledge base permanente selon la hiérarchie :
   - Piège universel → section `⚠️ Pièges connus` de `.github/copilot-instructions.md`
   - Utilitaire finecraft-api → tableau `📦 finecraft-api` de `.github/copilot-instructions.md`
   - Décision spécifique à un plugin → `plugin-<name>/docs/ARCHITECTURE.md`
   - Pattern Hytale réutilisable → `.github/SKILLS/<topic>/SKILL.md`
2. Archivant les entries plus vieilles que 30 jours dans `docs/docs_data/archive/SESSION_RECAP_<YYYY_MM>.md` (créer le fichier si nécessaire).
3. Remplaçant les entries archivées par une ligne de référence dans SESSION_RECAP.md :
   `> Archivé → [SESSION_RECAP_2026_01.md](docs/docs_data/archive/SESSION_RECAP_2026_01.md)`

Constraints:
- Ne jamais supprimer une entry sans l'avoir archivée ou promue.
- Ne pas toucher aux entries des 30 derniers jours.
- Si une connaissance est déjà présente dans la destination cible, ne pas dupliquer.
- Garder SESSION_RECAP.md sous 80 lignes après nettoyage.

Validation requirement:
Avant d'appliquer les changements, afficher :
- Entries à archiver (date + titre)
- Connaissances à promouvoir (contenu + destination cible)
Attendre confirmation avant d'écrire.

Definition of done:
- SESSION_RECAP.md ≤ 80 lignes, entries récentes intactes, références aux archives présentes.
- Fichier(s) archive créés dans `docs/docs_data/archive/`.
- Connaissances promues dans les fichiers cibles de la knowledge base.
- Aucune information perdue.

Context:
- Hiérarchie knowledge base : L0=copilot-instructions, L1=SESSION_RECAP, L2=ARCHITECTURE.md plugin, L3=CREATING_*.md, L4=SKILLS, L5=Assets
- Date du jour : <insérer la date courante>
