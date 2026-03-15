# Hytale Asset Studio - Document de Vision et Architecture Navigable

## 1. Raison d'être du Projet

Le modding de Hytale repose massivement sur un écosystème vaste et complexe de fichiers JSON profondément entrelacés. Un simple `Item` référence souvent des modèles visuels, des `Interactions` complexes, qui elles-mêmes déclenchent des `Effects`, invoquent des `Projectiles`, jouent des `Sounds` ou émettent des `Particles`. De la même manière, les `Blocks` sont liés à des `Materials`, des tables de loot, et les `Entities` à leurs composants globaux (`Prefabs`, `Behaviors` d'IA). Éditer cet immense graphe de dépendances à la main (via des éditeurs de texte classiques) devient rapidement ingérable, propice aux fautes de frappe, aux références mortes ("broken links") et à la frustration.

**Hytale Asset Studio** est une interface visuelle, une surcouche de confort et de sécurité.
Son objectif premier est de cartographier ces relations (sous forme de Graphe), de protéger les assets vanillas du jeu ("Read-Only"), et d'offrir une interface puissante pour "Override" (écraser) ou créer de zéro des assets pour un plugin/mod spécifique.

## 2. Ce que l'outil N'EST PAS (Les Anti-Objectifs)

* **Ce n'est pas un IDE Hytale Complet.** Il ne compile pas de code Java/C#, il ne lance pas le serveur localement.
* **Ce n'est pas un éditeur 3D.** Il ne gère pas les meshes `.obj` ou `.gltf` ni leur géométrie en 3D.
* **Ce n'est pas un vérificateur JSON strict ultime.** Si le moteur de jeu met à jour sa logique implicite inconnue, l'outil peut l'ignorer, il ne remplace pas les logs d'erreurs du jeu.
* **Ce n'est pas un service distant.** Le Studio manipule volontairement des chemins disque locaux et doit être exploité comme un outil desktop/local-only sur une machine de confiance.

## 3. Architecture Logique (Le "Moteur" Python)

Le socle du fonctionnement repose sur quatre notions métiers (Entities) :

1. **Le Workspace (L'Atelier global)**
   * Il connaît la source "Vanilla" (dossier `Assets/` ou pack ZIP équivalent, en lecture seule).
   * Il connaît le chemin vers les sous-projets (les Plugins/Mods ex: `plugin-poison`).
   * Il expose une liste de **Projets** disponibles (sélection + création).
2. **L'Ordre de Résolution des Packs (Layering / Priorité)**
   * Le Studio est capable d'empiler plusieurs sources d'assets sous forme de "calques" virtuels (ex: 1. `Assets/` Vanilla -> 2. `un_autre_mod.zip` -> 3. `plugin-poison`).
   * Lors du chargement du graphe, si un fichier `Weapon_Sword_Iron.json` existe à la fois dans Vanilla et dans `plugin-poison`, c'est la version avec la **priorité la plus haute** qui éclipse l'autre virtuellement (Shadowing).
   * L'utilisateur peut re-ordonner ces calques pour visualiser l'état final du jeu avec plusieurs mods combinés.
3. **Le Projet Actif (Le Focus / Sortie)**
   * Indique dans quel dossier (parmi les calques chargés) seront **enregistrés** les travaux de la session en cours. Tout nouveau fichier ou override généré par l'outil sera sauvegardé exclusivement dans ce sous-projet.
4. **Le Graphe de Dépendances**
   * Un moteur de parcours (BFS custom côté backend) qui parcourt tous ces JSON superposés, extrait les références croisées et construit la fameuse "carte mentale" des liens. Le graphe résultant (nœuds + edges) est servi au frontend sous forme de données compactes et affiché avec React Flow.

### 3.0. Répartition Frontend / Backend (Performance, Vanilla lourd)

Afin d'éviter des transferts massifs (pack vanilla volumineux, ZIP lourds), le Studio adopte une approche similaire au legacy :

* **Backend (source de vérité)**
   * Accède au disque (dossiers/ZIP), applique la pile de layers, et expose une **VFS** (vue virtuelle) du pack final.
   * Construit les **index** (résolution des IDs JSON, mapping des chemins `Common/` / `Server/`).
   * Calcule et sert le **graphe** (nœuds/edges) et les résultats de recherche.
   * Sert les détails d'un nœud **à la demande** (JSON ou formulaire/structure), sans jamais envoyer l'intégralité du pack.

* **Frontend (client léger)**
   * Affiche le graphe (React Flow) à partir de données compactes (IDs, labels, états: vanilla/local/modifié).
   * Récupère le contenu d'un asset uniquement quand l'utilisateur le sélectionne (panneau latéral / éditeur).

*Règle* : aucune opération ne doit nécessiter de télécharger/copier la totalité de `Common/` + `Server/` vers le navigateur.

### 3.1. Notion de "Projet" (Gestion + Configuration)

Pour rendre les Workflows réellement utilisables, le Studio doit permettre :

* **Sélectionner un projet existant** (ou travailler sans projet actif en mode Vanilla).
* **Créer un nouveau projet** (structure + fichier de configuration minimal).
* **Configurer un projet** : importer/ajouter d'autres packs d'assets comme calques, et gérer leur **ordre de priorité**.

Le terme "Projet" désigne ici l'espace d'override/de sortie (un mod/plugin) + son fichier de configuration.

**Règles de base (décisions de cadrage)**

* **Projet actif = priorité la plus haute** : dans une pile de layers, le projet actif est toujours au-dessus des autres calques (il peut "override" tout le reste). Les autres calques restent réordonnables entre eux.
* **Packs importés en ZIP** : un calque peut provenir d'un dossier ou d'un ZIP (lecture seule). L'objectif est de pouvoir référencer un gros pack vanilla en ZIP si nécessaire.
* **Configuration par-projet, dépendances sans copie** : la configuration d'un projet enregistre uniquement des **références** (chemins/URI) vers des packs dépendants (dossier/ZIP) + leur ordre/activation. Les fichiers d'assets des packs dépendants ne sont pas copiés dans le projet.

Un projet doit donc pouvoir être conçu comme un pack "mince" (overrides) qui dépend d'autres packs (vanilla + packs tiers).

### 3.2. Format de Configuration d'un Projet (Proposition MVP)

Le projet est matérialisé par un dossier (le "root" du mod/plugin) et un fichier de configuration.
Ce fichier doit suffire à :

* reconstituer la pile de layers (vanilla + dépendances + projet actif),
* garantir que **le projet actif est toujours le layer final** (priorité max),
* référencer des packs en **dossier** ou **ZIP** sans les copier.

**Nom et emplacement (proposition)**

* Fichier : `has.project.json`
* Emplacement : à la racine du projet

**Exemple JSON (MVP)**

```json
{
   "schemaVersion": 1,
   "project": {
      "id": "plugin-poison",
      "displayName": "Plugin Poison",
      "rootPath": "K:/mods/plugin-poison",
      "assetsWritePath": "K:/mods/plugin-poison"
   },
   "vanilla": {
      "sourceType": "zip",
      "path": "K:/hytale/Assets.zip"
   },
   "layers": [
      {
         "id": "community-pack",
         "displayName": "Community Pack",
         "sourceType": "folder",
         "path": "K:/mods/community-pack",
         "enabled": true
      },
      {
         "id": "other-mod",
         "displayName": "Other Mod",
         "sourceType": "zip",
         "path": "K:/mods/other-mod.zip",
         "enabled": false
      }
   ]
}
```

**Contrainte importante : racine `Assets/`**

* Un **pack d'assets** est défini par la présence de `Common/` (ressources: images, modèles, sons, UI, etc.) et `Server/` (JSON de comportements/configs).
* `vanilla.path` (et `layers[].path`) doit pointer vers une racine de pack qui contient directement `Common/` et `Server/`.
   * en mode `folder`, c'est typiquement le dossier `.../Assets`
   * en mode `zip`, c'est un ZIP dont la racine interne contient `Common/` et `Server/`
* Tolérance MVP (pratique) : si un ZIP (ou dossier) contient `Assets/Common/` et `Assets/Server/` au lieu de `Common/Server/` à la racine, le Studio peut auto-détecter `Assets/` comme préfixe racine.

**Règles de résolution (déterministes)**

* Layers effectifs = `vanilla` (toujours présent) + `layers[]` (dans l'ordre du tableau, filtrés sur `enabled=true`) + **projet actif** (implicite, toujours dernier).
* En cas de collision (même chemin relatif d'asset), **le dernier layer gagne** (shadowing).
* Les layers externes (`layers[]`) sont des dépendances : ils ne sont jamais modifiés par le Studio.
* `assetsWritePath` est la destination unique des sauvegardes (override / créations).

**Notes MVP**

* `rootPath` et `assetsWritePath` peuvent être identiques : c'est le cas le plus simple pour un **pack** éditable/distribuable (sortie directe en `Common/` + `Server/`).
* Si l'utilisateur veut intégrer le pack dans un plugin FineCraft (Gradle/Java), il peut simplement **copier** le contenu du projet-pack (`Common/` + `Server/`) vers `src/main/resources/` côté plugin.
* Le support des chemins relatifs pourra être ajouté ensuite (ex: chemins relatifs à `rootPath`).

### 3.3. Format de Configuration du Workspace (Accueil + Dossier Projets)

Pour rendre l'Accueil simple et déterministe, le Studio manipule un "Workspace" (au sens : dossier racine choisi par l'utilisateur) qui contient un dossier `projects/`.
Le Studio doit pouvoir :

* lister les projets (scan de `projects/**/has.project.json`),
* créer un projet (écrit dans `projects/<project-id>/`),
* ouvrir un projet existant (en dehors du dossier `projects/` si l'utilisateur le souhaite),
* importer un pack (ZIP/dossier) afin de travailler dessus via un projet.

**Nom et emplacement (proposition)**

* Fichier : `has.workspace.json`
* Emplacement : à la racine du workspace

**Exemple JSON (MVP)**

```json
{
   "schemaVersion": 1,
   "workspace": {
      "rootPath": "K:/hytale-asset-studio-workspace",
      "projectsDir": "K:/hytale-asset-studio-workspace/projects"
   },
   "defaults": {
      "vanilla": {
         "sourceType": "zip",
         "path": "K:/hytale/Assets.zip"
      }
   }
}
```

**Règles (MVP)**

* L'Accueil liste automatiquement les projets sous `projectsDir`.
* Un projet reste ouvrable s'il possède son `has.project.json` (peu importe son emplacement sur disque).
* Les valeurs dans `defaults` servent lors de la **création** d'un projet (pré-remplissage), mais restent surchargeables au niveau du projet.

### 3.3.1. Métadonnées de Pack (manifest.json)

Beaucoup de packs (notamment distribués en ZIP) incluent un `manifest.json` à la racine du pack, ainsi que des fichiers de licence/notes.

* Pour l'import en tant que **layer dépendant**, ce `manifest.json` est **optionnel** pour le Studio.
* S'il est présent et parseable, il peut être utilisé uniquement pour l'UX (écran d'import/layers) :
   * afficher un nom lisible (`Name`, `Group`, `Version`),
   * afficher une icône si un champ type `Icon` pointe vers une ressource du pack.
* Il ne modifie pas la règle principale : un pack est reconnu/valide s'il contient `Common/` et `Server/`.

### 3.3.2. `manifest.json` Minimal (Création / Export)

Le `manifest.json` est requis pour qu'un ZIP exporté soit utilisable par Hytale.

**Validation minimale côté Studio (MVP)**

* Le fichier existe à la racine du projet-pack.
* Le contenu est un JSON parseable dont la racine est un objet.
* Champs requis (observés sur le pack vanilla) :
   * `Group` (string)
   * `Name` (string)

**Champs optionnels (souvent présents dans des packs distribués)**

* `Version` (string)
* `Description` (string)
* `Authors` (array)
* `Icon` (string, chemin vers une ressource du pack — typiquement sous `Common/`)
* `Dependencies` / `OptionalDependencies` (object)
* `DisabledByDefault` (bool)

**Comportement UI attendu**

* Lors de la création d'un projet, le Studio doit pouvoir générer un `manifest.json` minimal (au moins `Group` + `Name`) et laisser l'utilisateur compléter.
* Lors de l'export, si le `manifest.json` est manquant ou invalide, l'export est bloqué (voir Workflow 0.2).

### 3.4. Structure Vanilla et Résolution des Paths (Constat Terrain)

Le pack vanilla tel qu'il est fourni en local suit une structure de type :

* `Assets/Common/` : ressources partagées (textures, modèles, UI, sons, etc.)
* `Assets/Server/` : définitions "server" (items, interactions, prefabs, configs gameplay, etc.)
* `Assets/Cosmetics/` : ressources cosmétiques
* `Assets/manifest.json`

Exemples réels observés :

* Définition item : `Assets/Server/Item/Items/Weapon/Sword/Weapon_Sword_Iron.json`
* Modèle/texture référencés par chemin :
   * `"Model": "Items/Weapons/Sword/Iron.blockymodel"` → résout vers `Common/Items/Weapons/Sword/Iron.blockymodel` (sur disque vanilla : `Assets/Common/...`)
   * `"Texture": "Items/Weapons/Sword/Iron_Texture.png"` → résout vers `Common/Items/Weapons/Sword/Iron_Texture.png` (sur disque vanilla : `Assets/Common/...`)
   * `"Icon": "Icons/ItemsGenerated/Weapon_Sword_Iron.png"` → résout vers `Common/Icons/ItemsGenerated/Weapon_Sword_Iron.png` (sur disque vanilla : `Assets/Common/...`)
* Interactions référencées par ID :
   * `"Interactions": { "Primary": "Root_Weapon_Sword_Primary" }` → résout vers `Assets/Server/Item/RootInteractions/Weapons/Sword/Root_Weapon_Sword_Primary.json`

**Note importante : `RootInteractions` vs `Interactions` (Item)**

Dans les assets Hytale, les "interactions" d'items existent sous deux formes/familles côté `Server/Item/` :

* `Server/Item/RootInteractions/**` : **points d'entrée** (roots) utilisés par les items.
   * Typiquement référencés depuis `Item.*.json` via `"Interactions": { "Primary": "Root_..." }`.
   * Un root contient souvent des paramètres (cooldown, click queuing, etc.) + une liste `"Interactions": ["SomeInteractionId", ...]`.

* `Server/Item/Interactions/**` : **briques réutilisables** d'interaction.
   * Souvent appelées depuis un root (ex: un root référence `Weapon_Sword_Primary`), ou composées entre elles.
   * Peuvent être des structures nodales/hiérarchiques (avec `Next`, `Failed`, `Parallel`, etc.).

Conséquence pour le Studio :

* Les deux sont des assets `Server/**/*.json` et doivent être indexés/résolus par ID.
* L'UI peut les distinguer par un tag dérivé du chemin résolu (ex: `interactionKind = root|interaction`).

**Exemples concrets (extraction d'edges pour le graphe)**

1) Root (point d'entrée) → Interaction (brique)

* Root (`Server/Item/RootInteractions/Weapons/Sword/Root_Weapon_Sword_Primary.json`) :

```json
{
   "Interactions": ["Weapon_Sword_Primary"]
}
```

Edges attendus :

* `Root_Weapon_Sword_Primary` → `Weapon_Sword_Primary`

2) Interaction → Interaction via `Next` et `Replace.DefaultValue.Interactions`

* Interaction (`Server/Item/Interactions/Weapons/Sword/Attacks/Primary/Weapon_Sword_Primary.json`) :

```json
{
   "Type": "Charging",
   "Next": {
      "0": "Weapon_Sword_Primary_Chain",
      "0.2": {
         "Type": "Replace",
         "DefaultValue": { "Interactions": ["Weapon_Sword_Primary_Thrust_StaminaCondition"] }
      }
   }
}
```

Edges attendus :

* `Weapon_Sword_Primary` → `Weapon_Sword_Primary_Chain`
* `Weapon_Sword_Primary` → `Weapon_Sword_Primary_Thrust_StaminaCondition`

3) Interaction nodale (hiérarchie) → Interaction via `Failed` (string)

* Interaction (`Server/Item/Interactions/Dodge/Dodge_Left.json`) :

```json
{
   "Next": { "Type": "Serial", "Interactions": [ {"Type": "ApplyEffect"} ] },
   "Failed": "Stamina_Bar_Flash"
}
```

Edge attendu :

* `Dodge_Left` → `Stamina_Bar_Flash`

**Règle MVP d'extraction**

* Construire un index des IDs `Server/**/*.json` (clé = nom de fichier sans extension).
* Parcourir récursivement chaque JSON et créer un edge quand une valeur string correspond à un ID connu.
   * Cela couvre `RootInteractions.*.Interactions[]`, `Failed`, et les `DefaultValue.Interactions[]` imbriqués.
* Les références vers `Common/<path>` (icônes, textures, modèles) peuvent être extraites séparément comme edges "resource" (optionnel MVP), car elles ne se résolvent pas par ID.

**Limite importante (à revoir)**

Cette règle ("toute string qui matche un ID connu") est volontairement simple, mais elle peut introduire du bruit :

* certains JSON contiennent des strings "ID-like" (underscore / ALL_CAPS) qui ne sont pas des références vers des JSON `Server/**` (tags, enums, valeurs métier),
* certains champs référencent d'autres domaines (ex: `ProjectileId`, `WorldSoundEventId`, `EffectId`) : ce ne sont pas des liens *interaction → interaction*.

Le legacy historique (snapshot `legacy/tools_graph_assets/hytale_graph_viz.py`) illustre bien ce compromis : il traite comme références la plupart des strings qui ressemblent à des IDs/paths, puis tente une résolution par **stem** (nom de fichier) avec quelques heuristiques. C'est pratique pour "voir quelque chose" rapidement, mais pas assez déterministe pour un graphe d'interactions propre.

**Règle MVP+ (recommandée pour un graphe d'interactions fiable)**

Quand le nœud source est une interaction (`Server/Item/RootInteractions/**` ou `Server/Item/Interactions/**`), extraire les edges *interaction → interaction* uniquement depuis des chemins JSON connus pour contenir des IDs d'interaction (observés via l'audit legacy) :

* `Next` (string | objet interaction | dict timeline | list)
* `Failed` (string | objet interaction)
* `Interactions` (list | dict)
* `Replace.DefaultValue.Interactions` (list)
* `ForkInteractions` (list)
* `BlockedInteractions` (list)
* `CollisionNext`, `GroundNext` (string | objet interaction)

Et annoter les edges avec un label (`next`, `failed`, `calls`, `fork`, `blocked`, etc.) pour que l'UI puisse filtrer/afficher correctement.

**Règle MVP de résolution des références (pragmatique)**

1. Une référence qui ressemble à un **chemin de fichier** (contient `/` et une extension comme `.png`, `.blockymodel`, `.blockyanim`) est traitée comme une ressource sous `Common/<ref>` (dans la VFS du pack).
2. Une référence qui ressemble à un **ID** (ex: `Weapon_Sword_Iron`, `Root_Weapon_Sword_Primary`, `Template_Weapon_Sword`) est résolue via un **index** construit au chargement :
    * clé = nom de fichier sans extension (ex: `Root_Weapon_Sword_Primary`)
   * valeur = chemin JSON complet trouvé sous `Server/**/<id>.json` (dans la VFS du pack ; sur disque vanilla : `Assets/Server/...`)
3. Quand plusieurs JSON portent le même ID (collision), le moteur applique la règle des layers (shadowing) puis, à égalité, doit logguer l'ambiguïté (à cadrer ultérieurement).

**Implication pour ZIP**

* Le support ZIP vanilla/packs est valide tant que l'arborescence interne du ZIP contient `Common/` et `Server/` (racine de pack).
* Si la racine interne est `Assets/Common/` et `Assets/Server/`, le Studio peut considérer `Assets/` comme racine (auto-détection).

---

## 4. Distribution (Mode Standalone)

Le Studio est conçu pour être utilisé par des **modders non-développeurs** qui n'ont pas Python ni Node.js installés.
La distribution cible est un **exécutable double-clic** auto-contenu.

### Mode de distribution retenu

- **Exécutable `HytaleAssetStudio.exe`** (Windows, mode `--onedir` PyInstaller).
- L'exe embarque : le backend Python/FastAPI, le frontend React buildé, les DLLs pywebview (EdgeWebView2) et les assemblies pythonnet.
- L'utilisateur double-clique → une fenêtre native s'ouvre (Edge WebView2), le backend démarre en arrière-plan.
- Aucune dépendance à installer (Python, Node, npm) sauf WebView2 Runtime (pré-installé sur Windows 10/11).

### Build d'une release

Depuis la racine du repo, dans un venv avec toutes les dépendances :

```powershell
# Build complet (frontend + exe)
.\scripts\build-release.ps1

# Si le frontend/dist est déjà à jour
.\scripts\build-release.ps1 -SkipFrontendBuild
```

Résultat : `dist/HytaleAssetStudio/` — copier ou zipper ce dossier pour distribuer.

### Lancement standalone (dev/test)

```powershell
python app.py
python app.py --port 8080
```

### Schéma technique

```
HytaleAssetStudio.exe
  └── _internal/
       ├── backend/          (FastAPI, uvicorn — thread daemon)
       ├── frontend/dist/    (React build — servi par StaticFiles)
       ├── webview/lib+js/   (EdgeWebView2 DLLs)
       ├── pythonnet/runtime/ (Python.Runtime.dll)
       └── clr_loader/ffi/   (ClrLoader.dll)
```

### Fichiers clés

| Fichier | Rôle |
|---|---|
| `app.py` | Point d'entrée standalone (uvicorn thread + pywebview window) |
| `HytaleAssetStudio.spec` | Spec PyInstaller (datas, hidden imports, hookspath) |
| `scripts/build-release.ps1` | Script de build release (npm + pyinstaller) |
| `scripts/run.ps1` | Lancement prod sans fenêtre native (frontend buildé + uvicorn) |

---

## 5. Les Workflows (Parcours Utilisateur)

Voici le détail chronologique des actions qu'un utilisateur peut faire avec Hytale Asset Studio :

### Workflow 0 : Accueil — Gestion des Projets (Sélection / Création)

**Objectif :** Entrer dans l'application avec un contexte clair : Vanilla (read-only) ou un projet actif.

1. Au lancement, le Studio affiche une **page d'accueil**.
2. L'utilisateur peut :
   * choisir **"Mode Vanilla"** (aucun projet actif), ou
   * sélectionner un **projet existant**, ou
   * cliquer sur **Créer un projet**.
   * **Ouvrir un pack existant** (ZIP/dossier) pour l'éditer via un projet.
3. Lors de la création :
   * l'utilisateur saisit au minimum un **nom** et un **dossier cible**,
   * le Studio initialise une structure minimale et une configuration de projet,
   * le projet devient sélectionnable et peut être défini comme **Projet Actif**.

4. Lors de **"Ouvrir/Importer un pack"** :
    * l'utilisateur sélectionne un pack (ZIP ou dossier).
    * le Studio valide que le pack contient `Common/` et `Server/` (ou auto-détecte un préfixe `Assets/`).
    * si un `manifest.json` existe à la racine du pack, le Studio peut l'utiliser pour pré-remplir le nom/id/icône (UX uniquement).
    * le Studio crée un **nouveau projet** (par défaut sous `projects/`) :
       * `project.id` dérivé du manifest ou du nom du fichier (slug),
       * `project.rootPath` = `projects/<project.id>/` (ou dossier choisi),
       * `project.assetsWritePath` initialisé (par défaut) sur `project.rootPath` (projet = pack).
    * le Studio écrit `has.project.json` qui déclare le pack importé comme **layer dépendant** :
       * `vanilla` vient des defaults workspace (si disponible),
       * `layers[0]` = le pack importé (enabled=true),
       * le **projet actif** reste implicite et sera toujours le dernier layer (priorité max).
    * le pack source reste **lecture seule** : toute modification est faite en overrides dans le projet actif.

**Règle d'écriture (import pack → overrides)**

* Pour surcharger une ressource `Common/<path>`, le Studio écrit dans `<assetsWritePath>/Common/<path>`.
* Pour surcharger un comportement `Server/<path>.json`, le Studio écrit dans `<assetsWritePath>/Server/<path>.json`.
* Le Studio ne doit jamais modifier le ZIP/dossier importé.

*Règle Métier :* la création/gestion de projet ne doit jamais modifier les assets vanilla.

### Workflow 0.1 : Configuration d'un Projet — Packs importés, Layers et Priorités

**Objectif :** Définir l'état final “comme en jeu” via une pile de calques (vanilla + packs + projet) ordonnés.

1. Depuis l'accueil (ou via un accès dédié), l'utilisateur ouvre la **page de configuration du projet**.
2. Il peut **ajouter/importer** une source d'assets en tant que calque (ex: dossier local, pack externe en ZIP).
3. Il peut **activer/désactiver** des calques et **réordonner** la pile.
4. Le Studio affiche clairement :
   * le calque vanilla (toujours présent, lecture seule; dossier ou ZIP),
   * le **projet actif** (toujours en haut, priorité max),
   * les calques externes (packs) intercalés selon la priorité.
5. En validant, la pile de calques est persistée dans la configuration du projet et devient la base de chargement du graphe.

### Workflow 0.2 : Exporter un Pack (ZIP)

**Objectif :** Produire un ZIP distribuable d'un projet-pack (sans embarquer la configuration Studio), contenant uniquement les assets et métadonnées utiles.

1. Depuis la configuration du projet, l'utilisateur clique **Exporter**.
2. Le Studio propose un nom de fichier par défaut (ex: `<project.id>-<version>.zip` si un `manifest.json` existe).
3. **Validation :** le projet doit contenir un `manifest.json` à la racine. Sinon l'export doit être bloqué avec un message d'erreur clair.
4. Le Studio construit un ZIP avec la racine :
   * `Common/` (si présent dans le projet)
   * `Server/` (si présent dans le projet)
   * `manifest.json` (obligatoire)
   * fichiers optionnels (si présents) : `LICENSE*`, `THIRD_PARTY_NOTICES*`, `README*`, etc.
5. Le Studio exclut explicitement les fichiers internes de travail :
   * `has.project.json`
   * `has.workspace.json`
   * caches/artefacts éventuels (`.studio_cache/`, etc.)
6. Le Studio n'embarque pas les packs dépendants : l'export contient uniquement ce que le projet a réellement (overrides + créations).

### Workflow A : Découverte & Lecture (Mode Vanilla)

**Objectif :** Comprendre comment l'équipe Hytale a conçu un objet.

1. L'utilisateur lance le Studio sans sélectionner de projet actif.
2. Il cherche un objet, ex: `Weapon_Sword_Iron`.
3. Le Studio affiche le graphe pyramidal (`Weapon_Sword_Iron` -> `interaction_attack` -> `damage_effect`).
4. En cliquant sur chaque nœud, un panneau (en mode "Read-Only") affiche le JSON ou un formulaire stylisé.
5. *Règle Métier :* Aucun bouton de sauvegarde n'est disponible. Le joueur ne peut pas casser `/Assets/`.

### Workflow B : Modification d'un Existant (Override) & Clonage Partiel (Lazy-Copy)

**Objectif :** Rendre l'épée en fer empoisonnée dans mon mod "plugin-poison" ou en créer une variante ("Clone").

1. L'utilisateur lance le Studio et sélectionne `plugin-poison` comme **Projet Actif**.
2. Il navigue jusqu'à `Weapon_Sword_Iron`.
3. Le graphe indique visuellement que tous ses composants (interactions, modèles, sons) viennent de `Vanilla (Assets/)`.
4. Il modifie une valeur (ex: les dégâts) ou ajoute un nœud directement dans l'éditeur (en mémoire).
5. Au moment de cliquer sur **Sauvegarder** (en Override ou en "Enregistrer sous / Cloner"), le Backend **génère et sauvegarde uniquement les fichiers explicitement modifiés** vers `<assetsWritePath>/...` (ex: `<assetsWritePath>/Server/...` ou `<assetsWritePath>/Common/...`).
6. Le reste du graphe (effets visuels, effets sonores, interactions non touchées) n'est **pas** copié. Le ficher cloné/modifié continue de pointer vers les assets d'origine Vanilla.
7. Le graphe se met à jour : seul le nœud altéré change de couleur ("Local / Modifié"), minimisant drastiquement le poids du mod ("DRY").

### Workflow C : Édition Visuelle d'Interactions (Éditeur Nodal)

**Objectif :** Ne plus s'arracher les cheveux sur les listes imbriquées du système d'Interaction de Hytale.

1. L'utilisateur sélectionne l'Interaction de son épée.
2. Il ouvre "L'Éditeur d'Interaction" plein écran.
3. Le backend convertit la structure JSON hiérarchique complexe (les listes, les `Parallel`, les `Next`, `Failed`) en un graphe plat de navigation.
4. L'utilisateur glisse-dépose de nouveaux nœuds de logique (ex: `Condition`, `PlaySound`) depuis la palette.
5. Il relie les nœuds avec des câbles (les "Edges").
6. En cliquant sur le bouton **Sauvegarder**, l'éditeur compacte et re-transforme visuellement ce dessin en véritable arborescence JSON valide de listes imbriquées, gérant dynamiquement les références externes.

### Workflow D : Création par Héritage (Templates & Prefabs)

**Objectif :** Créer un nouvel élément (ex: une nouvelle arme, un sortilège, un bloc) proprement, sans réécrire tout le comportement de base.

1. Hytale utilise massivement un système de **Templates / Fichiers de Base** qui spécifient les comportements et paramètres génériques par catégorie d'objet.
2. L'utilisateur lance l'assistant de création dans le Studio et choisit le profil souhaité (ex: `Template_Sword`).
3. Le Studio liste les templates disponibles au sein du graphe (Vanilla ou Mods locaux).
4. Le Backend génère un nouveau fichier JSON dans le projet actif qui invoque cet **héritage** (ex: via un parent `Prefab`).
5. L'interface (via le Formulaire) permet à l'utilisateur de se concentrer sur les **Overrides** (surcharges) : changer la texture, ajuster la durabilité, ou étendre les fonctionnalités, évitant ainsi un code dupliqué massif et gardant la structure minimale et saine.

### Workflow E : Gestion et Visualisation des Patchs Hytalor (Objectif Futur)

**Objectif :** Modifier des assets de manière granulaire et non destructrice grâce au système de patch de Hytalor, souvent utilisé dans FineCraft.

1. L'utilisateur souhaite ajouter une petite propriété (ex: un nouveau `State` empoisonné à une arme) sans avoir à cloner tout le fichier de l'arme (même avec un clone paresseux).
2. Il crée un fichier de "Patch" (ex: `+Weapon_Sword_Iron.json` pour Hytalor).
3. Le Studio propose une interface dédiée pour rédiger ce patch.
4. **Vue "Dry-Run" (Aperçu) :** Le backend émule le comportement de Hytalor. Il fusionne virtuellement le fichier d'origine et le patch, pour afficher au moddeur le *JSON final généré* tel que le jeu le lira in-game. Cela permet de vérifier instantanément que la syntaxe du patch (qui est source de nombreuses erreurs) est valide.
5. *Note : Cette fonctionnalité est techniquement complexe (nécessite l'émulation du résolveur de patchs Hytalor) et est consignée ici pour la feuille de route à long terme.*

## 6. Principes d'Interface (UI/UX) et Comportements Visuels

Pour éviter que le Front-end (React/Vite) ne parte dans toutes les directions, il doit respecter quelques règles claires et unifiées :

0. **Navigation minimale (Pages)**
   * **Accueil** : sélection / création de projet, entrée "Mode Vanilla".
   * **Configuration Projet** : gestion des layers (ajout/import), activation, ordre/priorité.
   * **Vue Graphe** : espace principal (React Flow) + panneau latéral.
   * **Éditeur d'Interaction** : vue plein écran (Workflow C).

1. **L'Espace Graphes (React Flow) au Centre :**
   * L'élément central de l'application est toujours le graphe (nœuds et liens).
2. **Le Panneau de Propriétés (Side-Panel) :**
   * Un clic sur un nœud ouvre un panneau latéral. 
   * Ce panneau doit proposer un **rendu visuel simplifié (Formulaire JSON Schema)** pour une édition conviviale, avec un toggle ("RAW/JSON") pour les utilisateurs avancés.
3. **Thème Global :**
   * Interface "Dark Mode" native (`#1e1e1e`), pour s'intégrer visuellement aux outils de développement modernes comme VS Code, réduisant la fatigue visuelle sur les longues sessions.
4. **Indicateurs d'États :**
   * Les fichiers non sauvegardés (Modified en mémoire) doivent avoir un indicateur visuel clair (ex: étoile ou puce `*` sur le nœud) et un bouton "Sauvegarder" global ou contextuel bien en évidence.

---

*Ce document forme le cahier des charges. Tout code écrit dans ce projet (Back et Front) doit répondre à au moins l'un de ces Workflows et respecter les Anti-Objectifs.*
