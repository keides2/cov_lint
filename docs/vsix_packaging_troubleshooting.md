# VSIX packaging troubleshooting / VSIX パッケージングのトラブルシュート

作成日: 2026-06-04
更新日: 2026-06-05
作成: CODEX

Created: 2026-06-04
Updated: 2026-06-05
Author: CODEX

## 2026-06-04 phenomenon / 2026-06-04 の現象

生成した VSIX をインストールして `COVLint: open CSV file` を実行すると、拡張機能が Language Server の起動に失敗した。クライアント側のコードは、サーバーのエントリポイントとして次のファイルを参照していた。

```text
server/out/server.js
```

しかし、パッケージされた拡張機能の中にこのファイルが含まれていなかったため、Language Client がサーバープロセスを起動できなかった。

After installing the generated VSIX and running `COVLint: open CSV file`, the extension failed to start the language server. The client expected:

```text
server/out/server.js
```

However, the packaged extension did not contain that file, so the language client could not launch the server process.

## 2026-06-04 root cause / 2026-06-04 の根本原因

`.vscodeignore` のサーバー出力用 allow-list が、古いテンプレート由来のファイル名のままになっていた。

```text
!server/out/eslintServer.js
```

このプロジェクトで実際に生成され、クライアント側から読み込まれるファイルは次のファイルである。

```text
server/out/server.js
```

`.vscodeignore` では先に `server/out/*` でサーバー出力全体を除外し、その後 allow-list に書いたファイルだけを再度含める。そのため、allow-list に存在しない `server/out/server.js` は VSIX から除外されていた。

The `.vscodeignore` allow-list for packaged server output was still using the old template file name:

```text
!server/out/eslintServer.js
```

This project generates and loads:

```text
server/out/server.js
```

Because `.vscodeignore` first excludes `server/out/*` and then re-includes only the allow-listed file, `server/out/server.js` was excluded from the VSIX.

## 2026-06-04 countermeasure / 2026-06-04 の対策

`.vscodeignore` のサーバー出力 allow-list を、実際に生成されるエントリポイントに合わせた。

```text
!server/out/server.js
```

The server allow-list in `.vscodeignore` was updated to match the real generated entry point:

```text
!server/out/server.js
```

## 2026-06-05 recurrence / 2026-06-05 の再発

v0.4.2 では `server/out/server.js` の VSIX 同梱漏れは修正された。しかし、VS Code 起動直後など、テキストファイルを開く前に `COVLint: open CSV file` を実行すると、次のエラーが再発した。

```text
command 'covlint.activate' not found
```

v0.4.2 の `extension/package.json` は次の activation event しか持っていなかった。

```json
"activationEvents": [
  "onLanguage:plaintext"
]
```

この状態では、`plaintext` として認識されるファイルを開くまで拡張機能が activate されない場合がある。`covlint.activate` のコマンド登録は `client/src/extension.ts` の `activate()` 内で実行されるため、activate 前にコマンドを実行すると VS Code 側には `covlint.activate` が存在せず、`command not found` になる。

In v0.4.2, the missing `server/out/server.js` packaging issue was fixed. However, running `COVLint: open CSV file` before opening a plaintext file could still fail with:

```text
command 'covlint.activate' not found
```

The v0.4.2 manifest only had `onLanguage:plaintext`. Because the command is registered inside `activate()`, VS Code could try to run `covlint.activate` before the extension had registered it.

## Defect in the previous fix / 前回対応の不備

前回対応では、VSIX に `server/out/server.js` が含まれていない明確なパッケージング不良を見つけたため、それを唯一の根本原因と判断した。

しかし実際には、独立した不具合が 2 つ存在していた。

```text
1. VSIX に server/out/server.js が含まれていない
2. command 実行時に activate する activationEvents が不足している
```

前回は 1 だけを修正し、2 を不要変更として戻したことが不備だった。また、`.vscodeignore` は webpack 済みの JS だけを同梱する設計なのに、`vscode:prepublish` が `tsc` のみで webpack を実行していなかったため、`client/out/extension.js` に `vscode-languageclient/node` の外部 `require(...)` が残る可能性も見落としていた。

The previous fix treated the missing `server/out/server.js` file as the only root cause. That was incomplete. There were two independent issues:

```text
1. server/out/server.js was not included in the VSIX.
2. The extension did not explicitly activate on the covlint.activate command.
```

Only the first issue was fixed in v0.4.2. The second issue was mistakenly reverted as unnecessary. The previous process also missed that `.vscodeignore` expects webpacked JavaScript, while `vscode:prepublish` only ran `tsc`, which could leave unresolved runtime `require(...)` calls such as `vscode-languageclient/node`.

## v0.4.3 fix / v0.4.3 での修正

v0.4.3 では、`package.json` を次のように修正した。

```json
"activationEvents": [
  "onCommand:covlint.activate",
  "onLanguage:plaintext"
]
```

これにより、`COVLint: open CSV file` を実行したタイミングで拡張機能が activate され、`commands.registerCommand('covlint.activate', ...)` が実行される。

また、VSIX 作成前に必ず webpack を実行するようにした。

```json
"vscode:prepublish": "npm run compile && npm run webpack"
```

The v0.4.3 fix explicitly activates the extension when `covlint.activate` is invoked, and ensures webpack runs before packaging.

## Prevention / 再発防止

VSIX 作成後、必ず次の検査コマンドを実行する。

```powershell
npm.cmd run check:vsix -- covlint-0.4.3.vsix
```

この検査では、少なくとも次を確認する。

- `extension/package.json` が存在する
- `extension/client/out/extension.js` が存在する
- `extension/server/out/server.js` が存在する
- `activationEvents` に `onCommand:covlint.activate` が含まれる
- `contributes.commands` に `covlint.activate` が含まれる
- root `package.json` と VSIX 内 manifest の version が一致する
- `client/out/extension.js` と `server/out/server.js` に未解決の非組み込み `require(...)` が残っていない
- `client/src`、`server/src`、`scripts` などの開発用ファイルが VSIX に混入していない

The release process must run:

```powershell
npm.cmd run compile
npm.cmd run webpack
npx.cmd vsce package
npm.cmd run check:vsix -- covlint-0.4.3.vsix
```

加えて、VSIX をインストールした直後にテキストファイルを開かず、`COVLint: open CSV file` を実行して CSV 入力欄が開くことを手動確認する。

After installing the VSIX, manually confirm that `COVLint: open CSV file` works even before opening a plaintext file.
