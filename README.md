# Figma → Roblox (FigmaRoblox)

**Envoie tes designs, modèles 3D et images dans Roblox Studio en deux clics.**

| Depuis | Tu envoies | Ça arrive dans Studio comme |
|---|---|---|
| **Figma** | Une interface (frame) | Un `ScreenGui` de vrais objets Roblox (`Frame`, `TextLabel`, `ImageLabel`, `UIGradient`, `UIStroke`, `UICorner`…), modifiables et scriptables. |
| **Blender** | La sélection ou la scène | Un `Model` de `MeshPart` dans le `Workspace`, posé devant la caméra. |
| **N'importe quel logiciel** (dossier d'envoi) | Images `.png .jpg .bmp .tga`, modèles `.fbx .glb .gltf .rbxm .rbxmx` | Modèles dans le `Workspace`, images dans un ScreenGui « Images importées ». |

Tout est **mis en ligne automatiquement sur ton compte Roblox** (via l'API Open Cloud, avec ta
propre clé) : tu n'as plus aucun upload manuel à faire. Pour Figma, les éléments que Roblox ne
sait pas dessiner (flous, glows, ombres, icônes vectorielles…) sont exportés en PNG tout seuls.

---

## Sommaire

1. [Comment ça marche](#1-comment-ça-marche)
2. [Ce qu'il te faut](#2-ce-quil-te-faut)
3. [Installation pas à pas](#3-installation-pas-à-pas)
   - [3.1 Créer la clé API Roblox](#31-créer-la-clé-api-roblox)
   - [3.2 Lancer l'application FigmaRoblox.exe](#32-lancer-lapplication-figmarobloxexe)
   - [3.3 Installer le plugin Figma](#33-installer-le-plugin-figma)
   - [3.4 Installer le plugin Roblox Studio](#34-installer-le-plugin-roblox-studio)
   - [3.5 Installer l'add-on Blender](#35-installer-ladd-on-blender)
4. [Utilisation au quotidien](#4-utilisation-au-quotidien)
   - [4.1 Depuis Figma](#41-depuis-figma)
   - [4.2 Depuis Blender](#42-depuis-blender)
   - [4.3 Avec le dossier d'envoi (tous les logiciels)](#43-avec-le-dossier-denvoi-tous-les-logiciels)
   - [4.4 Formats acceptés](#44-formats-acceptés)
5. [Ce qui est converti (et comment)](#5-ce-qui-est-converti-et-comment)
6. [Bien préparer son design dans Figma](#6-bien-préparer-son-design-dans-figma)
7. [Le panneau de l'application](#7-le-panneau-de-lapplication)
8. [Dépannage](#8-dépannage)
9. [Sécurité et vie privée](#9-sécurité-et-vie-privée)
10. [Exemple : une boussole de jeu](#10-exemple--une-boussole-de-jeu)
11. [Pour les développeurs](#11-pour-les-développeurs)
12. [Limites connues et idées](#12-limites-connues-et-idées)

---

## 1. Comment ça marche

Le projet est fait d'**une application** au centre, et de plugins autour :

```
┌───────────────┐  design (JSON + PNG)
│ Plugin Figma  │ ──── POST /push ────┐
└───────────────┘                     │
┌───────────────┐  fichier .glb/.fbx  ▼                       upload        ┌───────────────────┐
│ Add-on Blender│ ── POST /upload ─▶ ┌────────────────────────┐ ──────────▶ │ Roblox Open Cloud │
└───────────────┘                    │   FigmaRoblox.exe      │ ◀────────── │   (API Assets)    │
┌───────────────┐  fichier déposé    │   localhost:7777       │  IDs assets └───────────────────┘
│ Dossier       │ ── surveillé ────▶ │   + panneau de réglages│
│ d'envoi       │                    └───────────▲────────────┘
└───────────────┘                                │ GET /latest, GET /assets
                                     ┌───────────┴────────────┐
                                     │  Plugin Roblox Studio  │ ──▶ ScreenGui (Figma)
                                     │  (2 boutons)           │ ──▶ Models dans Workspace, images
                                     └────────────────────────┘
```

| Morceau | Dossier | Rôle |
|---|---|---|
| **Application locale** | [`bridge/`](bridge) | Petit serveur sur `localhost:7777`. Reçoit les envois, les met en ligne via l'API Open Cloud de Roblox (avec **ta** clé), surveille le dossier d'envoi, et garde la liste de ce qui est prêt à importer. Fournit aussi le panneau de réglages. |
| **Plugin Figma** | [`figma-plugin/`](figma-plugin) | Lit le frame sélectionné, le convertit en arbre d'UI Roblox, exporte en PNG ce qui doit l'être. |
| **Add-on Blender** | [`blender-addon/`](blender-addon) | Exporte la sélection (ou la scène) en `.glb` ou `.fbx` et l'envoie à l'application. |
| **Plugin Studio** | [`roblox-plugin/`](roblox-plugin) | Deux boutons : « Importer depuis Figma » (le dernier design) et « Importer modèles et images » (tout ce qui est arrivé depuis le dernier clic). |

Pourquoi une application au milieu ? Parce que Figma, Blender et Studio ne peuvent pas se parler
directement, et que mettre un fichier en ligne sur Roblox demande une clé API qu'on ne veut pas
mettre dans chaque plugin. L'application garde la clé sur ton PC et fait le lien.

---

## 2. Ce qu'il te faut

- **Windows 10 ou 11** (l'application `.exe` est pour Windows ; voir [§11](#11-pour-les-développeurs) pour Mac/Linux).
- **Roblox Studio**.
- Selon ce que tu utilises :
  - **Figma Desktop** (l'application, pas le navigateur : les plugins en développement ne marchent que là) ;
  - **Blender 4.2 ou plus récent** (testé avec Blender 5.2) ;
  - n'importe quel logiciel qui exporte des images ou des modèles, pour le dossier d'envoi.
- Un **compte Roblox** (les images seront mises en ligne dessus, ou sur un groupe).

Rien d'autre à installer : l'exe contient déjà tout ce qu'il faut.

---

## 3. Installation pas à pas

### 3.1 Créer la clé API Roblox

La clé permet à l'application de mettre tes images en ligne sur ton compte, sans ton mot de passe.

1. Va sur **https://create.roblox.com/dashboard/credentials** (connecte-toi si besoin).
2. Onglet **API Keys** → bouton **Create API Key**.
3. **Name** : ce que tu veux, par exemple `Figma Roblox`.
4. **Access Permissions** → *Select API System* → choisis **Assets** → **Add API System**.
   - Coche **Read** et **Write**.
5. **Security** → *Accepted IP Addresses* → ajoute **`0.0.0.0/0`**
   (sinon la clé ne marche que depuis une adresse IP précise ; ton IP chez toi change souvent).
6. **Expiration** : laisse vide (pas d'expiration) ou choisis une date.
7. **Save & Generate Key**, puis **Copy Key to Clipboard**.

> ⚠️ La clé ne s'affiche qu'une fois. Si tu la perds, régénère-la (bouton *Regenerate*).
> Ne la partage jamais et ne la mets jamais dans un fichier publié sur GitHub.

Si les images doivent appartenir à un **groupe** Roblox plutôt qu'à ton compte : crée la clé depuis
la page du groupe (`create.roblox.com` → choisis le groupe en haut à gauche), et indique l'ID du
groupe dans le panneau (voir 3.2).

### 3.2 Lancer l'application FigmaRoblox.exe

1. Télécharge **`FigmaRoblox.exe`** depuis la page [**Releases**](../../releases/latest).
2. Mets-le où tu veux (Bureau, `Documents\Outils`…) et double-clique dessus.
   - Windows SmartScreen peut afficher « Windows a protégé votre ordinateur » car l'exe n'est pas
     signé : clique **Informations complémentaires** → **Exécuter quand même**.
   - Une fenêtre noire s'ouvre (c'est le serveur : **laisse-la ouverte** tant que tu utilises l'outil).
   - Ton navigateur ouvre le **panneau** sur `http://localhost:7777`.
3. Dans le panneau :
   1. Colle ta clé dans **Clé API Open Cloud**.
   2. Laisse **ID** vide (il sera rempli tout seul) — sauf pour un groupe : choisis *Un groupe* et mets l'ID du groupe.
   3. Clique **Enregistrer**, puis **Tester la clé**.
   4. Tu dois voir **« Clé valide … avec droit d'upload »** et le point en haut passe au vert.

Les réglages sont sauvegardés dans `%APPDATA%\FigmaRoblox\config.json` : au prochain lancement,
plus rien à faire.

### 3.3 Installer le plugin Figma

1. Télécharge ce dépôt : bouton vert **Code → Download ZIP**, puis décompresse-le
   (ou `git clone https://github.com/exiozz/figma-to-roblox.git`).
2. Ouvre **Figma Desktop** et n'importe quel fichier de design.
3. Menu **Plugins → Development → Import plugin from manifest…**
4. Choisis le fichier **`figma-plugin/manifest.json`** du dossier décompressé.
5. Le plugin **« Figma → Roblox »** apparaît maintenant dans **Plugins → Development**.

> Ne déplace plus le dossier ensuite : Figma garde le chemin du manifest.
> Si tu le déplaces, refais l'étape 3–4.

### 3.4 Installer le plugin Roblox Studio

1. Ouvre le dossier des plugins locaux : touche **Windows + R**, tape
   `%LOCALAPPDATA%\Roblox\Plugins` puis **Entrée**
   (si le dossier n'existe pas, crée-le).
2. Copie-y le fichier **`roblox-plugin/FigmaImporter.server.lua`**.
3. **Redémarre Roblox Studio**.
4. Un onglet **FigmaRoblox** apparaît dans le ruban avec deux boutons :
   **Importer depuis Figma** et **Importer modèles et images**.

Variante : dans Studio, onglet **Plugins → Plugins Folder** ouvre directement ce dossier.

### 3.5 Installer l'add-on Blender

1. Dans Blender : **Edit → Preferences → Get Extensions** (ou **Add-ons** selon la version).
2. Menu **⌄** en haut à droite → **Install from Disk…**
3. Choisis le fichier **`blender-addon/roblox_bridge.py`** du dossier téléchargé.
4. Vérifie que **Roblox Bridge (FigmaRoblox)** est coché dans la liste des add-ons.
5. Dans la vue 3D, appuie sur **N** : un onglet **Roblox** apparaît dans la barre latérale.

---

## 4. Utilisation au quotidien

Dans tous les cas, **`FigmaRoblox.exe` doit être lancé**.

### 4.1 Depuis Figma

1. **Dans Figma** : sélectionne **un seul frame** (le conteneur de ton UI).
2. **Plugins → Development → Figma → Roblox** → **Envoyer vers Roblox Studio**.
   - Le plugin affiche *« Prêt ! (N nouvelle(s) image(s) envoyée(s)) »*.
   - La première fois, l'envoi prend quelques secondes par image. Ensuite, les images identiques
     sont réutilisées (cache), donc c'est instantané.
3. **Dans Studio** : onglet **FigmaRoblox** → **Importer depuis Figma**.
   - La toute première fois, Studio demande l'autorisation d'accéder à `localhost` : **Allow**.
   - Un `ScreenGui` portant le nom du frame est créé dans **`StarterGui`**, centré en haut de l'écran,
     et sélectionné.
   - L'import est annulable avec **Ctrl+Z**.
4. Modifie, déplace, scripte : ce sont des objets Roblox normaux.

Tu modifies le design ? Renvoie depuis Figma, réimporte dans Studio : un **nouveau** ScreenGui est
créé à côté de l'ancien (rien n'est écrasé). Supprime l'ancien quand tu es satisfait.

### 4.2 Depuis Blender

1. Sélectionne le ou les objets à envoyer.
2. Vue 3D → **N** → onglet **Roblox** :

   | Réglage | Effet |
   |---|---|
   | **Format** | **glTF binaire (.glb)** — recommandé : matériaux et textures dans un seul fichier. **FBX** — textures intégrées au fichier. |
   | **Nom** | Nom de l'asset dans Roblox. Vide : nom de l'objet actif (ou du fichier .blend). |
   | **Sélection uniquement** | Coché : seulement les objets sélectionnés. Décoché : toute la scène. |
   | **Appliquer les modificateurs** | Exporte le résultat des modificateurs (Subdivision, Mirror, Bevel…). |

3. **Envoyer vers Roblox**. Blender reste utilisable pendant l'envoi ; le résultat s'affiche sous
   le bouton (*« En ligne : … »* ou le message d'erreur).
4. **Dans Studio** : **Importer modèles et images**. Le modèle arrive dans le `Workspace`, posé
   sur ce que regarde la caméra, et il est sélectionné.

Conseils Blender :
- **Applique l'échelle et la rotation** (Ctrl+A → *All Transforms*) avant d'envoyer, sinon le modèle
  peut arriver tourné ou à la mauvaise taille.
- Dans Roblox, **1 stud ≈ 0,28 m**. Un personnage Roblox mesure environ 5 studs (≈ 1,4 m).
  Si ton modèle arrive trop petit ou trop grand, mets-le à l'échelle dans Studio (outil *Scale*)
  ou dans Blender avant l'envoi.
- Roblox limite chaque mesh à **20 000 triangles** environ : décime les modèles trop lourds
  (modificateur *Decimate*).
- Les textures doivent être des images (pas des nœuds procéduraux) : *bake* les matériaux
  procéduraux avant l'envoi.

### 4.3 Avec le dossier d'envoi (tous les logiciels)

Le dossier **`Documents\FigmaRoblox\Envoyer vers Roblox`** est surveillé en permanence
(bouton **Ouvrir le dossier** dans le panneau).

1. Exporte ou copie ton fichier dedans (depuis Photoshop, Krita, Aseprite, Maya, 3ds Max,
   Cinema 4D, SketchUp, un téléchargement…).
2. L'application attend la fin de la copie, met le fichier en ligne, puis le range dans
   **`Documents\FigmaRoblox\Envoyés`** (préfixé par la date et l'heure).
3. **Dans Studio** : **Importer modèles et images**.
   - Les **modèles** arrivent dans le `Workspace`, devant la caméra.
   - Les **images** sont ajoutées en `ImageLabel` dans le ScreenGui **« Images importées »** de
     `StarterGui` (désactivé par défaut : c'est une réserve). Copie l'ID (`Image`) là où tu en as besoin,
     ou déplace l'`ImageLabel` dans ton interface.

Un fichier refusé (format inconnu, trop gros, erreur Roblox) **reste dans le dossier** et l'erreur
s'affiche dans le journal du panneau. Les fichiers déposés avant d'avoir configuré la clé sont
envoyés dès que tu cliques **Tester la clé**.

### 4.4 Formats acceptés

Ce sont les formats acceptés par l'API Assets de Roblox (Open Cloud) :

| Type | Extensions | Limites |
|---|---|---|
| Image | `.png` `.jpg` `.jpeg` `.bmp` `.tga` | 20 Mo, moins de 8000 × 8000 px |
| Modèle 3D | `.fbx` `.glb` `.gltf` `.rbxm` `.rbxmx` | 20 Mo |

- **`.obj` n'est pas accepté** par l'API de Roblox (seulement par l'importeur manuel de Studio) :
  convertis-le en `.glb` ou `.fbx` (par exemple en l'ouvrant dans Blender).
- **`.gltf`** : uniquement s'il est autonome (textures intégrées). Un `.gltf` qui pointe vers des
  fichiers `.bin` ou `.png` à côté ne passera pas : préfère **`.glb`**.
- **`.rbxm` / `.rbxmx`** : modèles Roblox exportés depuis Studio (*Save to File*).
- Les modèles mis en ligne apparaissent aussi dans Studio → **Toolbox → Inventaire → Mes packages**.

---

## 5. Ce qui est converti (et comment)

| Dans Figma | Dans Roblox | Détails |
|---|---|---|
| Frame, Group, Component, Instance, Rectangle | `Frame` | Position et taille en pixels (offset), relatives au parent. |
| Remplissage uni | `BackgroundColor3` + `BackgroundTransparency` | L'opacité du remplissage **et** des calques parents est prise en compte. |
| Dégradé **linéaire** | `UIGradient` | Couleurs, transparences (jusqu'à 20 arrêts) et angle. |
| Coins arrondis | `UICorner` | Rayon uniforme (`cornerRadius`). |
| Contour uni | `UIStroke` (mode *Border*) | Couleur, opacité, épaisseur. |
| « Clip content » | `ClipsDescendants` | |
| Texte | `TextLabel` | Taille, couleur, alignements, retour à la ligne, police (voir ci-dessous). |
| Ombre portée **sombre** sur un texte | `UIStroke` (mode *Contextual*) | Roblox n'a pas d'ombre de texte : un contour fin donne le même effet de lisibilité. |
| Vecteurs, lignes, étoiles, polygones, ellipses, booléens | `ImageLabel` (PNG) | |
| Groupe composé **uniquement** de formes (une icône SVG) | **un seul** `ImageLabel` | Évite de découper une icône en morceaux. |
| N'importe quel calque avec un **effet** (flou, ombre, glow) | `ImageLabel` (PNG) | Le PNG inclut l'effet, avec ses débordements (bounds de rendu). |
| Image, dégradé radial/angulaire/losange, plusieurs remplissages | `ImageLabel` (PNG) | |
| Calque **tourné** | `ImageLabel` (PNG) | |
| Calque masqué (œil fermé) | ignoré | |

**Ordre d'affichage** : l'ordre des calques Figma est conservé via `ZIndex` (le `ScreenGui` utilise
`ZIndexBehavior = Sibling`).

**Images** : exportées en **×2** pour rester nettes sur les écrans haute densité, puis affichées à
la taille d'origine (`ScaleType = Stretch`).

**Polices** : Roblox n'a pas les polices Figma. Correspondances utilisées :

| Figma | Roblox |
|---|---|
| Inter, Poppins, *toute police inconnue* | Builder Sans |
| Roboto | Roboto |
| Montserrat | Montserrat |
| Gotham | Gotham SSm |
| Source Sans Pro | Source Sans Pro |
| Nunito | Nunito |
| Oswald | Oswald |
| Fredoka One | Fredoka One |
| Luckiest Guy | Luckiest Guy |

Les graisses (Thin → Black) et l'italique sont conservés. Pour ajouter une correspondance, modifie
la table `FAMILIES` en haut de `roblox-plugin/FigmaImporter.server.lua`.

---

## 6. Bien préparer son design dans Figma

- **Un frame = un écran d'UI.** Envoie le frame conteneur, pas un calque isolé.
- **Nomme tes calques** : les noms sont repris tels quels dans Roblox (`Heading`, `Quest Marker`…).
  Ça rend le scripting beaucoup plus simple.
- **Préfère les formes simples** (rectangles, frames, textes) quand c'est possible : elles restent
  éditables dans Roblox (couleur, texte, taille). Tout ce qui devient PNG est figé.
- **Regroupe tes icônes** dans un frame ou un groupe : elles sortent en une seule image propre.
- **Textes** : évite le style mixte dans un même bloc (gras + normal) — seul le premier style est repris.
  Coupe en plusieurs textes si besoin.
- **Taille** : pense à la taille d'écran Roblox. Un frame de 600 px de large occupe environ la moitié
  d'un écran 1280 px.
- **Effets** : un effet sur un frame qui contient des enfants transforme **tout le frame** en image.
  Si tu veux garder les enfants éditables, mets l'effet sur un calque séparé en dessous (comme le
  « Glow » de l'exemple).

---

## 7. Le panneau de l'application

Ouvre **http://localhost:7777** pendant que l'exe tourne (il s'ouvre aussi tout seul au lancement).

| Zone | Contenu |
|---|---|
| Point vert / rouge | Vert : clé et compte configurés, prêt à recevoir. Rouge : à configurer, ou serveur arrêté. |
| **Compte Roblox** | Clé API (jamais réaffichée en entier, seulement les 4 derniers caractères), propriétaire des images (ton compte ou un groupe) et son ID. |
| **Tester la clé** | Interroge Roblox pour vérifier que la clé est valide, active, non expirée, et qu'elle a bien le droit *Assets → Write*. Remplit ton User ID automatiquement. |
| **Dossier d'envoi** | Chemin du dossier surveillé et bouton **Ouvrir le dossier**. |
| **Activité** | Dernier design Figma (nom, version, heure), nombre de fichiers en cache, et les 8 derniers envois (Blender, dossier) avec leur ID Roblox. |
| **Journal** | Les 100 derniers évènements et erreurs. |

Relancer l'exe alors qu'il tourne déjà ouvre simplement le panneau (pas de doublon).

---

## 8. Dépannage

| Problème | Cause probable | Solution |
|---|---|---|
| Plugin Figma : *« Serveur local injoignable »* | L'exe n'est pas lancé, ou a été fermé. | Lance `FigmaRoblox.exe` et garde sa fenêtre ouverte. |
| Plugin Figma : *« Clé API non configurée »* | Rien n'est enregistré dans le panneau. | Suis [§3.2](#32-lancer-lapplication-figmarobloxexe). |
| Plugin Figma : *« Sélectionne un seul frame »* | Rien ou plusieurs calques sélectionnés. | Clique sur un seul frame. |
| *« Upload refusé (401) »* | Clé invalide ou mal copiée. | Recopie la clé, **Enregistrer**, **Tester la clé**. |
| *« Upload refusé (403) »* | La clé n'a pas *Assets → Write*, ou l'IP n'est pas autorisée, ou l'ID ne correspond pas au propriétaire de la clé. | Vérifie les permissions et `0.0.0.0/0` sur create.roblox.com ; laisse l'ID vide puis **Tester la clé**. |
| *« Upload refusé (429) »* | Trop d'uploads d'un coup (limite Roblox). | Attends une minute et renvoie : les images déjà envoyées sont en cache. |
| Studio : pas d'onglet **FigmaRoblox** | Fichier mal placé ou Studio pas redémarré. | Vérifie `%LOCALAPPDATA%\Roblox\Plugins\FigmaImporter.server.lua`, redémarre Studio. |
| Studio : *« Application injoignable »* dans la sortie | L'exe n'est pas lancé, ou l'accès HTTP du plugin a été refusé. | Lance l'exe. Si tu as cliqué *Deny* : **Plugins → Manage Plugins** → FigmaImporter → autorise `localhost`. |
| Studio : *« Rien à importer »* (Figma) | Aucun envoi depuis Figma depuis le lancement de l'exe. | Le design Figma est gardé **en mémoire** : renvoie depuis Figma après chaque redémarrage de l'exe. |
| Studio : *« Rien de nouveau »* (modèles et images) | Tout ce qui a été envoyé a déjà été importé. | Envoie un nouveau fichier. Les modèles déjà en ligne restent dans **Toolbox → Inventaire → Mes packages**. |
| Studio : *« Modèle … pas encore disponible »* | Roblox n'a pas fini de traiter (ou de modérer) le modèle. | Attends un peu et reclique : il est retenté automatiquement. |
| Images **vides / grises** dans Studio | Images en cours de modération chez Roblox. | Attends quelques minutes : elles apparaissent toutes seules. |
| Blender : *« Application FigmaRoblox injoignable »* | L'exe n'est pas lancé. | Lance `FigmaRoblox.exe`. |
| Blender : *« Export impossible »* | Objet non exportable (pas de mesh sélectionné, erreur de l'exporteur). | Vérifie la sélection ; essaie l'autre format (GLB ↔ FBX). |
| Blender : bouton grisé | Rien n'est sélectionné alors que *Sélection uniquement* est coché, ou un envoi est en cours. | Sélectionne un objet ou décoche l'option ; attends la fin de l'envoi. |
| Modèle **tourné / mauvaise taille** | Transformations non appliquées dans Blender, ou différence d'unités. | Ctrl+A → *All Transforms* avant l'envoi ; ajuste l'échelle dans Studio. |
| Modèle **sans texture** | Matériau procédural, ou `.gltf` avec fichiers séparés. | *Bake* les textures, envoie en `.glb`. |
| Dossier : le fichier reste dans le dossier | Format non accepté, fichier de plus de 20 Mo, ou erreur Roblox. | Lis le journal du panneau. Pour un `.obj`, convertis-le en `.glb`. |
| Plugin Figma : *« client inconnu »* | Ancienne version du plugin Figma. | Télécharge la dernière version du dépôt et réimporte le manifest. |
| Image **refusée par la modération** | Contenu jugé non conforme par Roblox. | Modifie l'élément et renvoie. |
| Le texte n'a pas la bonne police | Police absente de Roblox. | Voir le tableau des polices [§5](#5-ce-qui-est-converti-et-comment). |
| Windows bloque l'exe | Exe non signé. | *Informations complémentaires* → *Exécuter quand même*. |
| Le port 7777 est déjà utilisé | Un autre programme l'occupe. | Ferme ce programme, ou change `PORT` dans `bridge/bridge.js`, `BRIDGE` dans les deux plugins, et `devAllowedDomains` dans le manifest, puis recompile. |

---

## 9. Sécurité et vie privée

- La **clé API** est stockée uniquement sur ton PC, dans `%APPDATA%\FigmaRoblox\config.json`.
  Elle n'est envoyée **qu'à Roblox** (`apis.roblox.com`), jamais ailleurs, et n'est jamais
  réaffichée en entier dans le panneau.
- Le serveur n'écoute que sur **`127.0.0.1`** : il n'est pas accessible depuis le réseau.
- Les routes de réglages (`/config`, `/test-key`, `/status`) **refusent les requêtes venant d'un
  autre site** : une page web ouverte dans ton navigateur ne peut ni lire ni changer tes réglages.
- Les **envois** (`/push`, `/upload`) exigent un en-tête `X-FigmaRoblox: 1`. Un site web ne peut pas
  ajouter cet en-tête sans autorisation CORS, et seule l'origine `null` (l'iframe du plugin Figma)
  la reçoit, et seulement pour `/push` : une page ouverte dans ton navigateur ne peut donc pas
  mettre de fichiers en ligne sur ton compte.
- Le dossier surveillé n'envoie **que** les formats acceptés par Roblox ; le reste est ignoré.
- `.gitignore` exclut `config.json` et le cache : impossible de publier ta clé par erreur avec ce dépôt.
- Pour révoquer l'accès : supprime ou désactive la clé sur create.roblox.com.

---

## 10. Exemple : une boussole de jeu

Le dossier [`examples/compass/`](examples/compass) montre ce qu'on peut faire après l'import :
une barre de boussole façon jeu en monde ouvert, dessinée dans Figma puis rendue fonctionnelle.

**Le design Figma** (frame `Compass Bar (v2)`, 600 × 64) :
`Glow` (rectangle flouté → PNG), `Line` (dégradé → `UIGradient`), `Ticks` (graduations →
`Frame`), `Caret` (triangle → PNG), `Heading` (texte « W » → `TextLabel`), et un marqueur
(icône → PNG + texte de distance).

**Le script** [`CompassController.client.lua`](examples/compass/CompassController.client.lua),
à mettre en **LocalScript** dans le frame racine importé :

- fait **défiler** graduations et points cardinaux (N, NE, E, …) selon la direction de la caméra ;
- **estompe** les éléments vers les bords ;
- réutilise le texte « W » de Figma comme **modèle** pour toutes les lettres (même police, même contour) ;
- place le **marqueur** dans la direction du `SpawnLocation`, avec la **distance en mètres**,
  et le garde collé au bord quand la cible est hors champ.

Réglages en haut du script : `FOV` (angle couvert par la barre, 180° par défaut ; mets ~90 pour
que le marqueur colle mieux à ce qu'on voit à l'écran), `STUDS_TO_METERS`.

Pour viser autre chose que le spawn, remplace `findSpawn()` par ta propre cible
(une `Part`, un attribut `Vector3` sur le joueur pour une quête, etc.).

---

## 11. Pour les développeurs

### Arborescence

```
figma-plugin/
  manifest.json        Déclaration du plugin (accès réseau limité à localhost:7777)
  code.js              Conversion Figma → arbre JSON + export PNG
  ui.html              Fenêtre du plugin, envoie le JSON au serveur
bridge/
  bridge.js            Serveur local, upload Open Cloud, dossier surveillé, panneau, cache
  panel.html           Panneau de réglages (embarqué dans l'exe)
  sea-config.json      Configuration de compilation en exe (Node SEA)
blender-addon/
  roblox_bridge.py     Add-on Blender : export .glb/.fbx + envoi
roblox-plugin/
  FigmaImporter.server.lua   Plugin Studio : construit l'UI Figma, insère modèles et images
examples/compass/
  CompassController.client.lua
```

### Lancer sans l'exe

```bash
cd bridge
node bridge.js          # Node 18 ou plus
```

Variables utiles : `NO_BROWSER=1` pour ne pas ouvrir le navigateur au lancement.
Fonctionne aussi sur macOS / Linux (les réglages vont alors dans le dossier personnel).

### Recompiler l'exe

Nécessite **Node 25 ou plus** (commande `--build-sea`) :

```bash
cd bridge
node --build-sea sea-config.json     # produit FigmaRoblox.exe
```

`panel.html` est embarqué dans l'exe comme *asset* (voir `sea-config.json`). En mode `node bridge.js`,
il est lu depuis le disque.

### API du serveur local (`http://localhost:7777`)

| Méthode | Route | Utilisée par | Description |
|---|---|---|---|
| `GET` | `/` | navigateur | Panneau HTML. |
| `POST` | `/push` | plugin Figma | En-tête `X-FigmaRoblox: 1`. Reçoit `{ name, tree, images }`, met les images en ligne, remplace les clés d'image par `rbxassetid://…`. Répond `{ ok, version, uploaded }`. |
| `POST` | `/upload?name=fichier.glb&source=Blender` | add-on Blender, tes scripts | En-tête `X-FigmaRoblox: 1`, corps = octets du fichier (20 Mo max). Le format est déduit de l'extension de `name`. Répond `{ ok, asset }`. |
| `GET` | `/latest` | plugin Studio | Dernier design Figma : `{ version, name, tree, at }` (ou `{ version: 0 }` si rien). |
| `GET` | `/assets?after=N` | plugin Studio | Fichiers mis en ligne après l'entrée `N` : `{ assets: [{ id, kind, name, assetId, source, at }] }` avec `kind` = `"model"` ou `"image"`. |
| `GET` | `/status` | panneau | État, clé masquée, IDs, cache, derniers envois, dossier surveillé, journal. |
| `POST` | `/config` | panneau | `{ apiKey?, userId? \| groupId? }`. |
| `POST` | `/test-key` | panneau | Vérifie la clé via `api-keys/v1/introspect`. |
| `POST` | `/open-folder` | panneau | Ouvre le dossier d'envoi dans l'Explorateur. |

**Ajouter ta propre source** (Photoshop, Maya, un script…) : il suffit d'envoyer le fichier à
`/upload`. Exemple en PowerShell :

```powershell
Invoke-RestMethod -Method Post "http://localhost:7777/upload?name=arbre.fbx&source=Maya" `
  -Headers @{ "X-FigmaRoblox" = "1" } -InFile ".\arbre.fbx" -ContentType "application/octet-stream"
```

Le fichier apparaît ensuite dans Studio avec **Importer modèles et images**.

### Données sur le disque

| Fichier | Contenu |
|---|---|
| `%APPDATA%\FigmaRoblox\config.json` | Clé API et propriétaire (utilisateur ou groupe). |
| `%APPDATA%\FigmaRoblox\upload-cache.json` | Empreinte SHA-256 → ID Roblox, pour ne jamais renvoyer un fichier identique. |
| `%APPDATA%\FigmaRoblox\assets.json` | Les 200 derniers fichiers mis en ligne (lus par Studio). |
| `Documents\FigmaRoblox\Envoyer vers Roblox` | Dossier surveillé. |
| `Documents\FigmaRoblox\Envoyés` | Fichiers déjà envoyés depuis le dossier. |

### Format de l'arbre (`tree`)

Chaque nœud :

```jsonc
{
  "name": "Line",            // nom du calque Figma
  "kind": "frame",           // "frame" | "text" | "image"
  "x": 0, "y": 39.25,        // position relative au parent (px)
  "w": 600, "h": 1.5,        // taille (px)
  "z": 2,                    // ordre d'affichage parmi les frères (1 = dessous)

  // frame
  "bg": { "color": [255,255,255], "transparency": 0 },
  "gradient": {
    "rotation": 0,
    "colors":       [{ "p": 0, "c": [255,255,255] }, …],
    "transparency": [{ "p": 0, "t": 1 }, …]
  },
  "corner": 8,
  "clip": false,
  "stroke": { "color": [0,0,0], "transparency": 0.5, "thickness": 1 },
  "children": [ … ],

  // text
  "text": {
    "content": "W", "family": "Inter", "style": "Bold", "size": 13,
    "color": [255,255,255], "transparency": 0,
    "alignX": "CENTER", "alignY": "TOP", "wrap": false
  },

  // image
  "image": "img0"            // clé dans `images` (base64 PNG) côté plugin Figma,
                             // puis "rbxassetid://…" après passage dans le serveur
}
```

### Comment un calque devient une image

Voir `needsRaster()` dans [`figma-plugin/code.js`](figma-plugin/code.js) : texte jamais (sauf
rotation) ; formes vectorielles toujours ; tout calque avec un effet visible ; groupe dont toutes
les feuilles sont des formes ; remplissage image / dégradé non linéaire / multiple ; rotation.

### Upload Open Cloud

`POST https://apis.roblox.com/assets/v1/assets` (multipart : `request` JSON + `fileContent`),
avec `assetType` = **`Image`** pour les images (directement utilisables dans un `ImageLabel`) et
**`Model`** pour les modèles 3D, puis interrogation de l'opération
`GET /assets/v1/operations/{id}` jusqu'à `done`. Chaque fichier est haché (SHA-256) : un contenu
déjà envoyé n'est jamais renvoyé.

Côté Studio, les modèles sont chargés avec `InsertService:LoadAsset(id)`, regroupés dans un `Model`
au nom de l'asset, puis posés à l'endroit visé par la caméra (raycast).

---

## 12. Limites connues et idées

**Limites actuelles**

- Tailles et positions en **pixels fixes** (pas d'adaptation automatique à la taille d'écran).
  Astuce : ajoute un `UIScale` sur le frame racine.
- L'auto-layout Figma n'est pas converti en `UIListLayout` (les positions finales sont reprises,
  donc le rendu est correct, mais la mise en page n'est pas dynamique).
- Un seul style par bloc de texte.
- Les rayons de coins différents par coin ne sont pas gérés (`UICorner` est uniforme).
- Les contours en dégradé et les contours de formes non rectangulaires deviennent des images.
- Le dernier design Figma n'est gardé **qu'en mémoire** : il faut renvoyer depuis Figma après avoir
  relancé l'exe. (Les modèles et images, eux, sont gardés dans `assets.json`.)
- Plugin Figma en mode « développement » uniquement (pas publié sur la Communauté Figma).
- `.obj` non accepté par l'API de Roblox ; `.gltf` uniquement s'il est autonome.
- Les modèles sont limités à 20 Mo par fichier (limite Roblox) : une scène Blender entière
  peut dépasser, envoie-la en plusieurs fois.
- L'import des modèles dans Studio (v1.1) est nouveau : les échelles, rotations et matériaux
  dépendent de l'import de Roblox ; signale-nous ce qui arrive mal (onglet *Issues*).

**Idées d'évolution**

- Conversion de l'auto-layout en `UIListLayout` / `UIPadding`.
- Option « tailles en pourcentage » (`Scale`) au lieu des pixels.
- Mise à jour d'un ScreenGui existant au lieu d'en créer un nouveau.
- Boutons Figma → `TextButton` / `ImageButton` (par exemple via un préfixe de nom `btn_`).
- Scripts d'export pour Photoshop / Illustrator (même format JSON que Figma).
- Option d'échelle dans l'add-on Blender (mètres → studs).
- Envoi de sons (`.mp3 .ogg .wav .flac`) et d'animations, aussi acceptés par Open Cloud.

---

## Licence

[MIT](LICENSE) — libre d'utilisation, de modification et de partage.
