# Bibliothèque libre

Bibliothèque numérique **gratuite et open source** (PWA) : livres du domaine public ou sous licence libre en **français, arabe, kabyle (taqbaylit) et anglais**, avec liseuse intégrée, lecture à voix haute et traduction automatique **exécutée entièrement dans le navigateur**. Sans publicité, sans pistage, sans compte.

**Démo :** https://salimadour31-boop.github.io/bibliotheque-libre/

## Fonctionnalités (v1)

- **Catalogue** (`public/catalogue.json`) : titre, auteur, langue, écriture, année, couverture, résumé, thème, source, licence, lien d’origine. Recherche, filtres FR / AR / KAB / EN, filtre par thème, tri (titre, auteur, année, langue), vue par auteur.
- **Liseuse sans redirection** : taille et police (Noto Serif, Noto Sans, Noto Naskh Arabic, Noto Sans Tifinagh), thèmes clair / sépia / sombre, interligne, signets, reprise automatique de la lecture (localStorage). RTL complet pour l’arabe (direction détectée par paragraphe). Kabyle : latin par défaut, affichage en **tifinagh** ou **graphie arabe** par translittération automatique (approximative). Caractères ɛ ɣ ḥ ṭ ẓ č ǧ pris en charge par les polices.
- **Polices auto-hébergées** (paquets @fontsource intégrés au build) : aucune requête vers Google Fonts.
- **Lecture à voix haute** (Web Speech API) : phrase courante surlignée, lecture/pause/arrêt, phrase précédente/suivante, vitesse, hauteur, volume, minuterie de sommeil, bouton « Tester la voix ».
  - Découpage en phrases avec `Intl.Segmenter` (gère l'arabe ؟ ، ؛), morceaux ≤ 200 caractères (Chrome coupe les énoncés longs), suppression du tatweel, des signes coraniques et des caractères invisibles avant lecture.
  - Choix automatique de la meilleure voix de la langue (`ar`, `ar-SA`, `ar-EG`… ; priorité aux voix « Natural / Neural / Online / Google / Premium »), choix mémorisé par langue, autres voix proposées en repli.
  - Pause/reprise fiable sur tous les navigateurs (arrêt + reprise à la phrase en cours, au lieu de `speechSynthesis.pause()` peu fiable sur Android/iOS) ; minuteur de secours si l'événement de fin n'arrive pas.
  - Sans voix arabe sur l'appareil : message expliquant comment en installer une (Android, iPhone/iPad, Windows, macOS, Linux).
  - En vue bilingue, choix « lire l'original / la traduction ». Kabyle : voix française ou arabe de repli avec avertissement.
- **Traduction « Traduire ce livre »** avec Transformers.js, dans un Web Worker :
  - NLLB-200 distillé 600M (`Xenova/nllb-200-distilled-600M`, quantifié q8, **~900 Mo**) pour toutes les paires FR/AR/KAB/EN (`fra_Latn`, `arb_Arab`, `kab_Latn`, `eng_Latn`) ;
  - option légère Marian (`Xenova/opus-mt-fr-en` / `opus-mt-en-fr`, **~110 Mo**) pour FR↔EN.
  - En-têtes et licences (Project Gutenberg, « Source : … ») et lignes sans lettres ne sont pas traduits ; anti-répétitions (`repetition_penalty` 1,25, `no_repeat_ngram_size` 3, longueur de sortie limitée selon l'entrée, nettoyage des suites de ponctuation) ; lignes courtes d'un même paragraphe fusionnées.
  - Taille affichée avant téléchargement, progression, traitement par lots de paragraphes, sauvegarde de chaque lot dans IndexedDB (reprise après interruption), vue traduction seule / bilingue côte à côte, la synthèse vocale peut lire la traduction. Mention permanente : « Traduction automatique, qualité variable, surtout pour le kabyle ».
  - Le fichier WebAssembly d’onnxruntime est auto-hébergé (une seule copie dans `assets/`), les modèles sont téléchargés depuis Hugging Face puis gardés en cache par le navigateur. Le texte ne quitte jamais l’appareil.
- **PWA hors ligne** : manifeste, service worker, installable ; bouton « Télécharger pour lecture hors ligne » par livre.
- **Interface** en français, anglais, arabe (RTL) et kabyle.

## Livres (5 964 au 16/10/2026)

| Langue | Livres | Sources | Dépôt de données |
|---|---|---|---|
| Kabyle | 7 | Internet Archive (Hanoteau, Boulifa, Basset, Mouliéras, Luciani — ouvrages du XIXe s. bilingues kabyle/français, **OCR brut non corrigé**) | [bibliotheque-libre-data-kab](https://github.com/salimadour31-boop/bibliotheque-libre-data-kab) |
| Arabe | 1 023 | Wikisource arabe (auteurs morts ≤ 1955, vérifié sur Wikidata) | [bibliotheque-libre-data-ar](https://github.com/salimadour31-boop/bibliotheque-libre-data-ar) |
| Français | 2 489 | Project Gutenberg 2 488, Wikisource 1 | [bibliotheque-libre-data-fr](https://github.com/salimadour31-boop/bibliotheque-libre-data-fr) |
| Anglais | 2 445 | Project Gutenberg | [bibliotheque-libre-data-en](https://github.com/salimadour31-boop/bibliotheque-libre-data-en) |

Détail et licences : [SOURCES.md](SOURCES.md) et `SOURCES-<langue>.csv`. Historique : [journal.md](journal.md).

Le kabyle reste très peu couvert : seuls 7 ouvrages anciens au statut explicitement libre ont été trouvés, et ce sont surtout des grammaires/recueils bilingues dont l'OCR est médiocre.

## Architecture

- **Application** (ce dépôt, ~30 Mo publiés dont 27 Mo pour le moteur WebAssembly de traduction) : catalogue découpé en `public/catalogue/index.json` + `<langue>-<page>.json` (1 000 livres par page), chargé à la demande quand on choisit une langue ; affichage par pages de 48.
- **Textes** : 4 dépôts de données publiés sur GitHub Pages (`https://salimadour31-boop.github.io/bibliotheque-libre-data-<langue>/books/<id>.txt.gz`), compressés en gzip (≈ 3× plus petits) et décompressés dans le navigateur (`DecompressionStream`). Couvertures Gutenberg copiées localement dans les dépôts de données (aucune requête vers des tiers en dehors de GitHub Pages). Tailles : fr ≈ 460 Mo, en ≈ 700 Mo, ar ≈ 140 Mo, kab ≈ 1 Mo.
- **Hors ligne** : le bouton « Télécharger » met le fichier dans le cache du navigateur ; le lecteur lit d'abord ce cache.

## Ajouter des livres

```bash
# Project Gutenberg en masse (catalogue RDF officiel, filtré domaine public + auteurs morts ≤ 1955)
curl -LO https://www.gutenberg.org/cache/epub/feeds/rdf-files.tar.bz2
python3 scripts/gutenberg-parse-rdf.py && python3 scripts/gutenberg-select.py   # → selection.json
node scripts/bulk-gutenberg.mjs selection.json ../bibdata && node scripts/bulk-covers.mjs selection.json ../bibdata
# Wikisource (auteurs morts ≤ 1955 via Wikidata, traductions écartées)
node scripts/wikisource-authors.mjs ar 102 > ../bibdata/works-ar.json
node scripts/bulk-wikisource.mjs ar ../bibdata/works-ar.json ../bibdata 2000
# Ajouts manuels détaillés (Internet Archive, etc.)
node scripts/fetch-books.mjs scripts/batch-3-kab.json
# Compression, catalogue, puis commit/push des dépôts de données
node scripts/compress-data.mjs ../bibdata/data-fr ../bibdata/data-en ../bibdata/data-ar ../bibdata/data-kab
node scripts/build-catalogue.mjs ../bibdata
```

Les scripts limitent la cadence (3 à 4 requêtes simultanées, pauses), utilisent le cache CDN de gutenberg.org avec repli sur le miroir pglaf, et s'identifient par un User-Agent.

## Développement

```bash
npm install
npm run dev      # serveur de développement
npm run build    # build dans dist/
node scripts/test-translation.mjs   # test de traduction NLLB/Marian dans Node (télécharge ~1 Go)
```

Déploiement : GitHub Actions (`.github/workflows/pages.yml`) construit le site et le publie sur GitHub Pages à chaque push sur `main`.

## État des tests (honnête)

Tests du 16/10/2026, Chrome headless + Puppeteer, build de production (local puis site en ligne), textes servis par les dépôts de données GitHub Pages :

| Élément | État |
|---|---|
| `npm run build` | ✅ |
| Catalogue de 5 964 livres : chargement paginé par langue, filtres, recherche (titre/auteur prioritaires), tri, vue par auteur, bouton « Voir plus » | ✅ testé |
| Ouverture de livres depuis les dépôts de données (gzip décompressé dans le navigateur) : arabe, kabyle, français | ✅ testé |
| Livre arabe : 296 paragraphes affichés en RTL, police Noto Naskh Arabic | ✅ testé |
| Interface ar (RTL) / kab, thèmes, taille, signets, reprise de lecture | ✅ testé |
| Livre téléchargé puis relu hors ligne (Candide, 445 paragraphes, depuis le dépôt de données) | ✅ testé |
| Lecture à voix haute **arabe** — logique (voix simulées) : choix de la voix « Natural » ar-SA, énoncés en `ar-SA`, morceaux ≤ 200 caractères, sans tatweel, surlignage, pause puis reprise à la bonne phrase, message d'aide sans voix | ✅ testé avec un `speechSynthesis` **simulé** |
| Lecture à voix haute avec **son réel** (toutes langues) | ❌ **non testé** : aucune voix disponible dans Chrome sur la machine de test, même après installation de speech-dispatcher/espeak-ng |
| Traduction Marian FR→EN (Candide) | ✅ ~80 paragraphes, qualité correcte, plus de suites de points |
| Traduction NLLB FR→KAB (Candide) dans le navigateur | ✅ ~95 paragraphes, kabyle lisible mais approximatif |
| Traduction NLLB AR→FR (*al-Adab al-saghir*) dans le navigateur | ✅ ~60 paragraphes, sens général souvent rendu, contresens fréquents |
| Requêtes vers des CDN tiers depuis la page | ✅ aucune (seulement le site et GitHub Pages) ; requêtes du Web Worker vers Hugging Face pour les modèles (attendu) — l'absence de jsDelivr dans le worker n'a pas été vérifiée au niveau réseau |
| Installation PWA, navigateurs mobiles réels, Safari, Firefox, WebGPU | ❌ **non testé** |

## Synthèse vocale kabyle (MMS-TTS)

Recherche effectuée : `facebook/mms-tts-kab` existe (VITS, compatible en principe avec Transformers.js), mais (1) aucune version ONNX compatible Transformers.js n’est publiée (ni `Xenova/` ni `onnx-community/`), (2) la licence est **CC BY-NC 4.0** (non commerciale). Une conversion ONNX serait techniquement possible (export Optimum) mais n’a pas été faite ni testée en v1. **Non implémenté** : repli sur une voix française/arabe avec avertissement.

## Vie privée

Aucun cookie, aucune statistique, aucune publicité. Données locales uniquement (préférences, signets, positions dans localStorage ; traductions dans IndexedDB). Requêtes externes : seulement Hugging Face (téléchargement des modèles, uniquement si vous lancez une traduction).

## Licences

Code : [MIT](LICENSE). Textes : voir [SOURCES.md](SOURCES.md) (domaine public ; transcriptions Wikisource sous CC BY-SA 4.0 ; licence Project Gutenberg conservée dans chaque fichier).
