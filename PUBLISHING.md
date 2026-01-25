# VS Code Marketplace への公開手順

このドキュメントでは、COVLint拡張機能をVS Code Marketplaceに公開する手順を説明します。

## 前提条件

- Node.js と npm がインストールされていること
- `@vscode/vsce` がインストールされていること（`npm install -g @vscode/vsce`）
- VS Code Marketplace の Publisher アカウント（keides2）が作成済みであること

## 公開手順

### 1. バージョン番号の更新

`package.json` のバージョン番号を更新します。

```json
{
  "version": "0.4.1"  // 例: 0.4.0 → 0.4.1
}
```

バージョニングルール：
- **パッチバージョン**: ドキュメント更新、バグ修正（例: 0.4.0 → 0.4.1）
- **マイナーバージョン**: 新機能追加（例: 0.4.1 → 0.5.0）
- **メジャーバージョン**: 破壊的変更（例: 0.5.0 → 1.0.0）

### 2. CHANGELOG の更新

`CHANGELOG.md` に新しいバージョンのエントリを追加します。

```markdown
## v0.4.1

- 2026/01/25 keides2 v0.4.1 Updated README documentation.
- 2026/01/25 keides2 v0.4.1 READMEドキュメントを更新
```

エントリには以下を含めます：
- バージョン番号
- 日付
- 変更内容（英語と日本語の併記）

### 3. 変更を GitHub にプッシュ

変更をコミットしてGitHubリポジトリにプッシュします。

```powershell
git add CHANGELOG.md package.json
git commit -m "[リリース] バージョン0.4.1に更新 (Bump version to 0.4.1)"
git push
```

コミットメッセージのルール：
- 日本語と英語を併記
- 形式: `[種別] 日本語要約 (English summary)`

### 4. 拡張機能をパッケージ化

`vsce package` コマンドを実行して、`.vsix` ファイルを生成します。

```powershell
cd c:\Users\HP\Docs\Security\cov_lint
vsce package
```

実行結果の例：
```
DONE  Packaged: C:\Users\HP\Docs\Security\cov_lint\covlint-0.4.1.vsix (68 files, 10.16MB)
```

このコマンドにより、`covlint-<version>.vsix` ファイルがプロジェクトルートに作成されます。

### 5. VS Code Marketplace に手動アップロード

Personal Access Token (PAT) が期限切れの場合は、手動アップロードを行います。

#### 手順：

1. ブラウザで https://marketplace.visualstudio.com/manage/publishers/keides2 にアクセス
2. サインインしていない場合は、Microsoftアカウントでサインイン
3. 「Extensions」タブを選択
4. 更新する拡張機能（**COVLint**）をクリック
5. 右上の「**...**」（3つの点）メニューをクリック
6. 「**Update**」を選択
7. ローカルに作成した `.vsix` ファイル（例: `covlint-0.4.1.vsix`）を選択してアップロード
8. アップロードが完了するまで待機

### 6. 公開の確認

アップロードが完了すると、Marketplaceでの検証プロセスが開始されます。

- 検証には数分から数時間かかる場合があります
- 公開状況は https://marketplace.visualstudio.com/items?itemName=keides2.covlint で確認できます
- READMEの更新内容が反映されているか確認します

## トラブルシューティング

### Personal Access Token (PAT) が期限切れの場合

`vsce publish` コマンドでエラーが発生する場合は、PATが期限切れの可能性があります。

```
ERROR  Access Denied: The Personal Access Token used has expired.
```

この場合は、上記の手動アップロード手順を使用してください。

### 新しいPATを作成する場合（オプション）

1. https://dev.azure.com/ にアクセス
2. ユーザーアイコン → **Personal access tokens** を選択
3. **+ New Token** をクリック
4. 設定内容：
   - **Name**: VS Code Extension Publishing（任意）
   - **Organization**: All accessible organizations
   - **Expiration**: 1年など
   - **Scopes**: **Marketplace** → **Manage** にチェック
5. トークンをコピーして保存
6. コマンドラインで設定：
   ```powershell
   vsce login keides2
   # PATを入力
   ```

### Azure ADの認証エラーが発生する場合

サインイン時に以下のようなエラーが発生することがあります：

```
Error code: access_denied
AADSTS90123: The token can't be issued...
```

対処法：
- ブラウザのキャッシュをクリア
- プライベート/シークレットモードで試行
- 別のブラウザを使用
- 手動アップロード方式を使用（推奨）

## 参考リンク

- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI Reference](https://github.com/microsoft/vscode-vsce)
- [Marketplace Management Portal](https://marketplace.visualstudio.com/manage/publishers/keides2)
- [COVLint on Marketplace](https://marketplace.visualstudio.com/items?itemName=keides2.covlint)
