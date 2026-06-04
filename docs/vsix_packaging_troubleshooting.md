# VSIX packaging troubleshooting / VSIX パッケージングのトラブルシュート

## Phenomenon / 現象

生成した VSIX をインストールして `COVLint: open CSV file` を実行すると、拡張機能が Language Server の起動に失敗した。
クライアント側のコードは、サーバーのエントリポイントとして次のファイルを参照している。

```text
server/out/server.js
```

しかし、パッケージされた拡張機能の中にこのファイルが含まれていなかったため、Language Client がサーバープロセスを起動できなかった。

After installing the generated VSIX and running `COVLint: open CSV file`, the extension failed to start the language server.
The client code expected the server entry point at:

```text
server/out/server.js
```

However, the packaged extension did not contain that file, so the language client could not launch the server process.

## Root cause / 根本原因

`.vscodeignore` のサーバー出力用 allow-list が、古いテンプレート由来のファイル名のままになっていた。

```text
!server/out/eslintServer.js
```

このプロジェクトで実際に生成され、クライアント側から読み込まれるファイルは次のファイルである。

```text
server/out/server.js
```

`.vscodeignore` では先に `server/out/*` でサーバー出力全体を除外し、その後 allow-list に書いたファイルだけを再度含める。そのため、allow-list に存在しない `server/out/server.js` は VSIX から除外されていた。

これが本当の原因であり、`package.json` の activation event 変更や `client/src/extension.ts` の変更は、この不具合を直すためには不要だった。

The `.vscodeignore` allow-list for packaged server output was still using the old template file name:

```text
!server/out/eslintServer.js
```

This project generates and loads:

```text
server/out/server.js
```

Because `.vscodeignore` first excludes `server/out/*` and then re-includes only the allow-listed file, `server/out/server.js` was excluded from the VSIX. This was the actual cause. The activation event and client-side source changes were not required to fix this failure.

## Countermeasure / 対策

`.vscodeignore` のサーバー出力 allow-list を、実際に生成されるエントリポイントに合わせる。

```text
!server/out/server.js
```

同じ問題を確認する場合は、生成した VSIX の内容を確認し、少なくとも次の 2 ファイルが含まれていることを確認する。

```text
client/out/extension.js
server/out/server.js
```

Update `.vscodeignore` so the server allow-list matches the real generated entry point:

```text
!server/out/server.js
```

When checking this issue again, inspect the generated VSIX contents and confirm that both files are included:

```text
client/out/extension.js
server/out/server.js
```
