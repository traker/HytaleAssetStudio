# UXWORKFLOW1 - Tracker d'execution

Document de suivi pour executer le plan `UXWORKFLOW1.md`.

## Mode d'emploi

- Garder ce fichier factuel: statut, decision, validation, reste a faire.
- Ne passer une sous-tache en `done` qu'apres verification reelle.
- Noter la preuve de validation juste sous la sous-tache concernee.
- Si une decision produit ou UX change la trajectoire du chantier, mettre aussi a jour `docs/docs_data/SESSION_RECAP.md`.
- Si une sous-tache devient trop grosse, la decouper ici avant implementation plutot que de garder un statut flou `in-progress` pendant trop longtemps.
- Cocher les taches terminé

## Legende

- `todo`: non commence
- `in-progress`: en cours
- `blocked`: bloque par une decision, une dette technique ou une ambiguite produit
- `done`: termine et verifie

## Regles de suivi

1. Un statut global de lot ne passe a `done` que si toutes ses sous-taches sont `done`.
2. Une validation doit contenir au moins un element concret:
   - commande executee
   - test manuel nomme
   - capture de comportement observee dans l'UI
3. Une note doit rester courte et utile: pourquoi on a tranche, pas un journal verbeux.
4. Si une sous-tache est `blocked`, documenter le blocage et la prochaine action attendue.
5. Cocher la tache terminé

---

## Tableau de bord global

| Lot | Titre | Statut |
|---|---|---|
| Lot 1 | Securiser l'edition et la confiance utilisateur | `todo` |
| Lot 2 | Rendre le workflow Items -> Interactions decouvrable | `todo` |
| Lot 3 | Stabiliser l'exploration des graphes | `todo` |
| Lot 4 | Mieux traiter les limites de volumetrie et les etats systeme | `todo` |
| Lot 5 | Densite UI et lisibilite des formulaires critiques | `todo` |
| Lot 6 | Validation UX legere et preuves de fermeture | `todo` |

---

## Lot 1 - Securiser l'edition et la confiance utilisateur

- Statut global: `todo`
- Objectif: supprimer les pertes silencieuses de travail et rendre l'etat d'edition explicite.

### 1.1 - Detecter l'etat draft modifie dans le side panel

- Statut: `todo`
- Priorite: P0
- Fichiers cibles:
  - `frontend/src/components/editor/AssetSidePanel.tsx`
- Taches:
  - [ ] calculer un etat `isDirty`
  - [ ] afficher un indicateur visible dans le header
  - [ ] distinguer `dirty`, `saving`, `saved`, `error`
- Validation:
  - [ ] `npm --prefix frontend run build`
  - [ ] test manuel: modifier un asset sans sauvegarder -> indicateur visible
- Notes:
  - 

### 1.2 - Ajouter une confirmation avant perte de draft

- Statut: `todo`
- Priorite: P0
- Fichiers cibles:
  - `frontend/src/components/editor/AssetSidePanel.tsx`
  - `frontend/src/components/editor/ProjectGraphEditor.tsx`
  - `frontend/src/views/project/ProjectModifiedGraphView.tsx`
  - `frontend/src/components/editor/InteractionTreeEditor.tsx`
- Taches:
  - [ ] intercepter fermeture du panneau si dirty
  - [ ] intercepter changement de selection si dirty
  - [ ] definir le set d'actions (`Cancel`, `Discard`, eventuellement `Save then continue`)
- Validation:
  - [ ] `npm --prefix frontend run build`
  - [ ] test manuel: tentative de changement de noeud avec draft dirty -> confirmation visible
- Notes:
  - 

### 1.3 - Clarifier les actions principales du panneau

- Statut: `todo`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/components/editor/AssetSidePanel.tsx`
- Taches:
  - [ ] reordonner les actions selon la priorite
  - [ ] rendre la fermeture plus explicite
  - [ ] clarifier les etats indisponibles
- Validation:
  - [ ] revue visuelle du header du panneau
- Notes:
  - 

---

## Lot 2 - Rendre le workflow Items -> Interactions decouvrable

- Statut global: `todo`
- Objectif: rendre le chemin vers les interactions comprehensible sans connaissance implicite.

### 2.1 - Expliquer explicitement le prerequis d'ouverture des interactions

- Statut: `todo`
- Priorite: P0
- Fichiers cibles:
  - `frontend/src/App.tsx`
  - `frontend/src/views/ProjectConfigView.tsx`
- Taches:
  - [ ] afficher une aide visible dans la nav ou le dashboard
  - [ ] conserver ou adapter l'etat desactive du bouton selon le design retenu
- Validation:
  - [ ] test manuel: nouvel utilisateur peut comprendre le prerequis sans tooltip
- Notes:
  - 

### 2.2 - Ajouter un CTA visible depuis le contexte item selectionne

- Statut: `todo`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/components/editor/AssetSidePanel.tsx`
  - `frontend/src/components/editor/ProjectGraphEditor.tsx`
- Taches:
  - [ ] rendre l'action d'ouverture des interactions plus visible
  - [ ] expliciter pourquoi elle est indisponible sinon
- Validation:
  - [ ] test manuel sur un item compatible / non compatible
- Notes:
  - 

### 2.3 - Rendre la navigation croisee retour item / interaction plus evidente

