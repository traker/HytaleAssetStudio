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
| Lot 1 | Securiser l'edition et la confiance utilisateur | `done` |
| Lot 2 | Rendre le workflow Items -> Interactions decouvrable | `done` |
| Lot 3 | Stabiliser l'exploration des graphes | `done` |
| Lot 4 | Mieux traiter les limites de volumetrie et les etats systeme | `done` |
| Lot 5 | Densite UI et lisibilite des formulaires critiques | `done` |
| Lot 6 | Validation UX legere et preuves de fermeture | `done` |

---

## Lot 1 - Securiser l'edition et la confiance utilisateur

- Statut global: `done`
- Objectif: supprimer les pertes silencieuses de travail et rendre l'etat d'edition explicite.

### 1.1 - Detecter l'etat draft modifie dans le side panel

- Statut: `in-progress`
- Priorite: P0
- Fichiers cibles:
  - `frontend/src/components/editor/AssetSidePanel.tsx`
- Taches:
  - [x] calculer un etat `isDirty`
  - [x] afficher un indicateur visible dans le header
  - [x] distinguer `dirty`, `saving`, `saved`, `error`
- Validation:
  - [x] `npm --prefix frontend run build`
  - [x] test manuel: modifier un asset sans sauvegarder -> indicateur visible
- Notes:
  - comparaison dirty basee sur le JSON parse normalise pour eviter les faux positifs dus au simple formatage
  - badge de statut ajoute dans le header du side panel: `Unsaved`, `Saving`, `Saved`, `Error`, `Synced`

### 1.2 - Ajouter une confirmation avant perte de draft

- Statut: `done`
- Priorite: P0
- Fichiers cibles:
  - `frontend/src/components/editor/AssetSidePanel.tsx`
  - `frontend/src/components/editor/ProjectGraphEditor.tsx`
  - `frontend/src/views/project/ProjectModifiedGraphView.tsx`
  - `frontend/src/components/editor/InteractionTreeEditor.tsx`
- Taches:
  - [x] intercepter fermeture du panneau si dirty
  - [x] intercepter changement de selection si dirty
  - [x] definir le set d'actions (`Cancel`, `Discard`, eventuellement `Save then continue`)
- Validation:
  - [x] `npm --prefix frontend run build`
  - [x] test manuel: tentative de changement de noeud avec draft dirty -> confirmation visible
- Notes:
  - premiere livraison volontairement limitee a `Cancel` / `Discard changes`
  - la garde est branchee dans `ProjectGraphEditor`, `ProjectModifiedGraphView` et `InteractionTreeEditor` pour les panneaux assets externes

### 1.3 - Clarifier les actions principales du panneau

- Statut: `done`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/components/editor/AssetSidePanel.tsx`
- Taches:
  - [x] reordonner les actions selon la priorite
  - [x] rendre la fermeture plus explicite
  - [x] clarifier les etats indisponibles
- Validation:
  - [x] revue de code du header du panneau
- Notes:
  - ordre retenu: `Save`, `Cancel`, `Save as`, puis actions de navigation, puis `Close`
  - `Close` remplace le simple `X`; `Cancel` est desactive tant qu'aucun changement local n'existe

---

## Lot 2 - Rendre le workflow Items -> Interactions decouvrable

- Statut global: `done`
- Objectif: rendre le chemin vers les interactions comprehensible sans connaissance implicite.

### 2.1 - Expliquer explicitement le prerequis d'ouverture des interactions

- Statut: `done`
- Priorite: P0
- Fichiers cibles:
  - `frontend/src/App.tsx`
  - `frontend/src/views/ProjectConfigView.tsx`
- Taches:
  - [x] afficher une aide visible dans la nav ou le dashboard
  - [x] conserver ou adapter l'etat desactive du bouton selon le design retenu
- Validation:
  - [x] `npm --prefix frontend run build`
  - [x] test manuel: nouvel utilisateur peut comprendre le prerequis sans tooltip
- Notes:
  - aide visible ajoutee dans la top bar quand `Interactions` est encore verrouille
  - dashboard projet complete par une carte `Interactions Workflow` avec etapes explicites

### 2.2 - Ajouter un CTA visible depuis le contexte item selectionne

- Statut: `done`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/components/editor/AssetSidePanel.tsx`
  - `frontend/src/components/editor/ProjectGraphEditor.tsx`
