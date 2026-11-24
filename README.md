# Figma → Roblox

**Envoie un design Figma dans Roblox Studio en deux clics.**
Tu sélectionnes un frame dans Figma, tu cliques « Envoyer », puis « Importer » dans Studio :
ton interface arrive dans `StarterGui` sous forme de vrais objets Roblox (`Frame`, `TextLabel`,
`ImageLabel`, `UIGradient`, `UIStroke`, `UICorner`…), modifiables et scriptables.

Les éléments que Roblox ne sait pas dessiner (flous, glows, ombres, icônes vectorielles…) sont
automatiquement exportés en PNG et **mis en ligne sur ton compte Roblox** : tu n'as aucun upload
manuel à faire.

---

## Sommaire

1. [Comment ça marche](#1-comment-ça-marche)
2. [Ce qu'il te faut](#2-ce-quil-te-faut)
3. [Installation pas à pas](#3-installation-pas-à-pas)
   - [3.1 Créer la clé API Roblox](#31-créer-la-clé-api-roblox)
   - [3.2 Lancer l'application FigmaRoblox.exe](#32-lancer-lapplication-figmarobloxexe)
   - [3.3 Installer le plugin Figma](#33-installer-le-plugin-figma)
   - [3.4 Installer le plugin Roblox Studio](#34-installer-le-plugin-roblox-studio)
4. [Utilisation au quotidien](#4-utilisation-au-quotidien)
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

Le projet est fait de **trois morceaux** qui se parlent sur ton PC :

```
┌───────────────┐   1. design (JSON + PNG)   ┌──────────────────────┐   2. upload PNG   ┌──────────────────┐
│ Plugin Figma  │ ─────────────────────────▶ │  FigmaRoblox.exe     │ ────────────────▶ │ Roblox Open Cloud │
│ (dans Figma)  │      POST /push            │  serveur local       │ ◀──────────────── │  (API Assets)     │
└───────────────┘                            │  http://localhost:7777│    IDs d'assets   └──────────────────┘
                                             └──────────▲───────────┘
                                                        │ 3. GET /latest
                                             ┌──────────┴───────────┐
                                             │ Plugin Roblox Studio │ ──▶ crée le ScreenGui dans StarterGui
                                             └──────────────────────┘
```

| Morceau | Dossier | Rôle |
|---|---|---|
| **Plugin Figma** | [`figma-plugin/`](figma-plugin) | Lit le frame sélectionné, le convertit en arbre d'UI Roblox, exporte en PNG ce qui doit l'être. |
| **Application locale** | [`bridge/`](bridge) | Petit serveur sur `localhost:7777`. Reçoit le design, met les PNG en ligne via l'API Open Cloud de Roblox (avec **ta** clé), le garde en mémoire pour Studio. Fournit aussi le panneau de réglages. |
| **Plugin Studio** | [`roblox-plugin/`](roblox-plugin) | Bouton « Importer depuis Figma » : récupère le dernier design et construit les objets Roblox. |

Pourquoi une application au milieu ? Parce qu'un plugin Figma ne peut pas parler directement à
Roblox Studio, et que mettre une image en ligne sur Roblox demande une clé API qu'on ne veut pas
mettre dans un plugin. L'application garde la clé sur ton PC et fait le lien.

---

## 2. Ce qu'il te faut

- **Windows 10 ou 11** (l'application `.exe` est pour Windows ; voir [§11](#11-pour-les-développeurs) pour Mac/Linux).
- **Figma Desktop** (l'application, pas le navigateur : les plugins en développement ne marchent que là).
- **Roblox Studio**.
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
4. Un onglet **Figma** apparaît dans le ruban avec le bouton **Importer depuis Figma**.

Variante : dans Studio, onglet **Plugins → Plugins Folder** ouvre directement ce dossier.

---

## 4. Utilisation au quotidien

1. **Lance `FigmaRoblox.exe`** (si ce n'est pas déjà fait).
2. **Dans Figma** : sélectionne **un seul frame** (le conteneur de ton UI).
3. **Plugins → Development → Figma → Roblox** → **Envoyer vers Roblox Studio**.
   - Le plugin affiche *« Prêt ! (N nouvelle(s) image(s) envoyée(s)) »*.
   - La première fois, l'envoi prend quelques secondes par image. Ensuite, les images identiques
     sont réutilisées (cache), donc c'est instantané.
4. **Dans Studio** : onglet **Figma** → **Importer depuis Figma**.
   - La toute première fois, Studio demande l'autorisation d'accéder à `localhost` : **Allow**.
   - Un `ScreenGui` portant le nom du frame est créé dans **`StarterGui`**, centré en haut de l'écran,
     et sélectionné.
   - L'import est annulable avec **Ctrl+Z**.
5. Modifie, déplace, scripte : ce sont des objets Roblox normaux.

Tu modifies le design ? Renvoie depuis Figma, réimporte dans Studio : un **nouveau** ScreenGui est
créé à côté de l'ancien (rien n'est écrasé). Supprime l'ancien quand tu es satisfait.

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
| **Activité** | Dernier design reçu (nom, version, heure) et nombre d'images en cache. |
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
| Studio : pas d'onglet **Figma** | Fichier mal placé ou Studio pas redémarré. | Vérifie `%LOCALAPPDATA%\Roblox\Plugins\FigmaImporter.server.lua`, redémarre Studio. |
| Studio : *« Pont local injoignable »* dans la sortie | L'exe n'est pas lancé, ou l'accès HTTP du plugin a été refusé. | Lance l'exe. Si tu as cliqué *Deny* : **Plugins → Manage Plugins** → Figma → autorise `localhost`. |
| Studio : *« Rien à importer »* | Aucun envoi depuis Figma depuis le lancement de l'exe. | Le design est gardé **en mémoire** : renvoie depuis Figma après chaque redémarrage de l'exe. |
| Images **vides / grises** dans Studio | Images en cours de modération chez Roblox, ou ancienne version du plugin Studio. | Attends quelques minutes et réimporte. Vérifie que tu as la dernière version du plugin (voir ci-dessous). |
| Image **refusée par la modération** | Contenu jugé non conforme par Roblox. | Modifie l'élément et renvoie. |
| Le texte n'a pas la bonne police | Police absente de Roblox. | Voir le tableau des polices [§5](#5-ce-qui-est-converti-et-comment). |
| Windows bloque l'exe | Exe non signé. | *Informations complémentaires* → *Exécuter quand même*. |
| Le port 7777 est déjà utilisé | Un autre programme l'occupe. | Ferme ce programme, ou change `PORT` dans `bridge/bridge.js`, `BRIDGE` dans les deux plugins, et `devAllowedDomains` dans le manifest, puis recompile. |

**Pourquoi « Decal » puis image ?** L'API Open Cloud crée des assets de type *Decal*. Un `ImageLabel`
a besoin de l'*Image* contenue dans le Decal : le plugin Studio la retrouve automatiquement
(`InsertService:LoadAsset`) et garde la correspondance en cache. Si tu vois des images vides avec
des IDs qui ne se chargent pas, c'est que Studio utilise une ancienne copie du plugin : remplace
le fichier et redémarre Studio.

---

## 9. Sécurité et vie privée

- La **clé API** est stockée uniquement sur ton PC, dans `%APPDATA%\FigmaRoblox\config.json`.
  Elle n'est envoyée **qu'à Roblox** (`apis.roblox.com`), jamais ailleurs, et n'est jamais
  réaffichée en entier dans le panneau.
- Le serveur n'écoute que sur **`127.0.0.1`** : il n'est pas accessible depuis le réseau.
- Les routes de réglages (`/config`, `/test-key`, `/status`) **refusent les requêtes venant d'un
  autre site** : une page web ouverte dans ton navigateur ne peut ni lire ni changer tes réglages.
- Les routes utilisées par les plugins (`/push`, `/latest`) sont ouvertes en local car l'iframe
  du plugin Figma a une origine `null`.
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
  bridge.js            Serveur local, upload Open Cloud, panneau, cache
  panel.html           Panneau de réglages (embarqué dans l'exe)
  sea-config.json      Configuration de compilation en exe (Node SEA)
roblox-plugin/
  FigmaImporter.server.lua   Plugin Studio : construit les objets Roblox
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
| `POST` | `/push` | plugin Figma | Reçoit `{ name, tree, images }`, met les images en ligne, remplace les clés d'image par `rbxassetid://…`. Répond `{ ok, version, uploaded }`. |
| `GET` | `/latest` | plugin Studio | Dernier design : `{ version, name, tree, at }` (ou `{ version: 0 }` si rien). |
| `GET` | `/status` | panneau | État, clé masquée, IDs, cache, journal. |
| `POST` | `/config` | panneau | `{ apiKey?, userId? \| groupId? }`. |
| `POST` | `/test-key` | panneau | Vérifie la clé via `api-keys/v1/introspect`. |

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

`POST https://apis.roblox.com/assets/v1/assets` (multipart : `request` JSON + `fileContent` PNG,
`assetType: "Decal"`), puis interrogation de l'opération `GET /assets/v1/operations/{id}` jusqu'à
`done`. Chaque PNG est haché (SHA-256) : un contenu déjà envoyé n'est jamais renvoyé
(`%APPDATA%\FigmaRoblox\upload-cache.json`).

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
- Le dernier design n'est gardé **qu'en mémoire** : il faut renvoyer depuis Figma après avoir
  relancé l'exe.
- Plugin Figma en mode « développement » uniquement (pas publié sur la Communauté Figma).

**Idées d'évolution**

- Conversion de l'auto-layout en `UIListLayout` / `UIPadding`.
- Option « tailles en pourcentage » (`Scale`) au lieu des pixels.
- Mise à jour d'un ScreenGui existant au lieu d'en créer un nouveau.
- Boutons Figma → `TextButton` / `ImageButton` (par exemple via un préfixe de nom `btn_`).

---

## Licence

[MIT](LICENSE) — libre d'utilisation, de modification et de partage.
