# Changelog

Toutes les évolutions notables de WatchMe sont consignées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et le projet respecte le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

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

- Le son de notification pointe sur un fichier absent du dépôt. La promesse
  rejetée est désormais rattrapée, mais la fonctionnalité reste muette alors
  que le README l'annonce. (#17)
- L'application livrée porte l'icône générique d'Electron. (#31)
- Le tray et le titre de fenêtre affichent encore « Script Watcher ». (#18)
- `ps-list` reste en 8.x : la majeure ne corrige aucune vulnérabilité et
  toucherait l'affichage des processus. (#16)
