# API Backend — Spécification Minimale (MVP)

Objectif : définir une API **stable, minimaliste et performante** pour Hytale Asset Studio.

Contraintes clés :

- Les packs (vanilla + dépendances) sont **lourds** : le backend est la source de vérité (lecture disque/ZIP, index, graphe). Le frontend ne récupère que des **données compactes**.
- Un pack d'assets est défini par `Common/` + `Server/`.
- Le **projet actif** est toujours le dernier layer (priorité max).
- Les packs dépendants (layers) sont **read-only**. Seul le projet écrit dans `assetsWritePath`.
- L'export ZIP nécessite `manifest.json` **obligatoire** (à la racine du pack exporté).

---

## 1) Concepts et identifiants

### 1.1 Pack Source

Une source de pack est soit :

- `sourceType: "folder"` + `path` vers une racine contenant `Common/` et `Server/`,
- `sourceType: "zip"` + `path` vers un ZIP dont la racine interne contient `Common/` et `Server/`.

Tolérance (MVP) : si `Assets/Common` et `Assets/Server` existent, le backend peut auto-détecter `Assets/` comme préfixe.

### 1.2 Références d'assets

Le backend doit distinguer deux familles de références :

- **Ressources Common** : références de type chemin (contient `/` + extension `.png`, `.ogg`, `.blockymodel`, `.blockyanim`, etc.)
  - exemple : `Icons/ItemsGenerated/Weapon_Sword_Iron.png`
  - canonique : `Common/Icons/ItemsGenerated/Weapon_Sword_Iron.png`

- **JSON Server** : références par **ID** (nom de fichier sans extension)
  - exemple : `Root_Weapon_Sword_Primary`
  - résolu via index : `Server/**/Root_Weapon_Sword_Primary.json`

### 1.3 Identifiants API

- `workspaceId` : identifiant interne (peut être un chemin normalisé encodé, ou un UUID) — MVP : on peut utiliser un UUID et stocker la config en mémoire + sur disque.
- `projectId` : correspond à `project.id` du `has.project.json`.
- `assetKey` : identifiant canonique d'un asset pour l'API, sous forme :
  - `common:<relativePath>` → ex: `common:Icons/ItemsGenerated/Weapon_Sword_Iron.png`
  - `server:<id>` → ex: `server:Weapon_Sword_Iron`

---

## 2) Convention HTTP

- Base : `/api/v1`
- JSON UTF-8
- Erreurs :
  - `400` validation input
  - `404` introuvable
  - `409` conflit (collision ID ambiguë non résoluble)
  - `422` validation métier (ex: export sans manifest)

Réponse erreur standard :

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable",
    "details": {}
  }
}
```

---

## 3) Workspace

### 3.1 Ouvrir un workspace

`POST /api/v1/workspace/open`

Request:

```json
{
  "rootPath": "K:/hytale-asset-studio-workspace"
}
```

Response:

```json
{
  "workspaceId": "...",
  "rootPath": "K:/hytale-asset-studio-workspace",
  "projectsDir": "K:/hytale-asset-studio-workspace/projects",
  "defaults": {
    "vanilla": { "sourceType": "zip", "path": "K:/hytale/Assets.zip" }
  }
}
```

Notes :

- Le backend lit/écrit `has.workspace.json`.

### 3.2 Lister les projets

`GET /api/v1/workspace/{workspaceId}/projects`

Response:

```json
{
  "projects": [
    {
      "projectId": "plugin-poison",
      "displayName": "Plugin Poison",
      "rootPath": "...",
      "assetsWritePath": "..."
    }
  ]
}
```

---

## 4) Projets

### 4.1 Créer un projet-pack

`POST /api/v1/workspace/{workspaceId}/projects/create`

Request (MVP):

```json
{
  "projectId": "bardtale-overrides",
  "displayName": "BardTale Overrides",
  "targetDir": "K:/hytale-asset-studio-workspace/projects/bardtale-overrides",
  "vanilla": { "sourceType": "zip", "path": "K:/hytale/Assets.zip" },
  "manifest": {
    "Group": "MyGroup",
    "Name": "MyPack",
    "Version": "0.1.0",
    "Icon": "Common/Icons/MyPack.png"
  }
}
```

Response:

```json
{
  "projectId": "bardtale-overrides",
  "rootPath": "...",
  "assetsWritePath": "...",
  "configPath": ".../has.project.json"
}
```

Règles :

- `assetsWritePath` par défaut = `targetDir`.
- Le backend crée un `manifest.json` minimal si absent dans la requête (au moins `Group` + `Name`).

### 4.2 Ouvrir un projet existant

`POST /api/v1/projects/open`

Request:

```json
{ "projectPath": "K:/.../projects/bardtale-overrides" }
```

Response:

```json
{ "projectId": "bardtale-overrides", "rootPath": "...", "assetsWritePath": "..." }
```

### 4.3 Lire la configuration projet

`GET /api/v1/projects/{projectId}/config`

Response = contenu canonique de `has.project.json` (avec `layers[]`).

### 4.4 Mettre à jour layers/priorités

`PUT /api/v1/projects/{projectId}/layers`

Request:

```json
{
  "vanilla": { "sourceType": "zip", "path": "K:/hytale/Assets.zip" },
  "layers": [
    { "id": "bardtale", "displayName": "BardTale", "sourceType": "zip", "path": "K:/.../FineCraft-BardTale-0.5.7.zip", "enabled": true }
  ]
}
```

Response:

```json
{ "ok": true }
```

---

## 5) Import pack pour édition

### 5.1 Importer un ZIP/dossier en tant que dépendance et créer un projet

`POST /api/v1/workspace/{workspaceId}/projects/import-pack`

Request:

```json
{
  "pack": { "sourceType": "zip", "path": "K:/.../FineCraft-BardTale-0.5.7.zip" },
  "newProject": { "projectId": "bardtale", "displayName": "BardTale (Overrides)" }
}
```

Response:

```json
{
  "projectId": "bardtale",
  "created": true,
  "layer": { "id": "bardtale", "enabled": true }
}
```

Notes :

- Le backend tente de lire `manifest.json` du pack pour pré-remplir `displayName`/`id` si non fournis.
- Le pack importé est ajouté en `layers[0]` (enabled=true).

---

## 6) Index / Recherche / Graphe

### 6.1 Rebuild index (optionnel MVP)

`POST /api/v1/projects/{projectId}/rebuild`

Permet de reconstruire l'index et/ou le graphe après changement de layers.

Response:

```json
{ "ok": true, "stats": { "serverJsonCount": 12345, "commonFileCount": 67890 } }
```

### 6.2 Recherche

`GET /api/v1/projects/{projectId}/search?q=Weapon_Sword_Iron&limit=50`

Response:

```json
{
  "results": [
    {
      "assetKey": "server:Weapon_Sword_Iron",
      "kind": "server-json",
      "display": "Weapon_Sword_Iron",
      "origin": "vanilla|dependency|project"
    }
  ]
}
```

### 6.3 Graphe (focus)

`GET /api/v1/projects/{projectId}/graph?root=server:Weapon_Sword_Iron&depth=2`

Response (compact):

```json
{
  "nodes": [
    {
      "id": "server:Weapon_Sword_Iron",
      "label": "Weapon_Sword_Iron",
      "title": "Weapon_Sword_Iron",
      "group": "item|interaction|model|texture|sound|json_data|...",
      "path": "Server/Item/Items/.../Weapon_Sword_Iron.json",
      "state": "vanilla|local"
    }
  ],
  "edges": [
    { "from": "server:Weapon_Sword_Iron", "to": "server:Root_Weapon_Sword_Primary", "type": "ref" }
  ]
}

