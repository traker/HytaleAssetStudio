# UXWORKFLOW1 - Plan d'amelioration UX workflow et UI interactions

Issu de l'audit UX/UI du 2026-03-14.

Objectif: ameliorer les workflows reels du Studio sur trois axes prioritaires:
- rendre les parcours principaux plus decouvrables
- eviter les pertes de travail et les ambiguities d'etat
- stabiliser la navigation dans les graphes et les panneaux lateraux

Le plan est volontairement atomique: chaque sous-tache doit pouvoir etre implementee, revue et validee independamment.

---

## Perimetre

Flux cibles:
- ouverture workspace -> selection / creation de projet
- config projet -> acces aux outils
- graphe items -> selection / recherche / inspection
- passage item -> interactions
- edition dans le side panel et l'editeur d'interactions

Hors-scope de ce chantier:
- refonte visuelle globale ou changement de DA
- redesign complet des formulaires metier type-aware
- optimisation profonde du moteur de layout backend/frontend
- accessibilite avancee complete (clavier, ARIA, contraste exhaustif) au-dela des points critiques constates

---

## Principes de cadrage

1. Toujours preferer un feedback explicite a un etat implicite.
2. Une action destructrice ou une perte potentielle de draft doit etre visible avant de survenir.
3. Un workflow transversal ne doit pas dependre d'un seul tooltip pour etre compris.
4. Dans les graphes, la selection ne doit pas destabiliser la carte mentale sans raison forte.
5. Toute amelioration UX doit rester compatible avec le mode expert JSON deja en place.

---

## Lot 1 - Securiser l'edition et la confiance utilisateur

Objectif: supprimer les pertes silencieuses de travail et rendre l'etat d'edition compréhensible.

### 1.1 - Detecter l'etat "draft modifie" dans le side panel

Fichier cible principal:
- `frontend/src/components/editor/AssetSidePanel.tsx`

Probleme:
- le draft est reinitialise sur changement de selection / refresh
- l'utilisateur ne voit pas clairement si son contenu diverge de l'asset charge

Travail attendu:
- calculer un etat `isDirty` stable a partir du draft courant et du JSON charge
- afficher cet etat dans le header du panneau
- distinguer visuellement les etats `idle`, `dirty`, `saving`, `saved`, `error`

Critere d'acceptation:
- le panneau indique clairement quand un asset a des modifications non sauvegardees
- l'information reste correcte apres save, refresh et changement d'onglet

### 1.2 - Ajouter une confirmation avant perte de draft

Fichiers cibles:
- `frontend/src/components/editor/AssetSidePanel.tsx`
- composants appelants si necessaire (`ProjectGraphEditor.tsx`, `ProjectModifiedGraphView.tsx`, `InteractionTreeEditor.tsx`)

Probleme:
- un clic sur un autre noeud ou sur la fermeture du panneau peut jeter le draft en cours sans confirmation

Travail attendu:
- intercepter la fermeture du panneau quand `isDirty`
- intercepter le changement de selection si le panneau courant est dirty
- fournir au minimum: `Cancel`, `Discard`, `Save then continue` si le flux le permet
- si `Save then continue` est trop intrusif au premier passage, documenter et livrer au moins `Cancel` / `Discard`

Critere d'acceptation:
- aucune perte de draft ne peut se produire sans action explicite de l'utilisateur
- le message de confirmation nomme clairement l'asset concerne

### 1.3 - Clarifier les actions principales du panneau

Fichier cible principal:
- `frontend/src/components/editor/AssetSidePanel.tsx`

Probleme:
- `Save`, `Save as`, `Cancel`, `Interactions`, `Isolate`, `X` sont presents, mais la hierarchie d'action n'est pas tres lisible

Travail attendu:
- reordonner les actions par priorite utilisateur
- rendre le bouton de fermeture plus explicite si besoin (`Close` au lieu de `X` seul)
- rendre l'etat de blocage lisible sur les actions indisponibles
- eviter le melange de terminologie FR/EN a l'interieur d'un meme sous-flux si possible

Critere d'acceptation:
- un nouvel utilisateur comprend plus vite quoi faire en premier dans le panneau
- la barre d'action reste lisible meme quand `Save as` est ouvert

---

## Lot 2 - Rendre le workflow Items -> Interactions decouvrable

Objectif: faire disparaitre la logique "il faut deja savoir comment l'outil marche".

### 2.1 - Expliquer explicitement le prerequis d'ouverture des interactions

Fichiers cibles:
- `frontend/src/App.tsx`
- `frontend/src/views/ProjectConfigView.tsx`

Probleme:
- `Interactions` est desactive tant qu'un root n'a pas ete ouvert depuis les items
- l'utilisateur n'a qu'un tooltip ou une tuile inactive pour comprendre la regle

