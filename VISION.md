# Hytale Asset Studio - Document de Vision et Architecture Navigable

## 1. Raison d'être du Projet

Le modding de Hytale repose massivement sur un écosystème vaste et complexe de fichiers JSON profondément entrelacés. Un simple `Item` référence souvent des modèles visuels, des `Interactions` complexes, qui elles-mêmes déclenchent des `Effects`, invoquent des `Projectiles`, jouent des `Sounds` ou émettent des `Particles`. De la même manière, les `Blocks` sont liés à des `Materials`, des tables de loot, et les `Entities` à leurs composants globaux (`Prefabs`, `Behaviors` d'IA). Éditer cet immense graphe de dépendances à la main (via des éditeurs de texte classiques) devient rapidement ingérable, propice aux fautes de frappe, aux références mortes ("broken links") et à la frustration.

**Hytale Asset Studio** est une interface visuelle, une surcouche de confort et de sécurité.
Son objectif premier est de cartographier ces relations (sous forme de Graphe), de protéger les assets vanillas du jeu ("Read-Only"), et d'offrir une interface puissante pour "Override" (écraser) ou créer de zéro des assets pour un plugin/mod spécifique.

## 2. Ce que l'outil N'EST PAS (Les Anti-Objectifs)

* **Ce n'est pas un IDE Hytale Complet.** Il ne compile pas de code Java/C#, il ne lance pas le serveur localement.
* **Ce n'est pas un éditeur 3D.** Il ne gère pas les meshes `.obj` ou `.gltf` ni leur géométrie en 3D.
* **Ce n'est pas un vérificateur JSON strict ultime.** Si le moteur de jeu met à jour sa logique implicite inconnue, l'outil peut l'ignorer, il ne remplace pas les logs d'erreurs du jeu.

## 3. Architecture Logique (Le "Moteur" Python)

Le socle du fonctionnement repose sur quatre notions métiers (Entities) :

1. **Le Workspace (L'Atelier global)**
   * Il connaît le chemin vers `Assets/` (les données "Vanilla" de base de Hytale).
   * Il connaît le chemin vers les sous-projets (les Plugins/Mods ex: `plugin-poison`).
2. **L'Ordre de Résolution des Packs (Layering / Priorité)**
   * Le Studio est capable d'empiler plusieurs sources d'assets sous forme de "calques" virtuels (ex: 1. `Assets/` Vanilla -> 2. `un_autre_mod.zip` -> 3. `plugin-poison`).
   * Lors du chargement du graphe, si un fichier `Weapon_Sword_Iron.json` existe à la fois dans Vanilla et dans `plugin-poison`, c'est la version avec la **priorité la plus haute** qui éclipse l'autre virtuellement (Shadowing).
   * L'utilisateur peut re-ordonner ces calques pour visualiser l'état final du jeu avec plusieurs mods combinés.
3. **Le Projet Actif (Le Focus / Sortie)**
   * Indique dans quel dossier (parmi les calques chargés) seront **enregistrés** les travaux de la session en cours. Tout nouveau fichier ou override généré par l'outil sera sauvegardé exclusivement dans ce sous-projet.
4. **Le Graphe de Dépendances**
   * Un moteur `NetworkX` qui parcourt tous ces JSON superposés, extrait les références croisées et construit la fameuse "carte mentale" des liens.

## 4. Les Workflows (Parcours Utilisateur)

Voici le détail chronologique des actions qu'un utilisateur peut faire avec Hytale Asset Studio :

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
5. Au moment de cliquer sur **Sauvegarder** (en Override ou en "Enregistrer sous / Cloner"), le Backend **génère et sauvegarde uniquement les fichiers explicitement modifiés** vers `/plugin-poison/src/main/resources/...`.
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

## 5. Principes d'Interface (UI/UX) et Comportements Visuels

Pour éviter que le Front-end (React/Vite) ne parte dans toutes les directions, il doit respecter quelques règles claires et unifiées :

1. **L'Espace Graphes (React Flow) au Centre :**
   * L'élément central de l'application est toujours le graphe (nœuds et liens).
   * **Couleurs Sémantiques :** Un nœud "Vanilla" (Read-Only) aura une couleur fixe (ex: gris/bleu), un nœud surchargé par un mod aura une autre couleur (ex: orange/doré), et un nœud nouvellement créé sera vert. Cela permet de lire le "Load Order" en un clin d'œil.
2. **Le Panneau de Propriétés (Side-Panel) :**
   * Un clic sur un nœud ouvre un panneau latéral. 
   * Ce panneau doit proposer un **rendu visuel simplifié (Formulaire JSON Schema)** pour une édition conviviale, avec un toggle ("Raw/JSON") pour les utilisateurs avancés.
3. **Thème Global :**
   * Interface "Dark Mode" native (`#1e1e1e`), pour s'intégrer visuellement aux outils de développement modernes comme VS Code, réduisant la fatigue visuelle sur les longues sessions.
4. **Indicateurs d'États :**
   * Les fichiers non sauvegardés (Modified en mémoire) doivent avoir un indicateur visuel clair (ex: étoile ou puce `*` sur le nœud) et un bouton "Sauvegarder" global ou contextuel bien en évidence.

---

*Ce document forme le cahier des charges. Tout code écrit dans ce projet (Back et Front) doit répondre à au moins l'un de ces Workflows et respecter les Anti-Objectifs.*
