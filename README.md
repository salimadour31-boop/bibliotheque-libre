# Bibliothèque libre

Bibliothèque numérique **gratuite et open source** (PWA) : livres du domaine public ou sous licence libre en **français, arabe, kabyle (taqbaylit) et anglais**, avec liseuse intégrée, lecture à voix haute et traduction automatique **exécutée entièrement dans le navigateur**. Sans publicité, sans pistage, sans compte.

**Démo :** https://salimadour31-boop.github.io/bibliotheque-libre/

## Fonctionnalités (v1)

- **Catalogue** (`public/catalogue.json`) : titre, auteur, langue, écriture, année, couverture, résumé, thème, source, licence, lien d’origine. Recherche, filtres FR / AR / KAB / EN, filtre par thème, tri (titre, auteur, année, langue), vue par auteur.
- **Liseuse sans redirection** : taille et police (Noto Serif, Noto Sans, Noto Naskh Arabic, Noto Sans Tifinagh), thèmes clair / sépia / sombre, interligne, signets, reprise automatique de la lecture (localStorage). RTL complet pour l’arabe (direction détectée par paragraphe). Kabyle : latin par défaut, affichage en **tifinagh** ou **graphie arabe** par translittération automatique (approximative). Caractères ɛ ɣ ḥ ṭ ẓ č ǧ pris en charge par les polices.
- **Polices auto-hébergées** (paquets @fontsource intégrés au build) : aucune requête vers Google Fonts.
- **Lecture à voix haute** (Web Speech API) : phrase courante surlignée, lecture/pause/arrêt, phrase précédente/suivante, choix de voix, vitesse, hauteur, volume, minuterie de sommeil. Pour le kabyle : voix française ou arabe de repli, avec avertissement « prononciation approximative ».
- **Traduction « Traduire ce livre »** avec Transformers.js, dans un Web Worker :
  - NLLB-200 distillé 600M (`Xenova/nllb-200-distilled-600M`, quantifié q8, **~900 Mo**) pour toutes les paires FR/AR/KAB/EN (`fra_Latn`, `arb_Arab`, `kab_Latn`, `eng_Latn`) ;
  - option légère Marian (`Xenova/opus-mt-fr-en` / `opus-mt-en-fr`, **~110 Mo**) pour FR↔EN.
  - Taille affichée avant téléchargement, progression, traitement par lots de paragraphes, sauvegarde de chaque lot dans IndexedDB (reprise après interruption), vue traduction seule / bilingue côte à côte, la synthèse vocale peut lire la traduction. Mention permanente : « Traduction automatique, qualité variable, surtout pour le kabyle ».
  - Les fichiers WebAssembly d’onnxruntime sont auto-hébergés (`/ort`), les modèles sont téléchargés depuis Hugging Face puis gardés en cache par le navigateur. Le texte ne quitte jamais l’appareil.
- **PWA hors ligne** : manifeste, service worker, installable ; bouton « Télécharger pour lecture hors ligne » par livre.
- **Interface** en français, anglais, arabe (RTL) et kabyle.

## Livres (lot 1 : 22 livres)

| Langue | Nombre | Sources |
|---|---|---|
| Kabyle | 2 | Internet Archive (A. Hanoteau, 1867 et 1906 — ouvrages bilingues kabyle/français, **OCR brut non corrigé**) |
| Arabe | 7 | Wikisource arabe (Ibn al-Muqaffa’, Ibn Tufayl, Imru’ al-Qays, Ibn Shuhayd, Ibn Hazm, al-Ma’arri) |
| Français | 7 | Project Gutenberg (6), Wikisource fr (1) |
| Anglais | 6 | Project Gutenberg |

Détail, licences et liens : [SOURCES.md](SOURCES.md). Historique : [journal.md](journal.md).

Le kabyle reste la langue la moins couverte : aucun texte kabyle moderne au statut juridique clair n’a été trouvé pour l’instant ; les deux ouvrages retenus sont des recueils du XIXe siècle dont l’OCR est de mauvaise qualité (orthographe ancienne, passages en graphie arabe illisibles).

## Ajouter des livres