Travail attendu:
- remplacer l'etat purement desactive par une aide explicite dans la navigation ou le dashboard projet
- afficher une phrase courte et visible du type: "Ouvrez un item puis utilisez Interactions"
- conserver si besoin le bouton desactive, mais l'accompagner d'un vrai message present dans l'ecran

Critere d'acceptation:
- le prerequis du workflow est comprehensible sans hover ni connaissance prealable

### 2.2 - Ajouter un CTA visible depuis le contexte item selectionne

Fichiers cibles:
- `frontend/src/components/editor/AssetSidePanel.tsx`
- `frontend/src/components/editor/ProjectGraphEditor.tsx`

Probleme:
- l'action la plus logique pour basculer vers les interactions se fait depuis un petit bouton secondaire dans le panneau

Travail attendu:
- rendre l'action "Open interactions" plus visible quand le noeud selectionne le permet
- clarifier pourquoi l'action est indisponible sinon
- verifier que le libelle de l'action correspond bien au resultat attendu

Critere d'acceptation:
- depuis un item compatible, l'utilisateur repere immediatement comment ouvrir les interactions associees

### 2.3 - Rendre la navigation croisee retour item / interaction plus evidente

Fichiers cibles:
- `frontend/src/views/project/ProjectGraphInteractionsView.tsx`
- `frontend/src/components/editor/InteractionTreeEditor.tsx`

Probleme:
- la navigation retour vers l'item ou vers une reference serveur repose sur des gestes implicites, notamment le double-clic

Travail attendu:
- documenter le geste si on le conserve
- ou ajouter une action visible quand un noeud externe server est selectionne
- aligner le texte de `Back` avec la destination reelle si utile

Critere d'acceptation:
- un utilisateur comprend comment revenir a l'item source ou ouvrir une reference externe sans decouverte accidentelle

---

## Lot 3 - Stabiliser l'exploration des graphes

Objectif: reduire les mouvements surprenants et rendre l'exploration plus maitrisable.

### 3.1 - Decoupler selection et expansion automatique dans le graphe items

Fichier cible principal:
- `frontend/src/components/editor/ProjectGraphEditor.tsx`

Probleme:
- selectionner un noeud declenche une expansion auto, puis un recentrage
- cela peut casser la carte mentale et donner l'impression que l'outil "bouge tout seul"

Travail attendu:
- reevaluer l'auto-expand sur simple selection
- preferer un declenchement plus intentionnel: action dediee, double-clic, ou seulement sur certaines transitions
- conserver la puissance du flux expert sans degrader le flux d'inspection simple

Critere d'acceptation:
- inspecter un noeud ne provoque plus de mouvement surprenant non desire dans le graphe

### 3.2 - Revoir le recentrage automatique apres selection

Fichiers cibles:
- `frontend/src/components/editor/ProjectGraphEditor.tsx`
- `frontend/src/components/editor/ProjectModifiedGraphView.tsx` si pattern similaire retenu

Probleme:
- `fitView` cible apres rebuild force une navigation de camera qui peut desorienter

Travail attendu:
- limiter le recentrage aux cas ou il apporte une vraie valeur
- distinguer recherche explicite, ouverture depuis liste modifiee, et simple clic local
- si le recentrage est garde, le rendre plus previsible

Critere d'acceptation:
- la camera ne saute plus inutilement pendant une exploration normale

### 3.3 - Charger directement depuis la recherche quand le flux le justifie

Fichier cible principal:
- `frontend/src/components/editor/ProjectGraphEditor.tsx`

Probleme:
- choisir un resultat de recherche ne charge pas le graphe; il faut encore cliquer `Charger`

Travail attendu:
- decider et documenter l'un des deux comportements:
  - autoload a la selection d'un resultat
  - ou maintien du bouton `Charger`, mais avec feedback beaucoup plus explicite
- privilegier la solution qui reduit le plus la friction sans charger accidentellement des graphes lourds

Critere d'acceptation:
- le passage recherche -> graphe est clair et ne laisse pas l'utilisateur dans un etat ambigu

---

## Lot 4 - Mieux traiter les limites de volumetrie et les etats systeme

Objectif: rendre les contraintes techniques compréhensibles et actionnables.

### 4.1 - Revoir le message de troncature des graphes

Fichiers cibles:
- `frontend/src/components/graph/layoutDagre.ts`
- `frontend/src/components/editor/ProjectGraphEditor.tsx`
- `frontend/src/components/editor/InteractionTreeEditor.tsx`

Probleme:
- l'utilisateur voit que le graphe est tronque, mais pas comment sortir concretement de l'impasse

Travail attendu:
- reformuler le message en fonction de la vraie contrainte
- proposer des actions concretes: reduire la profondeur, changer de root, filtrer, passer par une recherche plus precise
- ne pas suggerer une action contradictoire avec le cap technique reel

