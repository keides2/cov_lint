import * as path from 'path';
import { TextDecoder } from 'util';
import {
	ExtensionContext,
	window,
	Uri,
	commands,
	workspace,
	TextEditor,
	DecorationOptions,
	Position,
	Range
} from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	RevealOutputChannelOn,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import axios from 'axios';


// 拡張機能が有効になったときに呼ばれる
export function activate(context: ExtensionContext): void {
	// 拡張機能起動
	console.log('My extension "covlint" is now active!');

	// 右クリックからのコンテキストメニューにリファクタリング・コマンドを追加し実行（ChatGPTに依頼）
	let disposable = commands.registerCommand('covlint.refactoring', async () => {
		// APIキーを取得
		const configuration = workspace.getConfiguration('covlint');
		const apiKey = configuration.get('apiKey');
		if (!apiKey) {
			void window.showInformationMessage('APIKeyが設定されていません。拡張機能からAPI Keyを設定してください。');
			return;
		}
		const editor = window.activeTextEditor;
		if (editor) {
			// 全テキストを取得
			const document = editor.document;
			const text = document.getText();
			console.log('text', text);

			//　ChatGPTの初期化メッセージ
			console.log('start chatgpt');
			void window.showInformationMessage('ChatGPTにリファクタリングを依頼します');
			const apiEndpoint = 'https://api.openai.com/v1/chat/completions';
			const prompt = `
				以下のソースコードに対してリファクタリングをお願いします。
				処理効率やバグの少なさ、可読性、サイクロマチック複雑度を考慮してください。
				修正内容は記載不要です。
				本文だけ返却してください。
				本文以外を返却する場合はコメントアウトしてください。
    			${text}
			`;
			try {
				const requestBody = {
					'model': 'gpt-3.5-turbo',
					'messages': [{
						'role': 'user',
						'content': prompt
					}],
					'temperature': 0.7
				};
				const header = {
					// eslint-disable-next-line @typescript-eslint/naming-convention
					Authorization: `Bearer ${apiKey}`,
					// eslint-disable-next-line @typescript-eslint/naming-convention
					'Content-Type': 'application/json'
				};
				void window.showInformationMessage('ChatGPTによるリファクタリング実行中です');

				const data = await axios.post(apiEndpoint, requestBody, { headers: header });
				const refactoredText = data.data.choices[0].message.content;

				void window.showInformationMessage('ChatGPTによるリファクタリングが完了しました');
				console.log(data.data.choices);

				const refactoredDocument = await workspace.openTextDocument({ language: 'plaintext', content: refactoredText });
				// const refactoredEditor = await window.showTextDocument(document);
				await window.showTextDocument(document);

				// 2画面で差分表示
				await commands.executeCommand('vscode.diff', document.uri, refactoredDocument.uri);

			} catch (e) {
				console.error(e);
				void window.showInformationMessage('ChatGPTにエラーが発生しました。APIキーが適切に設定されているか確認してください');
			}
		}
	});

	// コマンド 'covlint.snapshot' を登録
	const snapshotCommand = commands.registerCommand('covlint.snapshot', async () => {
		// コマンドの実装
		const inputString = await window.showInputBox({
			prompt: 'Enter snapshotID',
			validateInput: (value: string): string | undefined => (!value) ? "You must input some number!" : undefined
		});

		if (inputString) {
			const snapshotID = inputString;
			window.showInformationMessage(`Snapshot ID is ${snapshotID}`);

			const csvFileName = `${snapshotID}.csv`;

			// カレントワークスペースのURIを取得
			// const workspaceFolders = [workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd()];
			// const rootFolderPath = workspaceFolders ? Uri.file(workspaceFolders[0]).fsPath : undefined;
			// const workspaceUri = rootFolderPath ? Uri.file(rootFolderPath) : Uri.file(process.cwd());

			// カレントワークスペースのURIとファイル名を結合してファイルのURIを作成
			// const csvUri = Uri.joinPath(workspaceUri, csvFileName);

			// 既定ディレクトリの取得
			const uri = Uri.file("/Users/shimatani/Documents/GitHub/keides2/extension/cov_lint");
			// const uri = Uri.file(".");

			// 規定ディレクトリとファイル名を結合
			const csvUri = Uri.joinPath(uri, csvFileName);
			//const csvUri = uri.with({ path: `${uri.path}/${csvFileName}` });
			commands.executeCommand('vscode.open', csvUri);
		}
	});


	// ドキュメント（CSVファイル）が開かれた時のイベントを登録
	const onDocumentOpen = workspace.onDidOpenTextDocument(async (document) => {
		if (document.fileName.endsWith('.c')) {
			const csvContentBuffer = await workspace.fs.readFile(document.uri); // ファイル内容をバッファとして読み込む
			const csvContent = new TextDecoder('shift_jis').decode(csvContentBuffer); // SHIFT_JISでデコードされた文字列に変換

			// CSVファイルの行ごとのデータを取得
			const lines = csvContent.split('\n');

			// CSVファイル名を取得
			const openedCsvFileName = path.basename(document.fileName);

			// 開かれたCSVファイルの行番号を取得
			const openedFileStartLine = document.lineAt(0).lineNumber;

			// 現在開いている編集中のテキストエディターを取得
			const activeTextEditor = window.activeTextEditor;

			if (!activeTextEditor) {
				return; // アクティブなテキストエディターが存在しない場合は処理を終了
			}

			if (activeTextEditor.document !== document) {
				// アクティブなテキストエディターが異なるファイルを編集している場合に実行されるブロック。
				// `executeUnderlineCommand` 関数を呼び出し、下線コマンドを実行します。
				// 以下の引数を渡しています:
				// - activeTextEditor: アクティブなテキストエディター
				// - document.fileName: 現在開かれているドキュメント（CSVファイル）のファイル名
				// - openedFileStartLine: 開かれたCSVファイルの先頭行番号
				// - lines: CSVファイルの行ごとのデータ
				executeUnderlineCommand(activeTextEditor, document.fileName, openedFileStartLine, lines);

			}
		}
	});


	// 波線のスタイルを定義
	const wavyLineDecorationType = window.createTextEditorDecorationType({
		textDecoration: 'underline wavy red'
	});

	// 編集中のファイルに波線を引く処理
	function executeUnderlineCommand(activeEditor: TextEditor, activeFileName: string, openedFileStartLine: number, lines: string[]) {
		const document = activeEditor.document;

		// 波線を引く処理の実装
		const lineCount = document.lineCount;
		const decorationRanges: DecorationOptions[] = [];

		for (let line = 0; line < lineCount; line++) {
			const text = document.lineAt(line).text;

			// ファイルに波線を引く条件を追加する
			// if (text.includes('TODO')) {
			// ファイル名と行番号を取得する
			const csvFileName = lines[line + openedFileStartLine].split(',')[1]; // CSVファイルの列columns[1]がファイル名を表すと仮定しています
			const lineNumber = parseInt(lines[line + openedFileStartLine].split(',')[5]); // CSVファイルの列columns[5]が行番号を表すと仮定しています

			// 現在のファイル名とCSVファイルのファイル名が一致し、行番号が該当行の範囲内にある場合に波線を引く
			if (activeFileName === csvFileName && lineNumber >= activeEditor.selection.start.line + 1 && lineNumber <= activeEditor.selection.end.line + 1) {
				const startPosition = new Position(line, 0);
				const endPosition = new Position(line, text.length);
				const range = new Range(startPosition, endPosition);

				decorationRanges.push({ range });
			}
			// }
		}

		activeEditor.setDecorations(wavyLineDecorationType, decorationRanges);
	}


	// コンテキストにコマンドとイベントを登録
	// context.subscriptions.push(snapshotCommand, onDocumentOpen);
	//context.subscriptions.push(snapshotCommand);

	// サーバーのパスを取得
	const serverModule = Uri.joinPath(context.extensionUri, 'server', 'out', 'server.js').fsPath;

	// デバッグ時の設定
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6011'], cwd: process.cwd() };

	// サーバーの設定
	const serverOptions: ServerOptions = {
		run: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: { cwd: process.cwd() }
		},
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions,
		},
	};
	// LSPとの通信に使うリクエストを定義
	const clientOptions: LanguageClientOptions = {
		// 対象とするファイルの種類や拡張子
		documentSelector: [
			{ scheme: 'file' },
			{ scheme: 'untitled' }
		],
		// 警告パネルでの表示名
		diagnosticCollectionName: 'covlint',
		revealOutputChannelOn: RevealOutputChannelOn.Never,
		initializationOptions: {},
		progressOnInitialization: true,
	};

	let client: LanguageClient;
	try {
		// LSPを起動
		client = new LanguageClient(
			// 拡張機能のID
			'CSVLintLSPServerandClient',
			// ユーザ向けの名前（出力ペインで使用されます）
			'CSVLint LSP Server and Client',
			serverOptions,
			clientOptions
		);

		client.sendRequest

	} catch (err) {
		void window.showErrorMessage('拡張機能の起動に失敗しました。詳細はアウトプットパネルを参照ください');
		return;

	}

	// コンテキストに拡張機能のコマンドとイベントを登録
	context.subscriptions.push(
		snapshotCommand,
		onDocumentOpen,
		disposable,
	);
}
