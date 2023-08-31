'use strict';

import {
	ExtensionContext,
	//	window as Window,
	window,
	Uri,
	commands,
	workspace,
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
	console.log('My extension "genie-like 2" is now active!');

	// 右クリックからのコンテキストメニューにリファクタリング・コマンドを追加し実行（ChatGPTに依頼）
	let disposable = commands.registerCommand('genie-like.refactoring', async () => {
		// APIキーを取得
		const configuration = workspace.getConfiguration('genie-like');
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

			//　chatGPTの初期化メッセージ
			console.log('start chatgpt');
			void window.showInformationMessage('chatGPTにリファクタリングを依頼します');
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
				void window.showInformationMessage('chatGPTによるリファクタリング実行中です');

				const data = await axios.post(apiEndpoint, requestBody, { headers: header });
				const refactoredText = data.data.choices[0].message.content;

				void window.showInformationMessage('chatGPTによるリファクタリングが完了しました');
				console.log(data.data.choices);

				const refactoredDocument = await workspace.openTextDocument({ language: 'plaintext', content: refactoredText });
				// const refactoredEditor = await window.showTextDocument(document);
				await window.showTextDocument(document);

				// 2画面で差分表示
				await commands.executeCommand('vscode.diff', document.uri, refactoredDocument.uri);

			} catch (e) {
				console.error(e);
				void window.showInformationMessage('chatGPTにエラーが発生しました。APIキーが適切に設定されているか確認してください');
			}
		}
	});

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
		diagnosticCollectionName: 'sample',
		revealOutputChannelOn: RevealOutputChannelOn.Never,
		initializationOptions: {},
		progressOnInitialization: true,
	};

	let client: LanguageClient;
	try {
		// LSPを起動
		client = new LanguageClient(
			// 拡張機能のID
			'languageServerId',
			// ユーザ向けの名前（出力ペインで使用されます）
			'CSVLint LSP Server',
			serverOptions,
			clientOptions
		);

	} catch (err) {
		void window.showErrorMessage('拡張機能の起動に失敗しました。詳細はアウトプットパネルを参照ください');
		return;

	}

	// 拡張機能のコマンドを登録
	context.subscriptions.push(
		disposable,
		client.start(),
	);
}
