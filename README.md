# COVLint

`Coverity Connect`サーバーの特長の一つである問題のある行に指摘が付いたソースコード画面を`Visual Studio Code`上に実現しました。`Language Server Protocol`（言語サーバー）を利用していますので、言語サーバーの機能がある`Atom`、`Vim`や`Emacs`などのエディターで動作します（と言われていますが未確認です）。

- Coverity Connect ソースコード画面
  ![issue_Cov](./img/issue_Cov.jpg)

- COVLint ソースコード画面
  ![issue_VSC](./img/issue_VSC.jpg)

- COVLint ソースコード画面（指摘を複数表示）
  ![issue_vSC_3cids](./img/issue_VSC_3cids.jpg)

`COVLint`は、`Coverity`が解析したソースコードの指摘結果を `Visual Studio Code` に表示します。
指摘結果は、スクリプト`cov_snap`が取得したCSVファイルから読み込みます。
`cov_snap`は、`Coverity Connect` サーバーに登録されているソースコードの指摘内容を取得するスクリプトです。

## 実施手順

### 1. COVLint拡張機能のインストール

- アクティビティーバーから拡張機能を選択します
  ![activity_extension](./img/activity_extension.jpg)

- 3点メニューから「VSIXからインストール」を選択します
  ![install_from_vsix](./img/install_from_vsix.jpg)

- ファイル「covlint-0.0.1.vsix」をインストールします
  ![vsix_dialog](./img/vsix_dialog.jpg)

- インストール完了です
  ![vsix_installed](./img/vsix_installed.jpg)

- 拡張機能 `COVLint`
  ![covlint_extension](./img/covlint_extension.jpg)

### 2. CSVファイルの読み込み

`cov_snap`で取得したスナップショットCSVファイルを読み込みます

- VSCodeのエクスプローラーからスナップショットを保存しているフォルダに移動し、読み込みむスナップショットを**右クリック**で選択します（左クリックでファイルの中身を表示する必要はありません）
  ![1_select_csvfile](./img/1_select_csvfile.jpg)

- メニューから「パスのコピー」を選択します
  ![2_copy_path](./img/2_copy_path.jpg)

- `Ctrl` + `Shift` + `p`を押してコマンドパレットを開き、`COVLint: open CSV file`を選択します
  ![3_command_palette](./img/3_command_palette.jpg)

- 入力ボックスにコピーしたスナップショットCSVファイルのパスを貼り付けます
  ![4_input_csvfilepath](./img/4_input_csvfilepath.jpg)

- 何も入力しなかったときのメッセージです
  ![no_csvfile](./img/no_csvfile.jpg)

- 読み込みに成功したときのメッセージです
  ![5_file_opened](./img/5_file_opened.jpg)

- 読み込みに失敗したときはリトライしてください
  ![file_doesnt_exist](./img/file_doesnt_exist.jpg)


### 3. 指摘の表示

- フォルダを移動して開発中のソースコードを選択します
  ![6_targetfile_open](./img/6_targetfile_open.jpg)

- ソースコードの問題のある行に波線が入っているのでマウスオーバーします
  - 指摘がポップアップ表示されます
  - 問題パネルに指摘の一覧が表示されます
  - 問題を左クリックすると該当行にジャンプします
  ![7_hover](./img/7_hover.jpg)

## 備考

Microsoftの`https://github.com/Microsoft/vscode-extension-samples`にある`lsp-sample`や、[@Ikuyadeu](https://qiita.com/Ikuyadeu) 氏の記事 [Language Server Protocol開発チュートリアル](https://qiita.com/Ikuyadeu/items/98458f9ab760d09660ff) をベースにしましたので次の機能が残っています。

- コード検証機能
  - ３文字以上の大文字を検出します
- コード修正機能
  - 警告箇所を小文字に修正します

下図は`vscode-language-server-template Linter` README から。

![Usage](./usage.gif)

---
2023/09/15 嶋谷 初版