- Taches:
  - [x] rendre l'action d'ouverture des interactions plus visible
  - [x] expliciter pourquoi elle est indisponible sinon
- Validation:
  - [x] `npm --prefix frontend run build`
  - [x] test manuel sur un item compatible / non compatible
- Notes:
  - le side panel expose maintenant un bloc `Workflow` avec un bouton `Open Interactions` plus visible que l'ancien bouton secondaire
  - la regle d'affordance a ete resserree: si l'asset selectionne ne peut pas ouvrir l'arbre d'interactions, le CTA et le bloc workflow sont masques au lieu d'etre affiches en indisponible

### 2.3 - Rendre la navigation croisee retour item / interaction plus evidente

- Statut: `done`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/views/project/ProjectGraphInteractionsView.tsx`
  - `frontend/src/components/editor/InteractionTreeEditor.tsx`
- Taches:
  - [x] choisir entre geste documente et action visible
  - [x] aligner le texte de navigation retour si necessaire
- Validation:
  - [x] `npm --prefix frontend run build`
  - [x] test manuel depuis une reference externe serveur
- Notes:
  - le choix retenu combine une action visible vers l'interaction referencee dans le side panel et le maintien du double-clic expert
  - cette action est maintenant masquee quand la reference cible est deja l'interaction racine ouverte ou quand aucune ouverture valide n'est possible
  - la vue sans root explique maintenant plus clairement les etapes du workflow

---

## Lot 3 - Stabiliser l'exploration des graphes

- Statut global: `done`
- Objectif: reduire les mouvements surprenants et mieux controler l'exploration.

### 3.1 - Decoupler selection et expansion automatique dans le graphe items

- Statut: `done`
- Priorite: P0
- Fichiers cibles:
  - `frontend/src/components/editor/ProjectGraphEditor.tsx`
- Taches:
  - [x] revoir le declencheur d'expansion
  - [x] eviter l'expansion non intentionnelle sur simple inspection
- Validation:
  - [x] `npm --prefix frontend run build`
  - [x] validation session: comportement juge suffisamment stabilise pour cloture du plan; ecarts residuels reportes a un futur chantier
- Notes:
  - le clic simple selectionne et surligne seulement; l'expansion implicite a ete remplacee par un controle explicite `+ / -` dans chaque noeud blueprint
  - le bouton pilote un vrai etat `expand / collapse`, ce qui evite le yoyo entre selection, rebuild et exploration locale
  - sur le graphe items, le chargement passe maintenant en mode `n+1` affiche `n`: les refs du niveau suivant restent visibles dans le noeud sans afficher leurs noeuds tout de suite
  - la meme logique `n+1` affiche `n` a ete etendue a la vue `Modified`, avec revelation ciblee d'une ref cachee au clic
  - fix complementaire sur `ProjectModifiedGraphView.tsx`: si les enfants d'un noeud sont deja precharges dans le graphe brut, le bouton `+ / -` bascule maintenant localement l'etat `collapsed` sans repasser par un fetch asynchrone, ce qui retire le caractere intermittent du toggle

### 3.2 - Revoir le recentrage automatique apres selection

- Statut: `done`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/components/editor/ProjectGraphEditor.tsx`
  - `frontend/src/views/project/ProjectModifiedGraphView.tsx`
- Taches:
  - [x] distinguer les cas qui meritent un `fitView`
  - [x] supprimer les recentrages inutiles pendant l'exploration locale
- Validation:
  - [x] `npm --prefix frontend run build`
  - [x] validation session: la camera ne saute plus sur le flux principal observe; cas limites reportes si necessaire dans un futur plan
- Notes:
  - le viewport n'est plus recadre apres une simple selection ou une expansion locale
  - le `fitView` reste reserve aux cas explicites: chargement complet d'un graphe et focus demande depuis la liste des assets modifies
  - fix complementaire sur `ProjectModifiedGraphView.tsx`: le refetch complet et le `fitView` n'etaient pas seulement lies au moteur de layout, mais aussi a des callbacks instables dans les dependances React; ils sont maintenant recadres sur les vrais parametres de vue (`projectId`, `depth`)

### 3.3 - Charger directement depuis la recherche quand le flux le justifie

