# COVLint (in English)

`Coverity Connect` server has a feature that highlights problematic lines in the source code. This feature has been implemented in `Visual Studio Code`. By using the `Language Server Protocol`, it also works in editors like `Atom`, `Vim`, and `Emacs` that support the language server (though this hasn't been confirmed).

- Coverity Connect Source Code Screen
  ![issue_Cov](./img/0_1_issue_Cov_2.jpg)

- COVLint Source Code Screen
  ![issue_VSC](./img/0_2_issue_VSC_2.jpg)

- COVLint Source Code Screen (Multiple Highlights)
  ![issue_vSC_3cids](./img/0_3_issue_VSC_3cids.jpg)

`COVLint` displays the analysis results of the source code by `Coverity` in `Visual Studio Code`. The results are read from a CSV file obtained by the `cov_snap` script. `cov_snap` is a script that fetches the annotations of the source code registered on the `Coverity Connect` server.

## Procedure

### 1. Installing the COVLint Extension

There are two ways to install `COVLint`: from a VSIX package file or from the VSCode Extension Marketplace.

- Select extensions from the activity bar
  ![activity_extension](./img/1_1_activity_extension.jpg)

#### 1.1 Installation from VSIX Package File

- From the three-dot menu, select "Install from VSIX"
  ![install_from_vsix](./img/1_2_install_from_vsix.jpg)

- Install the file `covlint-X.Y.Z.vsix`
  ![vsix_dialog](./img/1_3_vsix_dialog.jpg)

- Installation is complete
  ![vsix_installed](./img/1_4_vsix_installed_2.jpg)

- `COVLint` Extension
  ![covlint_extension](./img/1_5_covlint_extension_2.jpg)

#### 1.2 Installation from VSCode Extension Marketplace

- Enter `covlint` in the search box and click "Install"
  ![1_6_install_from_extension](./img/1_6_install_from_extension_2.jpg)

- Installation is complete
  ![1_7_install_completed](./img/1_7_install_completed.jpg)

### 2. Loading the CSV File

Load the snapshot CSV file obtained with `cov_snap`.

- Move to the folder where the snapshot is saved from VSCode's explorer and **right-click** to select the snapshot (you don't need to display the contents of the file with a left click)
  ![1_select_csvfile](./img/2_1_select_csvfile_2.jpg)

- From the menu, select "Copy Path"
  ![2_copy_path](./img/2_2_copy_path_2.jpg)

- Press `Ctrl` + `Shift` + `p` to open the command palette and select `COVLint: open CSV file`
  ![3_command_palette](./img/2_3_command_palette_2.jpg)

- Paste the path of the copied snapshot CSV file into the input box
  ![4_input_csvfilepath](./img/2_4_input_csvfilepath_2.jpg)

- Message when no input is made
  ![no_csvfile](./img/2_5_no_csvfile.jpg)

- Message when loading is successful
  ![5_file_opened](./img/2_6_file_opened.jpg)

- If loading fails, please retry
  ![file_doesnt_exist](./img/2_7_file_doesnt_exist.jpg)

### 3. Displaying Annotations

- Move the folder and select the source code you are developing
  ![6_targetfile_open](./img/3_1_targetfile_open_2.jpg)

- Lines with issues in the source code are underlined, so hover over them
  - Annotations will be displayed in a popup
  - A list of annotations will be displayed in the problem panel
  - Clicking on an issue will jump to the corresponding line
  ![7_hover](./img/3_2_hover_2.jpg)

## Notes

This was based on Microsoft's `https://github.com/Microsoft/vscode-extension-samples` `lsp-sample` and an article by [@Ikuyadeu](https://qiita.com/Ikuyadeu) titled [Language Server Protocol Development Tutorial](https://qiita.com/Ikuyadeu/items/98458f9ab760d09660ff). 

---

- 2023/09/15 keides2 v0.0.1 First edition
- 2023/09/16 keides2 v0.0.2 Image replacement
- 2023/09/17 keides2 v0.0.3 Extension Marketplace support
- 2023/09/20 keides2 v0.1.0 webpack
- 2023/10/07 keides2 V0.2.0 Removed the uppercase character detection function for 3 or more characters.
  
---
# COVLint (in Japanese)

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

Microsoftの`https://github.com/Microsoft/vscode-extension-samples`にある`lsp-sample`や、[@Ikuyadeu](https://qiita.com/Ikuyadeu) 氏の記事 [Language Server Protocol開発チュートリアル](https://qiita.com/Ikuyadeu/items/98458f9ab760d09660ff) を参考にしました。


---

- 2023/09/15 keides2 v0.0.1 初版
- 2023/09/16 keides2 v0.0.2 図の差し替え
- 2023/09/17 keides2 v0.0.3 拡張機能マーケットプレース対応
- 2023/09/20 keides2 v0.1.0 webpack 対応。英文追加
- 2023/10/07 keides2 V0.2.0 ３文字以上の大文字検出をやめる
  