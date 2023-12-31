`'use strict';`は、JavaScriptやTypeScriptのコード内で使用される特殊なディレクティブです。このディレクティブは、コードが厳密なモードで実行されるように指示します。

具体的には、`'use strict';`をコードの先頭に配置することで、以下のような効果があります：

1. 変数の宣言：変数を宣言する際に、必ず`var`、`let`、`const`キーワードを使用する必要があります。暗黙的なグローバル変数の作成を防ぎます。

2. 予約語の使用：予約語（`eval`、`arguments`など）を変数名として使用することができません。

3. 厳密なエラーチェック：エラーが発生する可能性のある操作（例：読み取り専用プロパティへの代入）を禁止します。

4. `this`の値：関数内での`this`の値が`undefined`ではなく、適切なオブジェクトを参照するようになります。

5. 静的なメソッド呼び出し：静的なメソッド呼び出し時に、そのメソッド内の`this`が`undefined`ではなく、クラス自体を参照するようになります。

`'use strict';`は、コード内で意図しないバグやエラーを防ぐために使用されます。TypeScriptでは、デフォルトで厳密モードが有効になっているため、通常は明示的に`'use strict';`を記述する必要はありません。ただし、JavaScriptの古いバージョンとの互換性を保つために使用されることもあります。

注意：`'use strict';`は、関数またはスクリプト全体に対して適用されます。したがって、このディレクティブを1つのファイルに追加すると、そのファイル内のすべてのコードが厳密モードで実行されることになります。