```bash
npm install
node scripts/fetch-books.mjs scripts/batch-2.json    # lot JSON : gutenberg (id), wikisource (lang + title), ia (identifiant)
```

Le script télécharge les textes, les nettoie (UTF-8, normalisation NFC), conserve l’en-tête de licence, refuse les livres Gutenberg non marqués domaine public et met à jour `public/catalogue.json`. Ajoutez ensuite les entrées correspondantes dans `SOURCES.md`.

## Développement

```bash
npm install
npm run dev      # serveur de développement
npm run build    # build dans dist/ (copie aussi les fichiers WASM d’onnxruntime dans public/ort)
node scripts/test-translation.mjs   # test de traduction NLLB/Marian dans Node (télécharge ~1 Go)
```

Déploiement : GitHub Actions (`.github/workflows/pages.yml`) construit le site et le publie sur GitHub Pages à chaque push sur `main`.

## État des tests (honnête)

Testé sur la machine de build le 16/10/2026 (Chrome headless + Puppeteer, build de production servi par `vite preview`) :

| Élément | État |
|---|---|
| `npm run build` | ✅ OK |
| Chargement du catalogue, 22 cartes, filtres langue, recherche, tri, vue par auteur | ✅ testé (headless) |
| Interface en arabe (`dir="rtl"`) et en kabyle | ✅ testé, capture d’écran vérifiée |
| Liseuse : paragraphes arabes en RTL avec Noto Naskh Arabic | ✅ testé (direction calculée = rtl), capture vérifiée |
| Thème sombre/sépia, taille de police, signet, sauvegarde de position | ✅ testé (headless) |
| Translittération tifinagh affichée avec Noto Sans Tifinagh | ✅ testé (capture) ; exactitude de la translittération **non vérifiée par un locuteur** |
| Service worker actif, livre téléchargé puis relu **hors ligne** | ✅ testé (mode hors ligne de Chrome) |
| Installation PWA sur téléphone | ❌ **non testé** (l’événement d’installation se déclenche dans Chrome headless) |
| Lecture à voix haute | ⚠️ **non testé avec du son** : Chrome headless n’a aucune voix ; seuls l’interface, le message « aucune voix » et le surlignage de phrase (bouton suivant) ont été vérifiés |
| Voix kabyle de repli + avertissement | ❌ non testé (pas de voix disponible) |
| Traduction Marian FR→EN **dans le navigateur** | ✅ testé : modèle téléchargé, 36 paragraphes traduits, reprise après rechargement depuis IndexedDB |
| Traduction NLLB FR→KAB **dans le navigateur** (WASM) | ✅ testé sur 4 paragraphes (modèle ~900 Mo téléchargé dans Chrome headless) ; qualité médiocre sur les lignes courtes (répétitions) |
| NLLB, 12 paires FR/AR/KAB/EN, une phrase chacune, dans Node | ✅ testé — résultats dans `scripts/test-translation-result.txt` ; AR→EN a produit du charabia, AR→KAB et FR→KAB approximatifs |
| WebGPU | ❌ non utilisé/non testé (WASM uniquement en v1) |
| Navigateurs mobiles réels (Android/iOS), Safari, Firefox | ❌ **non testé** |

## Synthèse vocale kabyle (MMS-TTS)

Recherche effectuée : `facebook/mms-tts-kab` existe (VITS, compatible en principe avec Transformers.js), mais (1) aucune version ONNX compatible Transformers.js n’est publiée (ni `Xenova/` ni `onnx-community/`), (2) la licence est **CC BY-NC 4.0** (non commerciale). Une conversion ONNX serait techniquement possible (export Optimum) mais n’a pas été faite ni testée en v1. **Non implémenté** : repli sur une voix française/arabe avec avertissement.

## Vie privée

Aucun cookie, aucune statistique, aucune publicité. Données locales uniquement (préférences, signets, positions dans localStorage ; traductions dans IndexedDB). Requêtes externes : seulement Hugging Face (téléchargement des modèles, uniquement si vous lancez une traduction).

## Licences

Code : [MIT](LICENSE). Textes : voir [SOURCES.md](SOURCES.md) (domaine public ; transcriptions Wikisource sous CC BY-SA 4.0 ; licence Project Gutenberg conservée dans chaque fichier).
