# Contribuer à WatchMe

Merci de l'intérêt porté au projet. Ce document décrit l'environnement de
développement, les vérifications à passer, et la procédure de release.

## Environnement

### Prérequis

- **Node.js ≥ 22.12.0** — le dépôt épingle `lts/jod` dans `.nvmrc`
- **npm ≥ 10**
- **macOS** pour un build complet : WatchMe ne publie aujourd'hui que des
  binaires macOS (voir *Plateformes* ci-dessous)

### Installation

```bash
git clone https://github.com/killerwolf/watchme.git
cd watchme
npm install
npm start
```

`npm run dev` lance la même application avec le drapeau `--dev`.

## Structure

```
watchme/
├── main.js              # Processus principal Electron : fenêtre, tray, IPC
├── preload.js           # Pont contextIsolation, canaux depuis ipc-channels.json
├── renderer.js          # Interface : liste des processus, filtres, notifications
├── index.html           # Fenêtre unique, CSP stricte, aucune ressource distante
├── monitoring.js        # Ensemble surveillé + boucle de sondage (sans DOM)
├── tray-status.js       # Badge et infobulle du tray (sans Electron)
├── ipc-channels.json    # Noms de canaux partagés entre main et preload
├── assets/              # Icônes applicatives et ressources de build
├── misc/                # Logo, gif de démo, son de notification, icône du tray
├── tools/               # Scripts de génération de ressources
├── test/                # Tests unitaires + harnais Electron
├── docs/agents/         # Conventions destinées aux agents
└── .github/workflows/   # CI et release
```

`monitoring.js` et `tray-status.js` sont volontairement dépourvus de toute
dépendance à Electron et au DOM : c'est ce qui permet de les exercer sous
`node --test` sans démarrer l'application.

## Scripts

| Script | Rôle |
| --- | --- |
| `npm start` | Lance l'application |
| `npm test` | Tests unitaires puis tests Electron |
| `npm run test:unit` | Tests unitaires seuls (`node --test`) |
| `npm run test:electron` | Tests nécessitant un runtime Electron |
| `npm run check` | Lint + format (Biome) |
| `npm run check:fix` | Corrige ce qui est corrigible automatiquement |
| `npm run pack` | Build sans installeur, pour vérification |
| `npm run verify:pack` | Vérifie l'application packagée |
| `npm run build:mac` | Produit les `.dmg` et `.zip` |

La CI exécute `lint`, `format:check`, `test`, `pack` et `verify:pack`. Lancer
`npm run check && npm test && npm run pack` en local couvre l'essentiel.

## Proposer un changement

1. Partir de `main`.
2. Écrire le changement, avec un test dès que le comportement est testable.
   Un comportement extractible hors d'Electron mérite son module testable.
3. Passer les vérifications ci-dessus.
4. Ajouter une entrée sous `## [Non publié]` dans `CHANGELOG.md` si le
   changement est visible par l'utilisateur. Décrire ce qui change **pour
   lui**, pas quels fichiers ont bougé.
5. Ouvrir une pull request en expliquant le pourquoi autant que le quoi.

Les issues vivent dans [GitHub Issues](https://github.com/killerwolf/watchme/issues)
et suivent les libellés `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`.

## Plateformes

`electron-builder` porte des cibles Windows (`nsis`, `portable`) et Linux
(`AppImage`, `deb`), mais le workflow de release ne construit que macOS. Ces
cibles ne sont donc **ni construites ni testées** en l'état. Une contribution
qui les active doit aussi les faire tourner en CI — le positionnement de la
fenêtre et le badge du tray comportent des branches spécifiques par plateforme
qui n'ont jamais été exécutées ailleurs que sur macOS.

## Publier une release

1. Déplacer les entrées de `## [Non publié]` sous une nouvelle section
   `## [X.Y.Z] - AAAA-MM-JJ`.
2. Aligner `version` dans `package.json` sur `X.Y.Z`.
3. Commiter, fusionner sur `main`.
4. Poser et pousser le tag :

   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```

5. Le workflow crée la release, en tire le corps depuis la section de
   `CHANGELOG.md` correspondante, construit macOS et y dépose les artefacts.

Un tag de préversion (`vX.Y.Z-rc.1`) publie en *pre-release* : `electron-updater`
les ignore par défaut, la préversion n'atteint donc pas les installations
existantes.

La release est créée **avant** le build, délibérément : electron-builder lance
un publieur par architecture en parallèle, et sans release préexistante le
second reçoit un `422 already_exists` qui fait échouer ses mises en ligne.

## Code de conduite

Le projet suit le [Contributor Covenant](CODE_OF_CONDUCT.md).
