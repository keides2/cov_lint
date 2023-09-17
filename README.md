# COVLint

`Coverity Connect`サーバーの特長の一つである問題のある行に指摘が付いたソースコード画面を`Visual Studio Code`上に実現しました。`Language Server Protocol`（言語サーバー）を利用していますので、言語サーバーの機能がある`Atom`、`Vim`や`Emacs`などのエディターで動作します（と言われていますが未確認です）。

- Coverity Connect ソースコード画面
  ![issue_Cov](./img/0_1_issue_Cov_2.jpg)

- COVLint ソースコード画面
  ![issue_VSC](./img/0_2_issue_VSC_2.jpg)

- COVLint ソースコード画面（指摘を複数表示）
  ![issue_vSC_3cids](./img/0_3_issue_VSC_3cids.jpg)

`COVLint`は、`Coverity`が解析したソースコードの指摘結果を `Visual Studio Code` に表示します。
指摘結果は、スクリプト`cov_snap`が取得したCSVファイルから読み込みます。
`cov_snap`は、`Coverity Connect` サーバーに登録されているソースコードの指摘内容を取得するスクリプトです。

## 実施手順

### 1. COVLint拡張機能のインストール

`COVLint`は、VSIXパッケージファイルからインストールする方法と、VSCode拡張機能マーケットプレースからインストールする方法があります。

- アクティビティーバーから拡張機能を選択します
  ![activity_extension](./img/1_1_activity_extension.jpg)

#### 1.1 VSIXパッケージファイルからのインストール

- 3点メニューから「VSIXからインストール」を選択します
  ![install_from_vsix](./img/1_2_install_from_vsix.jpg)

- ファイル「covlint-X.Y.Z.vsix」をインストールします
  ![vsix_dialog](./img/1_3_vsix_dialog.jpg)

- インストール完了です
  ![vsix_installed](./img/1_4_vsix_installed_2.jpg)

- 拡張機能 `COVLint`
  ![covlint_extension](./img/1_5_covlint_extension_2.jpg)

#### 1.2 VSCode拡張機能マーケットプレースからのインストール

- 検索窓に`covlint`を入力し、「インストール」を押下げます
  ![1_6_install_from_extension](./img/1_6_install_from_extension_2.jpg)

- インストール完了です
  ![1_7_install_completed](./img/1_7_install_completed.jpg)

### 2. CSVファイルの読み込み

`cov_snap`で取得したスナップショットCSVファイルを読み込みます

- VSCodeのエクスプローラーからスナップショットを保存しているフォルダに移動し、読み込みむスナップショットを**右クリック**で選択します（左クリックでファイルの中身を表示する必要はありません）
  ![1_select_csvfile](./img/2_1_select_csvfile_2.jpg)

- メニューから「パスのコピー」を選択します
  ![2_copy_path](./img/2_2_copy_path_2.jpg)

- `Ctrl` + `Shift` + `p`を押してコマンドパレットを開き、`COVLint: open CSV file`を選択します
  ![3_command_palette](./img/2_3_command_palette_2.jpg)

- 入力ボックスにコピーしたスナップショットCSVファイルのパスを貼り付けます
  ![4_input_csvfilepath](./img/2_4_input_csvfilepath_2.jpg)

- 何も入力しなかったときのメッセージです
  ![no_csvfile](./img/2_5_no_csvfile.jpg)

- 読み込みに成功したときのメッセージです
  ![5_file_opened](./img/2_6_file_opened.jpg)

- 読み込みに失敗したときはリトライしてください
  ![file_doesnt_exist](./img/2_7_file_doesnt_exist.jpg)


### 3. 指摘の表示

- フォルダを移動して開発中のソースコードを選択します
  ![6_targetfile_open](./img/3_1_targetfile_open_2.jpg)

- ソースコードの問題のある行に波線が入っているのでマウスオーバーします
  - 指摘がポップアップ表示されます
  - 問題パネルに指摘の一覧が表示されます
  - 問題を左クリックすると該当行にジャンプします
  ![7_hover](./img/3_2_hover_2.jpg)

## 備考

Microsoftの`https://github.com/Microsoft/vscode-extension-samples`にある`lsp-sample`や、[@Ikuyadeu](https://qiita.com/Ikuyadeu) 氏の記事 [Language Server Protocol開発チュートリアル](https://qiita.com/Ikuyadeu/items/98458f9ab760d09660ff) をベースにしましたので次の機能が残っています。

- コード検証機能
  - ３文字以上の大文字を検出します
- コード修正機能
  - 警告箇所を小文字に修正します

下図は`vscode-language-server-template Linter` README から。

![Usage](./usage.gif)

---

- 2023/09/15 keides2 v0.0.1 初版
- 2023/09/16 keides2 v0.0.2 図の差し替え
- 2023/09/17 keides2 v0.0.3 拡張機能マーケットプレース対応
