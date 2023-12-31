import * as path from 'path';
import {
	commands,
	window,
	workspace,
	ExtensionContext
} from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	RevealOutputChannelOn,
	ServerOptions,
	TransportKind,
	RequestType
} from 'vscode-languageclient/node';
import * as fs from 'fs';

let client: LanguageClient;
const openCSVRequest = new RequestType<string, void, void>('covlint/openCSV');

// 拡張機能が有効になったときに呼ばれる
export function activate(context: ExtensionContext) {
	// The server is implemented in node
	// サーバーはノードに実装されます（サーバーのパスを取得）
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);

	// デバッグ時の設定
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6011'], cwd: process.cwd() };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	// 拡張機能がデバッグ モードで起動される場合は、デバッグ サーバー オプションが使用されます。
	// それ以外の場合は、実行オプションが使用されます。
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
			options: debugOptions
		}
	};

	// Options to control the language client
	// LSPとの通信に使うリクエストを定義
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		// プレーンテキストドキュメント用のサーバーを登録します
		// 対象とするファイルの種類や拡張子
		documentSelector: [
			// { scheme: 'file', language: 'plaintext' },
			{ scheme: 'file' },
			{ scheme: 'untitled' }
		],
		// 警告パネルでの表示名
		diagnosticCollectionName: 'covlint',
		revealOutputChannelOn: RevealOutputChannelOn.Never,
		initializationOptions: {},
		progressOnInitialization: true,

		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			// ワークスペースに含まれる .clientrc ファイルへのファイル変更についてサーバーに通知します
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// コマンドパレットコマンドの登録
	const disposable = commands.registerCommand('covlint.activate', async () => {
		const csvFilePath = await window.showInputBox({
			// フォーカスがエディタの他の部分や他のウィンドウに移動しても、入力ボックスを開いたままにする
			ignoreFocusOut: true,
			prompt: 'Enter the CSV file name',
			placeHolder: 'fullpath/to/snapshot_id_xxxxx.csv'
		});

		if (typeof csvFilePath === 'undefined') {
			// ESC でエラーダイアログを出さない
			void window.showErrorMessage('No CSV file name provided. Exiting.');
			return;

		}

		const csvFileName = path.basename(csvFilePath);		// 拡張子を含む
		const csvExtName = path.extname(csvFileName);

		if (!csvFilePath) {
			await window.showErrorMessage('No CSV file name provided. Exiting.');
			return;

		} else if (!fs.existsSync(csvFilePath)) {
			void window.showErrorMessage(`File does not exist. Try again.: ${csvFilePath}`);
			return;

		} else if (!csvFileName.startsWith('snapshot_id_') || csvExtName !== '.csv') {
			void window.showErrorMessage(`File name format is not snapshot_id_xxxxx.csv: ${csvFileName}`);
			return;

		} else {
			// 正常
			void window.showInformationMessage(`File opened: ${csvFilePath}`);

		}

		void client.sendRequest(openCSVRequest, csvFilePath);

	});
	context.subscriptions.push(disposable);

	try {
		// Create the language client and start the client.
		// LSPを起動
		client = new LanguageClient(
			'covlint',
			'Covlint Language Server client',
			serverOptions,
			clientOptions
		);
	} catch (err) {
		void window.showErrorMessage('拡張機能の起動に失敗しました。詳細はアウトプットパネルを参照ください');
		return;

	}

	// Start the client. This will also launch the server
	void client.start().catch((error) => client.error(`Starting the server failed.`, error, 'force'));

}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
