# Release preflight / リリース前チェック

## Required package contents / パッケージに必要な要素

The VSIX package must contain these runtime files:

- `extension/package.json`
- `extension/client/out/extension.js`
- `extension/server/out/server.js`
- `extension/README.md`
- `extension/CHANGELOG.md`
- `extension/LICENSE.txt`
- `extension/img/COVLint.jpg`

VSIX には、実行時に必要な上記ファイルが必ず含まれている必要がある。

The extension manifest must contain:

- `main`: `./client/out/extension`
- `activationEvents`: `onCommand:covlint.activate`
- `activationEvents`: `onLanguage:plaintext`
- contributed command: `covlint.activate`

拡張機能の manifest には、上記の `main`、activation event、コマンド定義が必要である。

Runtime dependencies must be either:

- bundled into `client/out/extension.js` or `server/out/server.js` by webpack, or
- included under `extension/node_modules/`.

実行時依存は、webpack で `client/out/extension.js` または `server/out/server.js` にバンドルするか、`extension/node_modules/` に含める必要がある。
This project is configured to ship webpacked JavaScript and not ship `node_modules`.

## Required commands / 必須コマンド

Run these commands before publishing:

```powershell
npm.cmd run compile
npm.cmd run webpack
npx.cmd vsce package
npm.cmd run check:vsix -- covlint-0.4.3.vsix
```

公開前には必ず上記を実行する。

`npm run check:vsix` validates the generated VSIX by checking:

- required files are present
- `activationEvents` includes `onCommand:covlint.activate`
- `covlint.activate` is contributed
- root package version and VSIX manifest version match
- bundled JavaScript has no unresolved non-built-in `require(...)`
- source files under `client/src` and `server/src` are not packaged

`npm run check:vsix` は、生成済み VSIX に対して上記の内容を検査する。

## Manual smoke test / 手動スモークテスト

After installing the VSIX, start VS Code without opening a text file and run:

```text
COVLint: open CSV file
```

The command must open the CSV file input box. It must not show:

```text
command 'covlint.activate' not found
```

VSIX インストール後、テキストファイルを開かない状態で `COVLint: open CSV file` を実行し、CSV ファイル入力欄が開くことを確認する。
