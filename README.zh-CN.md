# 潮汐战线（Tidemark）

[English](README.md)

*Where the tide leaves its mark.*

经典 SLG 回合制战棋：造兵、占城、推司令部，陆海空三军同场。这是它在 [DSH 游戏商店](https://dsh-game-store.com)里的游戏包，npm 包名 `dsh-game-tidemark`。

## 怎么玩到

在 DeepSeek Harness 里装好游戏商店（`dsh-game-store`），在商店里找到《潮汐战线》，点“安装”，再点“开始游戏”。

## 这个仓库里有什么

| 位置 | 是什么 |
| --- | --- |
| `game.json` | 游戏清单：名字、介绍、入口、图片、语言、操作方式 |
| `store/` | 商店里展示的内容：图标、封面、截图、游戏说明 |
| `scripts/pack.mjs` | 打包脚本：从游戏的工作目录拷贝运行所需的文件 |
| `scripts/shots.cjs` | 从打包好的游戏里截封面和截图 |
| `game/`、`manual/` | 打包生成的游戏本体和手册（不进 git） |

## 打包

```bash
node scripts/pack.mjs --tarball
```

脚本只读游戏的工作目录（默认 `/Users/admin/Documents/Codex/writing/2026-11-12-steel-tide-tactics`，用 `--source` 或环境变量 `TIDEMARK_SOURCE` 换），每次都从头重建 `game/` 和 `manual/`，可以随时重跑。它做这些事：

1. 拷贝 `index.html`、根目录的各个 `.js`、图标，以及 `maps/`、`i18n/`、`fonts/`、`cg/`、`ui-assets/`、`mods/`，再加上 `index.html` 里引用到的其他文件夹。素材源文件（各处的 `src/`）、备份和文档留在原地。
2. 核对 `index.html` 引用的每个脚本都拷到了。
3. 把手册的 HTML 拷成 `manual/index.html`。加 `--no-manual` 可以不带手册（手册约 55 MB）。
4. 把游戏的 `apple-touch-icon.png` 拷成商店图标。
5. 按商店规范检查整个包（需要旁边有 `dsh-game-store` 仓库）。
6. 加 `--tarball` 时运行 `npm pack`，打印 tarball 的大小和校验值。

重新截封面和截图（一次只开一个无头 Chrome）：

```bash
node scripts/shots.cjs
```

## 发布新版本

1. 改 `package.json` 的 `version`。
2. `node scripts/pack.mjs --tarball`
3. `npm publish`
4. 在 `dsh-game-store` 仓库里更新 `catalog/games/tidemark.json` 的 `version` 和 `integrity`（`npx dsh-game-store entry dsh-game-tidemark@<版本>` 会打印出来），提 Pull Request。

## 许可证

见 [LICENSE.md](LICENSE.md)。游戏字体是 Fusion Pixel Font，按 SIL Open Font License 1.1 使用。
