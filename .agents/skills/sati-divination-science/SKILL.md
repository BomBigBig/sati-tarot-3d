---
name: sati-divination-science
description: Authentic Rider-Waite / Golden Dawn Book T tarot methodology and Thai Thaksa planetary pair engine architecture for `src/engine/divinationScience.js` inside `sati-project`.
---

# SATI Divination Science Skill

Project-scoped methodology and runtime reference for `src/engine/divinationScience.js`, shared by both `src/engine/satiBrain.js` (client/offline synthesis) and `backend/geminiProxyServer.js` (Question-First Gemini prompt assembly).

## 1. Zero-DOM & Dependency Boundaries

- `src/engine/divinationScience.js` is a **pure zero-DOM ES module** importing ONLY from `../data/tarot78I18n.js` (never import `three`, `satiBrain.js`, or `geminiProxyServer.js` to avoid circular dependencies and heavy runtime coupling).
- Strict **zero Unicode emojis** in all code, comments, and localized strings (`th`, `en`, `zh`).

## 2. Golden Dawn Positional Elemental Dignity

- All 78 cards resolve to `'fire' | 'water' | 'air' | 'earth'` via `resolveCardElement(card)` using `card.gd.gdElement` (including all 22 Major Arcana, not just Minor suits).
- Polarities: Active (`fire`, `air`) vs Passive (`water`, `earth`).
- Adjacent Pair Rules (`classifyElementPair`):
  - `identical` (`+2`): same element amplifies intensity.
  - `friendly` (`+1`): `fire <-> air` or `water <-> earth` support each other harmoniously.
  - `contrary` (`-1`): `fire <-> water` or `air <-> earth` weaken/create active friction.
  - `neutral` (`0`): `fire <-> earth` or `air <-> water` act as neutral foils.
- Triad Center Modulation (`analyzePositionalElementalDignity`):
  - Evaluates adjacent pairs and triad centers (`C0-C1-C2`, or focal Celtic Cross axes `[0,1]`, `[2,0,4]`, `[3,0,5]`, `[5,6,9]` when `cards.length >= 10`).
  - Identifies `doubly_well_dignified`, `doubly_ill_dignified`, `flanking_cancelled` (contrary flanks neutralize each other, leaving center card independent), and `mixed_dignity`.
  - Preserves exact substrings `'ไฟ+ลม'` (`th`), `'Fire + Air'` (`en`), and `'火风相生'` (`zh`) on active Fire+Air spreads for `SC-06-01` / `SC-09-02` compatibility.

## 3. 36 Decans, Modalities & Timing Mechanics

- `DECAN_36_METADATA` maps all 36 pips (`2..10`) to their Golden Dawn `(zodiac, decan 1-3, planet)`, exact tropical calendar windows aligned with `computeExtendedNatalContext` cusps, zodiac modality (`cardinal` fast onset, `fixed` enduring/slow, `mutable` shifting), and authentic planetary-sign nuances.
- `getDecanTimingProfile(card, { lang, referenceDate })` computes `paceTier` (`immediate | short | medium | slow | conditional`), checks `isCurrentDecanWindow`, and applies constructive reversal delay (`isDelayedByReversal`).

## 4. Card-Pair / Triad Causal Dynamics, Court Roles & 4-Lens Reversals

- `diagnoseReversedCard` selects **one** best constructive lens (`blocked | internalized | delayed | excessive`) from spread position, category/rank, suit/element, card tone, and contrary neighbor friction — never fatalistic doom.
- `analyzeSpreadCausalDynamics` distinguishes Major Arcana structural anchors from Pip tactical friction, classifies Court cards (`other_person | needed_stance | querent_trait`) from `questionProfile` + spread position, and traces the causal narrative trajectory (`rising_recovery | late_check | sustained_drive | compounding_strain | pivot_crossroads | single_focus`).

## 5. Shared Thai Planetary Pairs & Domain-Targeted Thaksa

- `THAI_PLANET_NUMBERS` (`1..8`: sun..rahu) and `THAI_PLANET_STRENGTHS` (`6, 15, 8, 17, 19, 21, 10, 12`).
- `THAI_PLANET_PAIRS` models all 4 classical relationships symmetrically (`friend`: `1-5, 2-4, 3-6, 7-8`; `enemy`: `1-3, 2-5, 4-8, 6-7`; `element`: `1-7, 2-5, 3-8, 4-6`; `somphon`: `1-6, 2-8, 3-5, 4-7`), preserving the dual `['element', 'enemy']` tag on Moon-Jupiter (`2-5`).
- `selectDomainThaksaFocus` selects 2-3 domain-relevant annual Thaksa houses (`DOMAIN_THAKSA_TARGETS`), gates `kalakini` notes by domain/card caution, keeps `compactPromptBlock <= 300` chars with isolated `|`-delimited `ศรีจร=` and `กาลกิณีจร=` segments (`SC-09-01`), and emits `shortOfflineClause <= 110` chars for `<550`-char offline synthesis.
