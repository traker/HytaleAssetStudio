**Lot 1: Sécuriser les invariants critiques**
Objectif: garantir qu’un utilisateur travaille toujours sur le bon workspace, que les créations n’écrasent rien, et que les exports soient propres.

1. Faire respecter réellement le workspace sélectionné
Fichiers concernés:
workspace.py
projects.py
projects.py
workspace_service.py

Ce qu’il faut changer:
- Arrêter d’ignorer workspaceId.
- Associer workspaceId à un rootPath réel.
- Passer explicitement ce rootPath aux opérations list, create, import, open si nécessaire.
- Refuser un workspaceId inconnu au lieu de retomber silencieusement sur settings.workspace_root.

Option retenue:
- stocker une résolution workspaceId -> rootPath en backend et l’utiliser partout.

Critère d’acceptation:
- Si j’ouvre deux workspaces différents, la liste de projets et la création se font bien dans le workspace attendu.
- Impossible de créer/importer dans un autre workspace “par accident”.

2. Rendre la création de projet atomique
Fichier concerné:
workspace_service.py

Ce qu’il faut changer:
- Vérifier l’existence du projet avant toute écriture.
- Ne pas créer Common, Server ou manifest tant que la validation complète n’est pas passée.
- Idéalement: construire tout en mémoire, puis écrire à la fin.
- Si tu veux être rigoureux: en cas d’échec après début d’écriture, rollback minimal.

Ordre recommandé:
- Calcul du target path
- Validation conflit
- Validation manifest et config
- Création des dossiers
- Écriture des fichiers

Critère d’acceptation:
- Une création qui échoue ne laisse aucun fichier partiellement créé.
- Un projet existant ne voit jamais son manifest écrasé par erreur.

3. Nettoyer l’export ZIP
Fichier concerné:
export_service.py

Ce qu’il faut changer:
- Exclure .studio_cache
- Exclure tout futur fichier de métadonnées studio
- N’exporter idéalement que:
  - Common
  - Server
  - manifest.json
  - éventuellement d’autres fichiers pack-valides explicitement autorisés

Je te conseille de passer d’une logique blacklist à une logique whitelist. C’est beaucoup plus sûr pour un export distribué.

Critère d’acceptation:
- Le ZIP ne contient aucun fichier interne studio.
- Le ZIP final correspond à ce que Hytale attend réellement.

**Lot 2: Fiabiliser les données métier**
Objectif: éviter les incohérences silencieuses sur import, index, IDs et sauvegardes.

1. Préserver correctement le manifest à l’import
Fichier concerné:
workspace_service.py

Ce qu’il faut changer:
- Si manifest.json source est valide, le recopier presque entièrement dans le projet importé.
- Si certains champs doivent être normalisés, le faire explicitement.
- Si le manifest est invalide, renvoyer un warning clair ou une erreur structurée.
- Ne plus tomber silencieusement sur un manifest minimal sans le signaler.

Ce que je ferais:
- Stratégie permissive: importer toutes les clés connues du modèle ProjectManifest.
- Logger les clés inconnues si tu veux, mais ne pas perdre les clés utiles standard.

Critère d’acceptation:
- Un import suivi d’un export ne détruit pas Version, Authors, Description, Dependencies, etc.

2. Revoir la stratégie de cache d’index
Fichier concerné:
index_service.py

Problème de fond:
Le cache est aujourd’hui lié à la config projet, pas à l’état des fichiers.

Plan minimal:
- Invalider le cache dès qu’un write studio est fait.
- Ajouter un bouton rebuild explicite côté UI déjà exploitable.
- Exposer dans la réponse de l’index ou du graph si le résultat vient du cache.

Plan plus solide:
- Intégrer dans le fingerprint des signatures simples:
  - mtime de manifest
  - mtime max sous Server du projet
  - mtime max sous Common du projet
  - éventuellement signature des layers si dossier local

Je ne te conseille pas de fingerprint tout le contenu des gros packs vanilla à chaque appel: trop cher. Il faut un compromis.

Critère d’acceptation:
- Après un changement disque pertinent, le graph et la search ne restent pas faux.
- Après une sauvegarde via le studio, l’état rechargé est toujours cohérent.

3. Gérer explicitement les collisions d’IDs
Fichiers concernés:
index_service.py
asset_service.py
graph_service.py
index_graph.py

Aujourd’hui, les IDs ambigus disparaissent des chemins principaux. Ce n’est pas tenable pour un éditeur de layering.

Plan recommandé:
- Garder deux concepts séparés:
  - résolution “par ID unique”
  - résolution “par chemin effectif”
- Quand un ID est ambigu:
  - le search doit le montrer avec un état ambiguous
  - l’UI doit afficher les chemins candidats
  - l’utilisateur doit pouvoir ouvrir un asset par chemin VFS ou par choix explicite

