# Tidemark (潮汐前线)

[中文](README.zh-CN.md)

*Where the tide leaves its mark.*

Classic turn-based strategy: build, capture and push the front on land, sea and air. This is the game's package for the [DSH Game Store](https://dsh-game-store.com), published on npm as `dsh-game-tidemark`.

## How to play it

Install the Game Store (`dsh-game-store`) in DeepSeek Harness, find Tidemark in the store, click Install, then Play.

## What is in this repository

| Where | What |
| --- | --- |
| `game.json` | The game manifest: name, summary, entry, pictures, languages, controls |
| `store/` | What the store shows: icon, cover, screenshots, description |
| `scripts/pack.mjs` | Builds the package from the game's working folder |
| `scripts/shots.cjs` | Takes the cover and screenshots from the packed game |
| `game/`, `manual/` | The packed game and manual (generated, not in git) |

## Build the package

```bash
node scripts/pack.mjs --tarball
```

The script only reads the game's working folder (set it with `--source` or `TIDEMARK_SOURCE`) and rebuilds `game/` and `manual/` from scratch, so it is safe to run at any time. It copies the files the game needs to run, confirms every script `index.html` names was copied, adds the manual (skip it with `--no-manual`), checks the package against the store spec, and with `--tarball` runs `npm pack` and prints the checksum.

## License

See [LICENSE.md](LICENSE.md). The game font is Fusion Pixel Font, used under the SIL Open Font License 1.1.
