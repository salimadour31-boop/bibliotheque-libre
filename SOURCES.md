# Sources et licences des livres

**5964 livres** au 2026-10-16 : kabyle 7, arabe 1023, français 2489, anglais 2445.

La liste complète, livre par livre (identifiant, titre, auteur, source, licence, lien d'origine, fichier), est générée automatiquement :
[SOURCES-kab.csv](SOURCES-kab.csv) · [SOURCES-ar.csv](SOURCES-ar.csv) · [SOURCES-fr.csv](SOURCES-fr.csv) · [SOURCES-en.csv](SOURCES-en.csv).
Chaque fichier texte conserve aussi en tête sa source et sa licence.

| Langue | Livres | Sources |
|---|---|---|
| Kabyle | 7 | Internet Archive 7 |
| Arabe | 1023 | Wikisource 1023 |
| Français | 2489 | Project Gutenberg 2488, Wikisource 1 |
| Anglais | 2445 | Project Gutenberg 2445 |

## Codes de licence (colonne « licence » des CSV)

- `pg` — Project Gutenberg, marqué « Public domain in the USA » dans le catalogue RDF officiel **et** tous les auteurs morts au plus tard en 1955 (donc aussi domaine public en France et en Algérie). En-tête et licence Project Gutenberg conservés intégralement dans le fichier.
- `ws` — Wikisource : œuvre d'un auteur mort au plus tard en 1955 (date de décès vérifiée sur Wikidata, propriété P570) ; transcription Wikisource sous licence CC BY-SA 4.0 (attribution : contributeurs de Wikisource, lien dans le CSV et l'en-tête). Les pages mentionnant un **traducteur** sont écartées (une traduction moderne peut être protégée).
- `ia-nic` — Internet Archive, statut explicite « NOT_IN_COPYRIGHT », publication ancienne, auteur mort avant 1956.
- `ia-pdm` — Internet Archive, Public Domain Mark explicite, publication ancienne, auteur mort avant 1956.

## Règles et exclusions

- En cas de doute, le livre n'est pas ajouté. Les marques « domaine public » d'Internet Archive ne suffisent pas seules (beaucoup d'ouvrages récents sont mal étiquetés) : on exige aussi une publication ancienne et un auteur mort avant 1956.
- Écartés : *Contes populaires de la Kabylie du Djurdjura* (Rivière, 1882 — date de décès non vérifiée) ; dictionnaires de G. Huyghe (date de décès non vérifiée) ; *Cours de langue kabyle* de Ben Sedira sur Internet Archive (aucun statut explicite) ; poèmes kabyles du XXe siècle de Wikisource multilingue ; traductions kabyles modernes (Coran, Bible, Petit Prince…) ; Hindawi (licence non vérifiée au cas par cas).
- Wikisource arabe : 2 635 œuvres candidates d'auteurs morts ≤ 1955 ; 1023 retenues, les autres écartées (redirections, pages de sommaire trop courtes, mention d'un traducteur, erreurs). Les œuvres très longues sont tronquées aux 40 premières sous-pages et marquées « partiel ».
- Project Gutenberg FR/EN : les 2 500 livres les plus téléchargés parmi les éligibles de chaque langue (3 525 éligibles en français, 39 083 en anglais), doublons d'éditions retirés.
