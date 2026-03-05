# Architecture & Stratégie : Éditeur Visuel d'Assets (Hytale Asset Graph Editor)

L'outil actuel (Python + `vis-network`) est excellent pour la visualisation et le clonage massif, mais montre ses limites si l'on veut **éditer finement** et créer de zéro. Pour atteindre l'objectif d'un "Blueprint editor" (façon Unreal Engine) conçu pour le modding Hytale JSON-based, voici l'architecture recommandée.

---

## 1. Fonctionnalités Cibles de l'Éditeur

Un tel outil ferait passer la création de contenu (Item → Interaction → Projectile → Effet) de "fichiers textes isolés" à un "flux visuel logique" :

*   **Édition In-Place & Validation :** Chaque nœud représente un fichier JSON. Ses champs (ex: dégâts, portée, cooldown) sont éditables directement. Un **Validateur par Schéma JSON** (réutilisant les schémas existants de FineCraft) souligne les erreurs en temps réel.
*   **Liens de Référence (Drag & Drop) :** Tirer un câble depuis le port `HitEffectId` d'un nœud Projectile et le relier à un nœud Effet met automatiquement à jour la référence ID textuelle dans le fichier JSON source.
*   **Palette de Création (Boîte à outils) :** Un menu latéral drag-and-drop permet de glisser un bloc "Nouvelle Arme de Mêlée" ou "Nouvel Effet de Statut" : le backend crée le template JSON correspondant sur disque.
*   **Gestion Safe des Overrides (Patchs) :** Si tu modifies un nœud qui est un asset "Vanilla" (`Assets/Server/...`), l'éditeur propose automatiquement de "Créer un JsonPatch Hytalor" ou de "Cloner dans un nouveau Namespace" au lieu de chercher à réécrire la source en lecture seule.
*   **Aperçu Intégré :** Un panneau (ou survol de nœud) permettant de voir le JSON brut (via Monaco Editor/façon VS Code) et, à terme, un viewer 3D web pour les `.blockymodel`.

---

## 2. Recommandations Techniques Front-end

`vis-network` (Canvas simple) est trop basique pour héberger des formulaires complexes, des menus déroulants et des validateurs de schéma à l'intérieur des nœuds.

**La Stack de Référence (Idéale pour FineCraft) :**
*   **Frontend : React (via Vite.js)**
*   **Moteur Graphe : [React Flow](https://reactflow.dev/) (XYFlow)**
    *   *Pourquoi ?* React Flow est le standard de l'industrie pour les node-editors web (utilisé par Stripe, Supabase). Il combine le dessin de graphe avec la capacité d'injecter des **composants HTML/React complets** à l'intérieur des nœuds. 
    *   Chaque type d'asset Hytale (Projectile, Item) devient un "Custom Node" avec ses propres champs de saisies.
*   **Backend : Maintien de l'API Flask (Python)**
    *   Sert d'intermédiaire pour lire/écrire sur le disque, résoudre les chemins, et analyser les dossiers (ce qu'on a déjà solidifié via `hytale_graph_viz.py`).

**Alternatives (Moins optimales ici) :**
*   *LiteGraph.js :* Très performant mais purement Canvas (très pénible pour faire de l'UI classique dans un nœud).
*   *Rete.js :* Plus lourd, centré sur le calcul nodal (programmation visuelle) plutôt que sur l'édition documentaire de JSON.

---

## 3. Feuille de Route pour la Transition (3 Phases)

### Phase 1 : Migration Front & Vue Riche (Lecture Seule)
*Remplacer l'outil actuel par l'architecture définitive sans perdre de fonctionnalités.*
1. Initialiser une application React `vite` (dossier `tools/graph_assets/react-ui`).
2. Remplacer `vis-network` par `React Flow` : mapper le JSON renvoyé par l'API Flask vers le format Nodes/Edges de React Flow.
3. Intégrer un algorithme d'auto-layout (comme *Dagre.js*) pour que le graphe soit lisible au premier chargement.
4. Créer un Panneau Inspecteur latéral qui affiche le contenu JSON formaté (avec Coloration syntaxique) du nœud sélectionné.

### Phase 2 : Mode Éditeur de Fichiers & Persistance
*Passer de l'inspection à l'action.*
1. Intégrer `@monaco-editor/react` (pour avoir l'expérience VS Code) dans le panneau Inspecteur.
2. Ajouter le validateur (JSON Schema) côté Front pour avertir des erreurs avant sauvegarde.
3. Créer la route backend `POST /api/save_node` qui écrit la modification dans le bon fichier JSON sur disque, en vérifiant si c'est un projet FineCraft et non le dossier Vanilla.
4. Intégrer dans les "Custom Nodes" de React Flow quelques champs rapides éditables (ex: le nom de l'item, le cooldown).

### Phase 3 : Le "Hytale Blueprint" complet
*L'outil devient le chef d'orchestre de la création.*
1. Rendre les "Edges" (liens) interactifs : dessiner une ligne modifie le sous-champ du JSON correspondant.
2. Créer une interface "Palette de Nœuds" (Drag & drop) pour générer de nouveaux fichiers `interactions/`, `items/` sur le disque.
3. Implémenter le switch "Modification d'un Vanilla = Génération d'un Patch Hytalor".