En pratique:
- Ajouter un champ ambiguity ou candidatePaths dans les résultats search
- Ne pas faire disparaître ces assets du monde visible
- Réserver le 409 aux cas où l’utilisateur demande “ouvre server:Foo” sans désambiguïsation possible

Critère d’acceptation:
- Un asset ambigu apparaît dans la recherche.
- L’utilisateur comprend pourquoi il est ambigu et peut choisir.

4. Sécuriser Save as
Fichier concerné:
asset_service.py

Ce qu’il faut ajouter:
- Refuser un newId déjà existant dans le projet actif
- Refuser si le chemin cible existe déjà, sauf mode overwrite explicite
- Vérifier aussi collision avec asset déjà résolu dans la VFS si tu veux éviter les surprises de shadowing involontaire

Critère d’acceptation:
- Save as ne peut jamais écraser silencieusement un asset existant.

**Lot 3: Rendre l’outil plus robuste au quotidien**
Objectif: meilleure DX, meilleure UX d’erreur, moins de dette.

1. Arrêter de masquer les erreurs utiles
Fichiers concernés:
workspace_service.py
project_service.py
App.tsx
ProjectModifiedGraphView.tsx
ProjectModifiedGraphView.tsx

Backend:
- Remplacer les except Exception: continue silencieux par:
  - log structuré
  - éventuellement collecte d’erreurs non bloquantes
- Exemple utile: projets invalides listés avec statut invalid plutôt que supprimés de la vue

Frontend:
- Remplacer les catch vides par un pattern standard:
  - toast ou bannière
  - message court
  - retry éventuel

Critère d’acceptation:
- Une erreur de refresh, expand ou parsing devient visible et compréhensible.

2. Normaliser la sérialisation Pydantic
Fichiers concernés:
projects.py
workspace_service.py
workspace_service.py

Ce qu’il faut faire:
- Remplacer tous les .dict() par le helper commun déjà présent
- Garder une seule manière de sérialiser les modèles

Ce n’est pas urgent fonctionnellement, mais c’est une dette facile à rembourser.

3. Réduire les assertions frontend fragiles
Fichiers concernés:
ProjectGraphEditor.tsx
ProjectModifiedGraphView.tsx
layoutDagre.ts

Ce qu’il faut faire:
- Introduire un type GraphNodeData clair
- Utiliser des type guards simples
- Éviter les as any sur les zones de navigation et d’édition

Gain:
- moins de bugs silencieux après évolution du backend
- refactors frontend beaucoup plus sûrs

4. Traiter l’avertissement bundle
Fichiers concernés:
package.json
vite.config.ts

Le build passe, mais le bundle principal est lourd. Ce n’est pas un P0, mais c’est un bon sujet après stabilisation.

Ce que je ferais:
- charger Monaco en lazy
- isoler les vues graphe et éditeur interaction en split dynamique
- ne pas toucher au chunking tant que les vrais risques métier ne sont pas réglés

**Tests à ajouter en priorité**
Si tu ne poses pas un minimum de tests backend maintenant, chaque correction du lot 1 et 2 restera fragile.

Je te recommande ce socle minimal:

1. Tests backend sur create_project
- refuse proprement un projet existant
- n’écrit rien en cas d’échec
- crée bien Common, Server, manifest et has.project.json sur succès

2. Tests backend sur export
- échoue sans manifest valide
- n’embarque pas .studio_cache
- produit un ZIP avec seulement les fichiers pack attendus

3. Tests backend sur import_pack
- conserve les champs essentiels du manifest importé
- gère manifest invalide de manière explicite

4. Tests backend sur index/collisions
- collision de deux IDs identiques
- asset ambigu visible en search
- ouverture par ID ambigu renvoie une erreur structurée

5. Tests backend sur asset write
- override met à jour l’index
- save as refuse l’écrasement

**Ordre d’exécution recommandé**
Je ferais exactement cet ordre:

1. Corriger workspace réel ou assumer mono-workspace proprement
2. Corriger atomicité create_project
3. Corriger whitelist export ZIP
4. Corriger save as et écrasements
5. Corriger import manifest
6. Corriger invalidation index
7. Corriger collisions d’IDs
8. Uniformiser erreurs backend/frontend
9. Ajouter typage frontend
10. Optimiser bundle plus tard

**Version pragmatique**
Si tu veux une trajectoire courte et efficace, je te propose deux jalons.

Jalon A, stabilisation:
- workspace
- create_project atomique
- export whitelist
- save as safe
- logs d’erreurs non silencieux
- tests backend de base

Jalon B, fiabilisation métier:
- import manifest complet
- cache index plus fiable
- gestion claire des collisions
- amélioration UX des erreurs
- nettoyage du typage frontend