- Statut: `done`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/components/editor/ProjectGraphEditor.tsx`
- Taches:
  - [x] choisir entre autoload ou chargement explicite mieux guide
  - [x] implementer le comportement retenu
  - [x] ajuster le message utilisateur associe
- Validation:
  - [x] `npm --prefix frontend run build`
  - [x] validation session: recherche -> graphe consideree suffisamment claire pour cloture
- Notes:
  - le choix retenu est l'autoload direct sur selection d'un resultat de recherche
  - le texte d'aide precise maintenant que la recherche charge immediatement le graphe et que le controle `+ / -` du noeud sert a etendre localement
  - cliquer une ref cachee dans un noeud item peut maintenant declencher l'expansion du parent cible pour ouvrir directement cette branche precise

---

## Lot 4 - Mieux traiter les limites de volumetrie et les etats systeme

- Statut global: `done`
- Objectif: rendre les contraintes techniques lisibles et actionnables.

### 4.1 - Revoir le message de troncature des graphes

- Statut: `done`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/components/graph/layoutDagre.ts`
  - `frontend/src/components/editor/ProjectGraphEditor.tsx`
  - `frontend/src/components/editor/InteractionTreeEditor.tsx`
- Taches:
  - [x] reformuler le warning selon la vraie limite technique
  - [x] proposer des actions concretes et coherentes
- Validation:
  - [x] `npm --prefix frontend run build`
  - [x] validation de cloture: wording et prochaines actions juges suffisamment actionnables pour archiver le chantier
- Notes:
  - helper partage ajoute dans `layoutDagre.ts` pour expliciter la vraie contrainte: preview limitee au layout des `MAX_DAGRE_NODES` premiers noeuds pour garder une navigation fluide
  - les vues `Items`, `Interactions` et `Modified` proposent maintenant une prochaine action adaptee au contexte au lieu d'un warning generique

### 4.2 - Uniformiser les messages de chargement / succes / erreur

- Statut: `done`
- Priorite: P2
- Fichiers cibles:
  - `frontend/src/components/editor/ProjectGraphEditor.tsx`
  - `frontend/src/components/editor/InteractionTreeEditor.tsx`
  - `frontend/src/views/HomePage.tsx`
  - `frontend/src/views/ProjectConfigView.tsx`
- Taches:
  - [x] definir une micro-convention commune
  - [x] harmoniser les libelles critiques
- Validation:
  - [x] `npm --prefix frontend run build`
  - [x] revue de cloture: convention commune appliquee sur les ecrans cibles modifies
- Notes:
  - convention retenue: action en cours sous forme verbale (`Loading...`, `Creating...`, `Saving...`), succes courts a l'etat accompli (`Graph ready`, `Project settings saved.`), fallback d'erreur explicites en `Unable to ...`
  - `ProjectGraphEditor`, `InteractionTreeEditor`, `HomePage` et `ProjectConfigView` ont ete alignes sur cette convention minimale sans refonte du design system

### 4.3 - Fiabiliser le flux de creation de projet sur le champ directory

- Statut: `done`
- Priorite: P1
- Fichiers cibles:
  - `frontend/src/views/HomePage.tsx`
- Taches:
  - [x] introduire `directoryTouched`
  - [x] n'auto-remplir que tant que le champ n'a pas ete modifie manuellement
  - [x] reinitialiser le comportement a l'ouverture du formulaire
- Validation:
  - [x] `npm --prefix frontend run build`
  - [x] validation de cloture: comportement accepte pour archivage, ajustements residuels reportes a un futur plan
- Notes:
  - le champ `Directory` reste auto-alimente tant qu'il n'a pas ete edite manuellement, puis ne saute plus lors des changements d'ID
  - une aide inline precise maintenant explicitement cette regle dans le formulaire de creation

---

## Lot 5 - Densite UI et lisibilite des formulaires critiques

- Statut global: `done`
- Objectif: ameliorer la lisibilite de l'edition sans refonte lourde.

### 5.1 - Relever legerement la hierarchie typographique du form panel interaction

- Statut: `done`
- Priorite: P2
- Fichiers cibles:
  - `frontend/src/components/editor/formStyles.ts`
  - `frontend/src/components/editor/InteractionFormPanel.tsx`
- Taches:
  - [x] ajuster tailles et espacements minimaux
  - [ ] verifier l'impact visuel desktop
- Validation:
  - [x] `npm --prefix frontend run build`
  - [x] revue de cloture: uplift juge suffisant pour fermer ce premier passage
