# Changelog

Toutes les évolutions notables de WatchMe sont consignées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et le projet respecte le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Modifié

- **Le README dit maintenant ce que l'application fait et pour qui.** Une
  section « Is this the right tool? » nomme explicitement ce que WatchMe ne
  fait pas — pas de métriques, pas de kill — et le tableau de bord d'activité
  qui le fait. Le téléchargement et l'avertissement Gatekeeper du premier
  lancement remontent en haut de page : une application non signée affiche
  « damaged and can't be opened », ce que la plupart des gens lisent comme un
  malware plutôt que comme l'absence d'un abonnement à 99 $/an.
- La description du paquet et les images du README ne mentionnent plus
  Windows ni Linux, que la release ne produit pas.

### Ajouté

- `CONTRIBUTING.md` et `CODE_OF_CONDUCT.md`.
- Une carte de prévisualisation sociale (`.github/assets/social-preview.png`).
  Jusqu'ici, tout lien vers le dépôt collé dans Slack ou ailleurs s'affichait
  en texte gris.

### Supprimé

- La documentation ne part plus dans l'application packagée. `README.md`,
  `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CLAUDE.md`,
  `docs/` et `.npmcheckrc` étaient embarqués dans l'`asar` : ils ne servent
  à rien à l'exécution. Même raisonnement que pour le gif de démonstration
  en 0.11.0. (#12)

### Corrigé

- **Le nom du produit dans l'interface.** Le titre de fenêtre et l'infobulle
  du tray annonçaient encore « Script Watcher », le nom d'avant. Deux
  surfaces vues à chaque lancement, portant un nom qui n'existe nulle part
  ailleurs. (#18)

## [0.11.1] - 2026-08-21

Version de tuyauterie : **le binaire est fonctionnellement identique à la
v0.11.0**. Elle acte la refonte de la publication et sert de première release
du nouveau chemin.

### Modifié

- La release est désormais publiée par **electron-builder** lui-même, et non
  plus par un job séparé qui retéléchargeait les artefacts pour les reposter.
  Un job de moins, et surtout la génération des `latest-mac.yml` et `.blockmap`
  dont `electron-updater` aura besoin le jour où l'on voudra la mise à jour
  automatique. Aligne WatchMe sur le workflow de QuickToss. (#49)
- Le corps de la release est alimenté depuis ce fichier, avec repli sur les
  notes générées par GitHub à défaut de section correspondante.
- Un tag de préversion (`v0.11.1-rc.1`) publie désormais en *pre-release*, que
  `electron-updater` ignore par défaut.
- `rimraf` monte en 6.x, les actions GitHub en v7.

### Corrigé

- **Course à la création de la release.** electron-builder lance un publieur
  par architecture, en parallèle : les deux tentaient de créer la release en
  même temps et le perdant recevait un `422 already_exists` qui faisait échouer
  toutes ses mises en ligne. Constaté sur `v0.11.1-rc.1` — 1 fichier publié sur
  8. La release est maintenant créée avant le build, il n'y a plus rien à
  courir.

## [0.11.0] - 2026-08-21

### Ajouté

- **Le son de notification existe enfin.** `renderer.js` référençait un
  `notification-sound.mp3` absent du dépôt : la fonctionnalité annoncée par le
  README n'a jamais émis un son. Remplacé par une courte fanfare de fin de
  style Super Nintendo, générée par `tools/build-notification-sound.mjs`
  (`npm run sound:build`) et livrée en WAV — lu nativement par Chromium, sans
  dépendance à un codec. (#17)
- **L'application a sa propre icône.** Elle portait celle d'Electron par
  défaut, `mac.icon` n'étant pas déclaré — et `assets/icon.png` ne contenait
  pas le logo WatchMe mais une icône générique sans rapport. Nouvelle icône
  dessinée en SVG à partir de l'œil du logo, dans la palette de l'interface.
  `assets/icon.svg` est la source, `npm run icon:build` en produit le PNG.
  (#31)

### Modifié

- `verify:pack` couvre désormais l'icône de l'application et la présence du
  son dans l'asar, en plus de l'icône du tray.

## [0.10.0] - 2026-08-21

Ce lot est une reprise de maintenance après onze mois sans commit. Il a été
mené sous une contrainte explicite : **ne modifier aucune fonctionnalité
existante**. Deux exceptions assumées, toutes deux des corrections de bugs
détaillées plus bas — l'icône du tray et le fonctionnement hors-ligne.

### Sécurité

- Correction d'une injection DOM : le nom d'un processus, contrôlable par
  n'importe quel processus local, était interpolé dans `innerHTML` lors des
  notifications de repli. Remplacé par une construction DOM. (#6)
- Suppression de `@electron/remote`, activé sur la fenêtre mais utilisé nulle
  part. Le module perçait l'isolation de contexte sans contrepartie. (#5)
- Suppression de la dépendance au CDN cdnjs et ajout d'une
  `Content-Security-Policy`. (#7)

### Corrigé

- **L'icône du tray était invisible dans l'application packagée.** La clé
  `extraResources` sortait `misc/` de l'`app.asar`, alors que `main.js` l'y
  cherche via `__dirname` ; `nativeImage` renvoyait une image 0×0. Le bug
  n'apparaissait pas en développement, où `__dirname` est la racine du dépôt.
  Le dock étant masqué, le tray est le seul point d'entrée de l'app. (#12)
- **L'application était cassée hors-ligne** : les icônes venaient d'un CDN.
  Elles sont désormais des SVG inline. (#7)
- Double publication de release : sur un push de tag, `electron-builder`
  basculait seul sur la politique `onTag` et publiait les artefacts, en
  doublon du job `release`. Corrigé par `--publish never` sur le build. (#9)

### Ajouté

- Filet de tests de non-régression, là où le job CI s'appelait « Test and
  Lint » sans qu'aucun test n'existe : contrat de `ps-list`, harness Electron
  rejouant les APIs de `main.js`, démarrage de l'application réelle, et
  vérification de l'artefact packagé. (#4, #12)
- Dependabot, hebdomadaire sur npm et mensuel sur les GitHub Actions. Les
  majeures de `ps-list` et `electron-store` en sont exclues : elles touchent
  respectivement l'affichage des processus et la persistance des préférences,
  et méritent une évaluation manuelle. (#13)
- Ce fichier.

### Modifié

- Migration d'ESLint + Prettier vers Biome 2.5.9, finalisant la branche
  `feature/maj` restée en plan. (#8)
- Nettoyage du workflow de release : étapes Linux jamais exécutées, globs
  d'artefacts sans objet, `secrets.GH_TOKEN` remplacé par le `GITHUB_TOKEN`
  intégré, filtre de PR corrigé. (#9)
- L'application livrée n'embarque plus les fichiers de développement
  (`test/`, `.psd`, configuration), ni le gif de démonstration de 1,4 Mo qui
  ne sert qu'au README. (#12)
- Métadonnées `package.json` : `version` alignée sur le dernier tag, licence
  déclarée sous une forme SPDX valide. (#11)

### Supprimé

- Contrôles de fenêtre morts (HTML commenté, CSS, listeners, API preload et
  handler IPC), IPC fantôme `update-monitored-processes`, et double demande
  de permission de notification. (#10)

### Connu, non traité

- Le tray et le titre de fenêtre affichent encore « Script Watcher ». (#18)
- `ps-list` reste en 8.x : la majeure ne corrige aucune vulnérabilité et
  toucherait l'affichage des processus. (#16)