- Statut: `todo`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/views/project/ProjectGraphInteractionsView.tsx`
  - `frontend/src/components/editor/InteractionTreeEditor.tsx`
- Taches:
  - [ ] choisir entre geste documente et action visible
  - [ ] aligner le texte de navigation retour si necessaire
- Validation:
  - [ ] test manuel depuis une reference externe serveur
- Notes:
  - 

---

## Lot 3 - Stabiliser l'exploration des graphes

- Statut global: `todo`
- Objectif: reduire les mouvements surprenants et mieux controler l'exploration.

### 3.1 - Decoupler selection et expansion automatique dans le graphe items

- Statut: `todo`
- Priorite: P0
- Fichiers cibles:
  - `frontend/src/components/editor/ProjectGraphEditor.tsx`
- Taches:
  - [ ] revoir le declencheur d'expansion
  - [ ] eviter l'expansion non intentionnelle sur simple inspection
- Validation:
  - [ ] test manuel sur navigation de graphe avec plusieurs selections successives
- Notes:
  - 

### 3.2 - Revoir le recentrage automatique apres selection

- Statut: `todo`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/components/editor/ProjectGraphEditor.tsx`
  - `frontend/src/views/project/ProjectModifiedGraphView.tsx`
- Taches:
  - [ ] distinguer les cas qui meritent un `fitView`
  - [ ] supprimer les recentrages inutiles pendant l'exploration locale
- Validation:
  - [ ] test manuel: la camera ne saute plus sur un clic simple
- Notes:
  - 

### 3.3 - Charger directement depuis la recherche quand le flux le justifie

- Statut: `todo`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/components/editor/ProjectGraphEditor.tsx`
- Taches:
  - [ ] choisir entre autoload ou chargement explicite mieux guide
  - [ ] implementer le comportement retenu
  - [ ] ajuster le message utilisateur associe
- Validation:
  - [ ] test manuel: recherche -> graphe sans ambiguite
- Notes:
  - 

---

## Lot 4 - Mieux traiter les limites de volumetrie et les etats systeme

- Statut global: `todo`
- Objectif: rendre les contraintes techniques lisibles et actionnables.

### 4.1 - Revoir le message de troncature des graphes

- Statut: `todo`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/components/graph/layoutDagre.ts`
  - `frontend/src/components/editor/ProjectGraphEditor.tsx`
  - `frontend/src/components/editor/InteractionTreeEditor.tsx`
- Taches:
  - [ ] reformuler le warning selon la vraie limite technique
  - [ ] proposer des actions concretes et coherentes
- Validation:
  - [ ] test manuel sur un graphe suffisamment grand
- Notes:
  - 

### 4.2 - Uniformiser les messages de chargement / succes / erreur

- Statut: `todo`
- Priorite: P2
- Fichiers cibles:
  - `frontend/src/components/editor/ProjectGraphEditor.tsx`
  - `frontend/src/components/editor/InteractionTreeEditor.tsx`
  - `frontend/src/views/HomePage.tsx`
  - `frontend/src/views/ProjectConfigView.tsx`
- Taches:
  - [ ] definir une micro-convention commune
  - [ ] harmoniser les libelles critiques
- Validation:
  - [ ] revue visuelle sur les ecrans cibles
- Notes:
  - 

### 4.3 - Fiabiliser le flux de creation de projet sur le champ directory

- Statut: `todo`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/views/HomePage.tsx`
- Taches:
  - [ ] introduire `directoryTouched`
  - [ ] n'auto-remplir que tant que le champ n'a pas ete modifie manuellement
  - [ ] reinitialiser le comportement a l'ouverture du formulaire
- Validation:
  - [ ] test manuel: modifier le directory, changer l'ID, verifier qu'il ne saute plus
- Notes:
  - 

---

## Lot 5 - Densite UI et lisibilite des formulaires critiques

- Statut global: `todo`
- Objectif: ameliorer la lisibilite de l'edition sans refonte lourde.

### 5.1 - Relever legerement la hierarchie typographique du form panel interaction

- Statut: `todo`
- Priorite: P2
- Fichiers cibles:
  - `frontend/src/components/editor/formStyles.ts`
  - `frontend/src/components/editor/InteractionFormPanel.tsx`
- Taches:
  - [ ] ajuster tailles et espacements minimaux
  - [ ] verifier l'impact visuel desktop
- Validation:
  - [ ] revue visuelle du panel interaction
- Notes:
  - 

### 5.2 - Identifier 2 a 3 sections a replier dans les formulaires denses

- Statut: `todo`
- Priorite: P2
- Fichiers cibles:
  - `frontend/src/components/editor/InteractionFormPanel.tsx`
  - `frontend/src/components/editor/interactionFormTypeSections.tsx`
- Taches:
  - [ ] choisir les sections les plus rentables a replier
  - [ ] implementer un premier lot limite
- Validation:
  - [ ] test manuel sur au moins un formulaire dense
- Notes:
  - 

---

## Lot 6 - Validation UX legere et preuves de fermeture

- Statut global: `todo`
- Objectif: fermer le chantier avec des preuves simples et reutilisables.

### 6.1 - Construire une checklist de walkthrough manuel

- Statut: `todo`
- Priorite: P1
- Taches:
  - [ ] lister 5 parcours critiques max
  - [ ] rattacher chaque parcours aux lots modifies
- Validation:
  - [ ] checklist presente et exploitable
- Notes:
  - 

### 6.2 - Verifier qu'aucune regression technique evidente n'est introduite

- Statut: `todo`
- Priorite: P1
- Taches:
  - [ ] `npm --prefix frontend run build`
  - [ ] verifier manuellement les flux modifies
  - [ ] ajouter des tests si un comportement devient assez stable pour etre automatise
- Validation:
  - [ ] build frontend vert
  - [ ] preuves manuelles notees dans ce tracker
- Notes:
  - 
