import {
	createConnection,
	CompletionItem,
	CompletionItemKind,
	Diagnostic,
	DiagnosticSeverity,
	DidChangeConfigurationNotification,
	InitializeParams,
	InitializeResult,
	ProposedFeatures,
	RequestHandler,
	RequestType,
	TextDocuments,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import * as fs from 'fs';
import * as iconv from 'iconv-lite';
import * as path from 'path';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
// ノードの IPC をトランスポートとして使用して、サーバーへの接続を作成します。
// すべてのプレビュー/提案された LSP 機能も含めます。
// サーバー接続オブジェクトを作成する。この接続にはNodeのIPC(プロセス間通信)を利用する
// LSPの全機能を提供する
const connection = createConnection(ProposedFeatures.all);
connection.console.info(`covlint server running in node ${process.version}`);	// v18.15.0

// Create a simple text document manager.
// 単純なテキスト ドキュメント マネージャーを作成します。
// 初期化ハンドルでインスタンス化する
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// クライアントから受け取るCSVファイル名
const openCSVRequest = new RequestType<string, void, void>('covlint/openCSV');

interface Issue {
	cid: number;
	filename: string;
	// language: string;
	// functionDisplayName: string;
	lineNumber: number;
	// impact: string;						// 影響度
	// type: string;						// 問題の種類
	// type2: string;
	// category: string;					// カテゴリ
	// category2: string;					// カテゴリ2
	eventDescription: string;
	// CWE: string;
	// count: number;						// カウント
	// checker: string;					// チェッカー
	// status: string;						// 状態
	// first_detect: string;				// 初回検出日
	// comparison: string;					// 比較
	// firstSnapshotId: string;			// 最初のスナップショットID
	// firstSnapshot_date: string;			// 最初のスナップショットの日付
	// firstSnapshotStream: string;		// 最初のスナップショットのストリーム
	// lastSnapshotId: string;				// 最後のスナップショット
	// lastSnapshotDate: string;			// 最後のスナップショットの日付
	// lastSnapshotStream: string;			// 最後のスナップショットのストリーム
	// lastTriagedDate: string;			// 最終選別日
	// lastTriagedUser: string;			// 最終選別ユーザー
	// lastTriagedComment: string;			// 最終選別コメント
	// classification: string;				// 分類
	// importance: string;					// 重要度
	// action: string;
	// external_reference: string;			// 外部参照
	// owner: string;						// 所有者/担当者
	// mergeKey: string;					// マージキー
}
let issues: Issue[] = [];

const openCSV: RequestHandler<string, void, void> = async (csvFileName) => {
	// const filePath = path.join(__dirname, csvFileName);
	// const path = require('path');
	const projectPath = path.resolve(__dirname, '../..');	// server.ts から2つ上=ルート
	connection.console.log(projectPath);

	const filePath = path.join(projectPath, csvFileName);
	try {
		const data = fs.readFileSync(filePath);
		const decodedData = iconv.decode(data, 'SHIFT_JIS');
		const lines = decodedData.split('\n');
		// 全指摘を issue に格納する
		issues = [];
		for (const line of lines) {
			const columns = line.split(',');
			const issue: Issue = {
				cid: parseInt(columns[0]),
				filename: columns[1] ? columns[1].substring(columns[1].lastIndexOf('/') + 1) : '',
				lineNumber: parseInt(columns[5]),
				eventDescription: columns[12],
				// ... 他のプロパティも同様に設定 ...
			};
			issues.push(issue);
		}

		for (let i = 0; i < 5; i++) {	// max: issues.length
			connection.console.log(`取得したデータ cid: ${issues[i].cid}`);
			connection.console.log(`取得したデータ filename: ${issues[i].filename}`);
			connection.console.log(`取得したデータ lineNumber: ${issues[i].lineNumber}`);
			connection.console.log(`取得したデータ eventDescription: ${issues[i].eventDescription}`);

		}

	} catch (err) {
		connection.console.error(`Failed to open CSV file: ${err}`);
	}

};


let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

// 接続の初期化
connection.onInitialize((params: InitializeParams) => {
	/*
	// クライアントから画面情報を受け取る
	connection.onRequest('custom/analyzeCode', async ({ fileName, visibleRanges }) => {
		// ここでfileNameとvisibleRangesを受け取る
		connection.console.log('onInitialize - onRequest: Received fileName:' + fileName);
		connection.console.log('onInitialize - onRequest: Received visibleRanges (start):' + visibleRanges.start);
		connection.console.log('onInitialize - onRequest: Received visibleRanges (end):' + visibleRanges.end);

		// openCSV関数からcsvDataを取得
		for (const issue of issues) {
			// TODO: ひとまずパスを除いた拡張子を含むファイル名どうしの比較
			if (path.basename(issue.filename) === path.basename(fileName)) {
				for (const range of visibleRanges) {
					if (range.start.line <= issue.lineNumber && issue.lineNumber <= range.end.line) {
						// 該当行に波線を引く
						const diagnostic: Diagnostic = {
							severity: DiagnosticSeverity.Warning,
							range: {
								start: { line: issue.lineNumber, character: 0 },
								end: { line: issue.lineNumber, character: Number.MAX_VALUE },
							},
							message: issue.eventDescription,
							source: 'csv-lint'
						};

						await connection.sendDiagnostics({ uri: fileName, diagnostics: [diagnostic] });
					}
				}
			}
		}
		
	});
	*/

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	// クライアントは `workspace/configuration` リクエストをサポートしていますか?
	// そうでない場合は、グローバル設定を使用してフォールバックします。
	const capabilities = params.capabilities;
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			// このサーバーがコード補完をサポートしていることをクライアントに伝えます。
			completionProvider: {
				resolveProvider: true
			}
		}
	};

	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}

	return result;
});

