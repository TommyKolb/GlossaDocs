# Third-Party Notices

## CC-CEDICT

GlossaDocs includes Chinese pinyin candidate data derived from CC-CEDICT:

- Source: [CC-CEDICT](https://cc-cedict.org/)
- License: [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/) (CC BY-SA 4.0)

The generated dictionary file at `src/app/data/chinese-pinyin-dictionary.generated.ts` is produced by `scripts/generate-chinese-pinyin-dictionary.mjs`. The generator downloads CC-CEDICT, parses dictionary entries, normalizes pinyin, caps candidates per pinyin key, and applies lightweight ranking heuristics for GlossaDocs' starter pinyin input.

The generated dictionary data and modifications to that CC-CEDICT-derived data are distributed under CC BY-SA 4.0. GlossaDocs application code is separate from this dictionary data unless otherwise stated by a repository-level license.

CC-CEDICT and the generated dictionary data are provided as-is, without warranties. See the CC BY-SA 4.0 license text for full terms.