Critere d'acceptation:
- le warning aide a agir au lieu de seulement signaler une limite

### 4.2 - Uniformiser les messages de chargement / succes / erreur sur les vues principales

Fichiers cibles:
- `frontend/src/components/editor/ProjectGraphEditor.tsx`
- `frontend/src/components/editor/InteractionTreeEditor.tsx`
- `frontend/src/views/HomePage.tsx`
- `frontend/src/views/ProjectConfigView.tsx`

Probleme:
- les messages existent mais restent heterogenes en ton, langue, priorite visuelle et temporalite

Travail attendu:
- definir une micro-convention commune pour les messages de statut
- harmoniser au minimum les libelles de loading, success et error sur les ecrans critiques
- reduire les zones grises entre action en cours et action terminee

Critere d'acceptation:
- les etats systeme sont plus coherents d'un ecran a l'autre

### 4.3 - Fiabiliser le flux de creation de projet sur le champ directory

Fichier cible principal:
- `frontend/src/views/HomePage.tsx`

Probleme:
- le champ directory est re-auto-rempli a chaque changement d'ID, meme si l'utilisateur avait commence une saisie manuelle

Travail attendu:
- introduire la notion de champ `directoryTouched`
- n'auto-deriver le chemin que tant que le dossier n'a pas ete modifie manuellement
- reinitialiser proprement ce comportement a l'ouverture d'un nouveau formulaire

Critere d'acceptation:
- la saisie manuelle du repertoire n'est plus ecrasee quand l'ID change

---

## Lot 5 - Densite UI et lisibilite des formulaires critiques

Objectif: ameliorer la lisibilite sans lancer une refonte de tous les editeurs metier.

### 5.1 - Relever legerement la hierarchie typographique du form panel interaction

Fichiers cibles:
- `frontend/src/components/editor/formStyles.ts`
- `frontend/src/components/editor/InteractionFormPanel.tsx`
- sous-editeurs si necessaire

Probleme:
- labels tres petits, espacement serre, forte densite visuelle

Travail attendu:
- ajuster tailles et espacements minimaux des labels / champs / blocs
- verifier l'impact visuel sur desktop au moins
- rester sobre pour ne pas exploser la hauteur du panneau

Critere d'acceptation:
- le panel est plus scannable sans perdre trop d'information a l'ecran

### 5.2 - Identifier 2 a 3 sections a replier plutot qu'un long flux vertical continu

Fichiers cibles:
- `frontend/src/components/editor/InteractionFormPanel.tsx`
- `frontend/src/components/editor/interactionFormTypeSections.tsx`

Probleme:
- certaines editions complexes imposent un scroll long sans jalons assez forts

Travail attendu:
- choisir quelques sections naturellement repliables: comportement avance, extras, champs rares, ou JSON annexe
- ne pas chercher a rendre tout collapsible d'un coup
- prioriser les types / zones les plus denses

Critere d'acceptation:
- au moins un cas reel de formulaire dense devient plus facile a parcourir

---

## Lot 6 - Validation UX legere et preuves de fermeture

Objectif: fermer le chantier avec des preuves simples et reproductibles.

### 6.1 - Construire une checklist de walkthrough manuel

Sortie attendue:
- checklist courte couvrant les flux critiques du chantier

Parcours minimum a verifier:
- ouvrir un projet et comprendre comment atteindre les interactions
- modifier un asset puis tenter de changer de noeud sans sauvegarder
- rechercher un item et charger son graphe
- ouvrir une reference externe depuis le graphe interactions
- rencontrer un warning de troncature et comprendre quoi faire ensuite

Critere d'acceptation:
- chaque lot livre au moins un scenario manuel verifiable

### 6.2 - Verifier qu'aucune regression technique evidente n'est introduite

Validation minimale attendue:
- `npm --prefix frontend run build`
- verification manuelle des flux modifies

Option selon ce qui existe au moment de l'implementation:
- etendre les tests frontend si un comportement devient assez stable pour etre automatise

---

## Ordre de mise en oeuvre recommande

1. Lot 1 - confiance et protection du draft
2. Lot 2 - decouvrabilite du workflow items / interactions
3. Lot 3 - stabilite de navigation graphe
4. Lot 4 - messages systeme et creation projet
5. Lot 5 - densite UI ciblée
6. Lot 6 - fermeture et validation

---

## Definition de termine pour chaque sous-tache

Une sous-tache ne passe en `done` que si:
- le comportement attendu est visible dans l'UI
- le critere d'acceptation de la sous-tache est satisfait
- la verification associee est notee dans le tracker
- si la decision impacte le pilotage du produit, `SESSION_RECAP.md` est mis a jour