Notes :

- Le backend peut inclure des nodes Common (ex: `common:Icons/...png`) si un JSON référence une ressource existante sous `Common/`.
- `group` sert au frontend pour colorer/typer les nodes (style “blueprint”).

### 6.4 Interaction Tree (éditeur interne)

`GET /api/v1/projects/{projectId}/interaction/tree?root=server:Root_Weapon_Sword_Primary`

Response (compact):

```json
{
  "root": "server:Root_Weapon_Sword_Primary",
  "nodes": [
    { "id": "server:Root_Weapon_Sword_Primary", "type": "Root", "label": "Root_Weapon_Sword_Primary", "isExternal": true },
    { "id": "internal:root/Interactions/0", "type": "PlayAnimation", "label": "PlayAnimation", "isExternal": false }
  ],
  "edges": [
    { "from": "server:Root_Weapon_Sword_Primary", "to": "internal:root/Interactions/0", "type": "child" },
    { "from": "internal:root/Interactions/0", "to": "server:Some_Other_Interaction", "type": "next" }
  ]
}
```
```

---

## 7) Lecture / écriture d'assets (à la demande)

### 7.1 Lire un Server JSON

`GET /api/v1/projects/{projectId}/asset?key=server:Weapon_Sword_Iron`

Response:

```json
{
  "assetKey": "server:Weapon_Sword_Iron",
  "resolvedPath": "Server/Item/Items/Weapon/Sword/Weapon_Sword_Iron.json",
  "origin": "vanilla|dependency|project",
  "json": { }
}
```

### 7.2 Lire une ressource Common (binaire)

`GET /api/v1/projects/{projectId}/resource?key=common:Icons/ItemsGenerated/Weapon_Sword_Iron.png`

Réponse binaire (stream), avec cache headers.

### 7.3 Sauvegarder un Server JSON (override)

`PUT /api/v1/projects/{projectId}/asset?key=server:Weapon_Sword_Iron`

Request:

```json
{
  "json": { },
  "mode": "override"
}
```

Règles :

- Écrit dans `<assetsWritePath>/<resolvedPath>` (ex: `<assetsWritePath>/Server/...`).
- Ne modifie jamais les layers dépendants.

---

## 8) Export

### 8.1 Export ZIP

`POST /api/v1/projects/{projectId}/export`

Request:

```json
{ "outputPath": "K:/exports/bardtale-0.1.0.zip" }
```

Validation :

- `manifest.json` doit exister à la racine du projet-pack et être parseable.

Response:

```json
{ "ok": true, "outputPath": "K:/exports/bardtale-0.1.0.zip" }
```

---

## 9) Notes d'implémentation (non-contractuelles)

- Cache index : il est utile de persister un index côté backend (ex: `.studio_cache/`) pour éviter de rescanner le vanilla à chaque lancement.
- Streaming ZIP : accès via `zipfile` côté Python + abstraction VFS.
- Sécurité : refuser les `..` / chemins absolus dans les keys; normaliser en chemins relatifs.
