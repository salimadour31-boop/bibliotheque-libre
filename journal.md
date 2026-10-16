# Journal

## 2026-10-16 — v1

### Livres ajoutés (22)
- **Kabyle (2)** — Internet Archive : Hanoteau, *Poésies populaires de la Kabylie du Jurjura* (1867, numérisation Gallica/BnF) ; Hanoteau, *Essai de grammaire kabyle* (éd. 1906). OCR brut, bilingue kab/fr.
- **Arabe (7)** — Wikisource ar : كليلة ودمنة، الأدب الصغير، حي بن يقظان، معلقة امرئ القيس، رسالة التوابع والزوابع، طوق الحمامة، رسالة الغفران.
- **Français (7)** — Gutenberg : Candide, Les Fleurs du mal, Le Tour du monde en 80 jours, Discours de la méthode, En Kabylie (Vilbort), Contes de Perrault ; Wikisource fr : Contes populaires d’Afrique (Basset).
- **Anglais (6)** — Gutenberg : Alice, Frankenstein, Sonnets de Shakespeare, Moorish Literature (Basset, contes berbères/kabyles), Pride and Prejudice, Hamlet.

### Recherches / écartés
- Wikisource kabyle : pas de sous-domaine `kab` ; Wikisource multilingue ne contient que 2 poèmes kabyles du XXe siècle sans statut clair → écartés.
- Rivière, *Contes populaires de la Kabylie du Djurdjura* (1882) : date de décès du traducteur non vérifiée → retiré par prudence.
- MMS-TTS kabyle : pas d’ONNX publié, licence CC BY-NC → non intégré.

### Bugs corrigés pendant la v1
- Script de récupération bloqué indéfiniment sur Gutendex → délai d’expiration de 90 s + repli direct sur gutenberg.org (métadonnées du lot, statut vérifié au préalable).
- Noms de fichiers en caractères arabes → identifiants ASCII (`ws-ar-<pageid>`).
- Restes de wikitexte (catégories `[[…]]`, « نزل نسخة مطبوعة ») et URL encodées dans les en-têtes → nettoyés.
- Sélecteur de vue visible malgré `hidden` (conflit CSS) → règle `[hidden]{display:none!important}`.
- En-tête français d’un livre arabe affiché à droite → direction `auto` par paragraphe.
- Découpage des phrases coupait les URL → coupure seulement si ponctuation suivie d’un espace.
- `idbGet` renvoyait l’objet requête au lieu de `undefined` → la traduction plantait au premier lancement.
- Traductions non affichées pendant la première traduction et non restaurées après rechargement (langue/modèle oubliés) → corrigé.

### Résultats des tests de traduction
- Node, NLLB q8, une phrase par paire (voir `scripts/test-translation-result.txt`) : FR→EN, EN→FR, KAB→FR, KAB→AR corrects ; FR→KAB, EN→KAB, AR→KAB approximatifs ; **AR→EN : charabia** ; EN→AR : répétition (« بدأت بدأت »). 2 à 5 s par phrase sur CPU.
- Navigateur (Chrome headless, WASM) : Marian FR→EN 36 paragraphes OK ; NLLB FR→KAB 4 paragraphes OK mais hallucinations répétitives sur les lignes très courtes (titres de l’en-tête Gutenberg).

### Prochaines étapes
- Trouver des textes kabyles au statut clair (Boulifa 1904 ? Ben Sedira 1887 ? contes de Mouliéras 1893-1897, en vérifiant l’OCR) et les corriger à la main.
- Ajouter Standard Ebooks, Open Library (liens de lecture uniquement si texte libre), Hindawi (vérifier la licence au cas par cas).
- Ignorer l’en-tête/licence Gutenberg lors de la traduction ; limiter les répétitions (`no_repeat_ngram_size`, `repetition_penalty`).
- Tester sur Android/iOS réels, avec de vraies voix ; essayer WebGPU.
- Conversion ONNX de MMS-TTS kab (usage non commercial) et test dans Transformers.js.
- Faire relire l’interface kabyle par des locuteurs natifs.

## 2026-10-16 (soir) — v2 : passage à ~6 000 livres, lecture arabe et voix

### Livres
- **Total 5 964** : kabyle 7, arabe 1 023, français 2 489, anglais 2 445 (voir SOURCES.md et SOURCES-*.csv).
- Kabyle (Internet Archive, statut explicite NOT_IN_COPYRIGHT ou Public Domain Mark + auteur mort < 1956) : Hanoteau *Poésies populaires* (scan Google, remplace l'ancienne copie sans statut explicite) et *Grammaire kabyle*, Boulifa *Une première année de langue kabyle*, Luciani *Chansons de Smaïl Azikkiou*, Basset *Manuel de langue kabyle* et *Loqmân berbère*, Mouliéras *Les fourberies de Si Djeh'a*.
- Arabe : 729 auteurs de Wikisource morts ≤ 1955 (Wikidata P570) → 5 220 liens → 2 635 candidats après filtrage (redirections, homonymies, traducteur mentionné) → 1 023 œuvres retenues.
- FR/EN : catalogue RDF officiel de Gutenberg, « Public domain in the USA » + tous auteurs morts ≤ 1955, 2 500 plus téléchargés par langue, doublons retirés.
- Retirés : Perrault pg-20972 (c'était le texte d'un livre audio, mal encodé), pg-59023 (encodage cassé).

### Architecture
- Textes déplacés dans 4 dépôts de données (GitHub Pages), compressés en gzip, décompressés dans le navigateur. Catalogue découpé par langue/page, chargé à la demande.

### Corrections
- **Lecture arabe** : découpage des phrases avec Intl.Segmenter (avant : ponctuation latine seulement, phrases arabes trop longues coupées par Chrome) ; énoncés ≤ 200 caractères ; `lang` = langue de la voix ou `ar-SA` ; voix `ar-*` reconnues ; attente asynchrone des voix ; tatweel/signes coraniques retirés ; pause/reprise fiable ; message d'installation de voix ; voix mémorisée par langue ; meilleures voix en premier ; lecture de la traduction en vue bilingue.
- **Traduction de l'arabe** : un filtre « lignes sans lettres » utilisait `\W`, qui considère les lettres arabes comme non-lettres → tous les paragraphes arabes étaient ignorés (traduction « terminée » immédiatement). Corrigé avec `\p{L}`.
- Traduction : en-têtes/licences ignorés, anti-répétitions, sortie limitée, nettoyage de ponctuation.
- Une seule copie du WASM onnxruntime (site 102 Mo → 30 Mo).
- Recherche : résultats titre/auteur avant résumé ; affichage paginé.
- Service worker : rechargement automatique quand une nouvelle version est déployée (sinon l'ancienne version restait en cache au premier chargement).
- Script Gutenberg : délai d'expiration, détection d'encodage (UTF-8 sinon Windows-1252).

### Tests de traduction (navigateur, Chrome headless, WASM)
- Marian FR→EN : correct. NLLB FR→KAB : lisible, approximatif. NLLB AR→FR : sens général, contresens fréquents.

### Prochaines étapes
- Trouver/corriger des textes kabyles (relecture humaine de l'OCR, textes Mouliéras *Légendes et contes merveilleux*).
- Tester sur de vrais téléphones avec de vraies voix (Android Google TTS, iOS).
- Ajouter le reste des livres FR éligibles (≈ 1 000) dans un second dépôt, Standard Ebooks, Wikisource fr/en.
- Résumés en français pour les livres Gutenberg (actuellement résumés automatiques en anglais de Gutenberg, ou vides).