// 接続の初期化後
connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		// すべての設定変更を登録します。
		void connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}

	connection.onRequest(openCSVRequest, openCSV);

});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
// グローバル設定。「workspace/configuration」リクエストがクライアントでサポートされていない場合に使用されます。
// これは、この例で提供されているクライアントでこのサーバーを使用する場合には当てはまりませんが、
// 他のクライアントでは発生する可能性があることに注意してください。
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
// 開いているすべてのドキュメントの設定をキャッシュします
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();


// ドキュメントの設定を監視する
connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.covlintLanguageServer || defaultSettings)
		);
	}

	// Revalidate all open text documents
	// 開いているすべてのテキストドキュメントを再検証します
	documents.all().forEach(validateTextDocument);

});


// Only keep settings for open documents
// 開いているドキュメントの設定のみを保持します
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
// テキストドキュメントの内容が変更されました。 
// このイベントは、テキスト ドキュメントが最初に開かれたとき、またはそのコンテンツが変更されたときに発生します。
documents.onDidChangeContent(async change => {
	await validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	// この簡単な例では、検証を実行するたびに設定を取得します。
	// const settings = getDocumentSettings(textDocument.uri);
	const settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	// バリデータは、長さ 2 以降のすべての大文字の単語の診断を作成します
	const text = textDocument.getText();
	const pattern = /\b[A-Z]{2,}\b/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
	const resolvedSettings = await settings;
	while ((m = pattern.exec(text)) && problems < resolvedSettings.maxNumberOfProblems) {
		problems++;
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} is all uppercase.`,
			source: 'ex'
		};
		if (hasDiagnosticRelatedInformationCapability) {
			diagnostic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Spelling matters'
				},
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Particularly for names'
				}
			];
		}
		diagnostics.push(diagnostic);
	}

	// Send the computed diagnostics to VSCode.
	// 計算された診断を VSCode に送信します。
	await connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });

}

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'covlintLanguageServer'
		});
		documentSettings.set(resource, result);
	}
	return result;
}


// クライアントから画面情報を受け取る
connection.onRequest('custom/analyzeCode', async ({ fileName, visibleRanges }) => {
	// ここでfileNameとvisibleRangesを受け取る
	connection.console.log('onRequest: Received fileName:' + fileName);
	connection.console.log('onRequest: Received visibleRanges[0]]:' + visibleRanges[0]);
	connection.console.log('onRequest: Received visibleRanges[1]]:' + visibleRanges[1]);

	// openCSV関数からcsvDataを取得
	for (const issue of issues) {
		// TODO: ひとまずパスを除いた拡張子を含むファイル名どうしの比較
		if (path.basename(issue.filename) === path.basename(fileName)) {
			for (const range of visibleRanges) {
				connection.console.log(`Received visibleRanges: ${range}`);

				if (range.line <= issue.lineNumber && issue.lineNumber <= range.line) {
					// 該当行に波線を引く
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Warning,
						range: {
							start: { line: issue.lineNumber, character: 0 },
							end: { line: issue.lineNumber, character: Number.MAX_VALUE },
						},
						message: issue.eventDescription,
						source: 'csv-lint'
					};

					await connection.sendDiagnostics({ uri: fileName, diagnostics: [diagnostic] });
				}
			}
		}
	}
});



// ファイルの変更を監視する
connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	// VSCode で監視対象のファイルが変更されました
	connection.console.log('We received an file change event');
});


// This handler provides the initial list of the completion items.
// このハンドラーは、完了項目の初期リストを提供します。
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		// pass パラメータには、コードコンプリートが要求されたテキスト ドキュメントの位置が含まれます。
		// この例では、この情報を無視し、常に同じ完了項目を提供します。
		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
);


// This handler resolves additional information for the item selected in
// the completion list.
// このハンドラーは、完了リストで選択された項目の追加情報を解決します。
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);


// Make the text document manager listen on the connection
// for open, change and close text document events
// テキスト ドキュメント マネージャーが、
// 接続でテキスト ドキュメントのオープン、変更、クローズ イベントをリッスンするようにします。
documents.listen(connection);

// Listen on the connection
connection.listen();