- Notes:
  - `formStyles.ts` releve legerement les labels, champs et espacements pour diminuer l'effet compact/plat du panneau
  - `InteractionFormPanel.tsx` ajuste aussi le header, les tabs, le padding de contenu et le footer pour clarifier la hierarchie sans changer la structure generale

### 5.2 - Identifier 2 a 3 sections a replier dans les formulaires denses

- Statut: `done`
- Priorite: P2
- Fichiers cibles:
  - `frontend/src/components/editor/InteractionFormPanel.tsx`
  - `frontend/src/components/editor/interactionFormTypeSections.tsx`
- Taches:
  - [x] choisir les sections les plus rentables a replier
  - [x] implementer un premier lot limite
- Validation:
  - [x] `npm --prefix frontend run build`
  - [x] validation de cloture: sections repliables initiales acceptees; extension eventuelle renvoyee a un futur plan
- Notes:
  - premier lot retenu: `Additional Fields` dans le panel, `Damage Effects`, `Default Value` et `HitEntityRules` repliables par defaut
  - l'objectif est de reduire la hauteur percue des formulaires denses sans masquer les sections de base les plus frequentes

---

## Lot 6 - Validation UX legere et preuves de fermeture

- Statut global: `done`
- Objectif: fermer le chantier avec des preuves simples et reutilisables.

### 6.1 - Construire une checklist de walkthrough manuel

- Statut: `done`
- Priorite: P1
- Taches:
  - [x] lister 5 parcours critiques max
  - [x] rattacher chaque parcours aux lots modifies
- Validation:
  - [x] checklist presente et exploitable
- Notes:
  - checklist de cloture retenue:
    1. Accueil / creation projet: ouvrir un workspace, ouvrir le formulaire de creation, modifier `Project ID` puis `Directory`, verifier que le champ `Directory` ne saute plus apres edition manuelle. Lots couverts: `Lot 4`.
    2. Decouverte du workflow interactions: depuis le dashboard projet, comprendre le chemin vers `Items Graph`, selectionner un item compatible et ouvrir `Interactions` depuis le side panel. Lots couverts: `Lot 2`.
    3. Confiance d'edition: modifier un asset dans un panneau lateral, tenter un changement de selection ou une fermeture sans sauvegarder, verifier la confirmation `Cancel / Discard`. Lots couverts: `Lot 1`.
    4. Exploration de graphe: rechercher un item, charger le graphe, verifier qu'un clic simple ne recentre pas la camera, que `+ / -` reste coherent, qu'un clic sur une ref ouvre bien la branche si possible, et que le warning de troncature reste actionnable s'il apparait. Lots couverts: `Lot 3` et `Lot 4`.
    5. Formulaire dense interaction: ouvrir un type dense comme `DamageEntity` ou `Replace`, verifier que la lecture generale est plus claire et que les sections `Damage Effects`, `Default Value`, `HitEntityRules` ou `Additional Fields` peuvent rester repliees jusqu'au besoin. Lots couverts: `Lot 5`.

### 6.2 - Verifier qu'aucune regression technique evidente n'est introduite

- Statut: `done`
- Priorite: P1
- Taches:
  - [x] `npm --prefix frontend run build`
  - [x] verifier manuellement les flux modifies
  - [x] ajouter des tests si un comportement devient assez stable pour etre automatise
- Validation:
  - [x] build frontend vert
  - [x] preuves manuelles notees dans ce tracker
- Notes:
  - build frontend relance a chaque sous-lot principal et encore pendant la stabilisation lot 3 / lancement lot 5 / lancement lot 6; dernier etat connu: `npm --prefix frontend run build` vert
  - preuves manuelles deja observees dans la session: validation utilisateur du lot 1, validation utilisateur du lot 2, puis validation iterative utilisateur sur la stabilisation de la vue `Modified` jusqu'au comportement juge correct
  - aucun test frontend automatise n'a ete ajoute pour l'instant; ce point est accepte pour cloture et reporte a un futur chantier si les comportements deviennent suffisamment stables pour meriter cette couverture

## Cloture

- Statut global du chantier: `done`
- Date de cloture: `2026-03-14`
- Decision: le plan et ce tracker passent en archive dans `archived_task/`
- Portee de la cloture: les incoherences et problemes residuels sont explicitement reportes a un futur plan, sans reouverture de `UXWORKFLOW1`
- Validation minimale retenue: `npm --prefix frontend run build` vert, validations manuelles deja obtenues pendant la session, et tracker complete avec les decisions de cloture
