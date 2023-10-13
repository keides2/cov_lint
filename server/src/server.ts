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

// CSVファイルは、cov_snap が取得する snapshot_id_14295.csv 書式
// cov_auto 書式の CSV
/*
interface Issue {
	cid: number;
	filename: string;
	// language: string;
	// functionDisplayName: string;
	lineNumber: number;
	// impact: string;						// 影響度
	// type: string;						// 型（問題の種類）
	// type2: string;
	// category: string;					// カテゴリ
	// category2: string;					// カテゴリ2
	eventDescription: string;
	// CWE: string;
	// count: number;						// カウント
	// checker: string;						// チェッカー
	// status: string;						// 状態
	// first_detect: string;				// 初回検出日
	// comparison: string;					// 比較
	// firstSnapshotId: string;				// 最初のスナップショットID
	// firstSnapshot_date: string;			// 最初のスナップショットの日付
	// firstSnapshotStream: string;			// 最初のスナップショットのストリーム
	// lastSnapshotId: string;				// 最後のスナップショット
	// lastSnapshotDate: string;			// 最後のスナップショットの日付
	// lastSnapshotStream: string;			// 最後のスナップショットのストリーム
	// lastTriagedDate: string;				// 最終選別日
	// lastTriagedUser: string;				// 最終選別ユーザー
	// lastTriagedComment: string;			// 最終選別コメント
	// classification: string;				// 分類
	// importance: string;					// 重要度
	// action: string;
	// external_reference: string;			// 外部参照
	// owner: string;						// 所有者/担当者
	// mergeKey: string;					// マージキー
}
*/
// cov_snap 書式の CSV
interface Issue {
	cid: string;					// CID A列[0]
	filename: string;				// ファイル名 B列[1]
	// functionname: string;		// 関数名 C列[2]
	lineNumber: string;				// 行番号 D列[3]
	impact: string;					// 影響度 E列[4]
	// typeOfProblem: string;		// 問題の種類 F列[5]
	type: string;					// 型 G列[6]
	checker: string;				// チェッカー名 H列[7]
	// domain: string;				// ドメイン I列[8]
	// stream: string;				// ストリーム名 J列[9]
	mainEvent: string;				// メインイベントの説明 K列[10]
	eventTag: string;				// イベントタグ L列[11]
	// category: string;			// カテゴリ M列[12]
	// localEffect: string;			// ローカル効果 N列[13]
	// description: string;			// 説明 O列[14]
	// firstDetect: string;			// 初回の検出日 P列[15]
	// firstSnapshotId: string;		// 初回のスナップショットID Q列[16]
	// firstStream: string;			// 初回のストリーム R列[17]
	// flstDetect: string;			// 直近の検出日 S列[18]
	// lastSnapshotId: string;		// 直近のスナップショットID T列[19]
	// lastStream: string;			// 直近のストリーム U列[20]
}
let issues: Issue[] = [];

const openCSV: RequestHandler<string, void, void> = async (csvFilePath) => {
	// csvFilePath をフルパスで入力
	connection.console.log(csvFilePath);

	try {
		const data = fs.readFileSync(csvFilePath);
		const decodedData = iconv.decode(data, 'SHIFT_JIS');
		const lines = decodedData.split('\n');
		// 全指摘を issue に格納する
		issues = [];
		for (const line of lines) {
			// const columns = line.split(',');
			const columns = line.split(',').map(column => column.replace(/"/g, ''));	// ダブルクォーテーション削除
			const issue: Issue = {
				cid: columns[0],
				filename: columns[1] ? columns[1].substring(columns[1].lastIndexOf('/') + 1) : '',
				lineNumber: columns[3],
				impact: columns[4],
				type: columns[6],
				checker: columns[7],
				eventTag: columns[11],
				mainEvent: columns[10],
				// ... 他のプロパティも同様に設定 ...
			};
			issues.push(issue);
		}

		/*
		for (let i = 0; i < 5; i++) {	// max: issues.length
			connection.console.log(`取得したデータ:`);
			connection.console.log(`  cid: ${issues[i].cid}`);
			connection.console.log(`  filename: ${issues[i].filename}`);
			connection.console.log(`  lineNumber: ${issues[i].lineNumber}`);
			connection.console.log(`  type: ${issues[i].type}`);
			connection.console.log(`  checker: ${issues[i].checker}`);
			connection.console.log(`  eventTag: ${issues[i].eventTag}`);
			connection.console.log(`  mainEvent: ${issues[i].mainEvent}`);

		}
		*/

	} catch (err) {
		connection.console.error(`Failed to open CSV file: ${err}`);
	}

};


let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

// 接続の初期化
connection.onInitialize((params: InitializeParams) => {
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
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };	// maxNumberOfProblems を使わない
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

	const text = textDocument.getText();
	const diagnostics: Diagnostic[] = [];

	// openCSV関数からcsvDataを取得
	const lines = text.split('\n');		// 行数

	for (const issue of issues) {
		// TODO: ひとまずパスを除いた拡張子を含むファイル名どうしの比較
		if (path.basename(issue.filename) === path.basename(textDocument.uri)) {
			for (let i = 0; i < lines.length; i++) {
				// 行番号が一致したら
				if (i + 1 === parseInt(issue.lineNumber)) {
					// 該当行に波線を引く
					let content =
						'CID: ' + issue.cid + ': '
						+ issue.type
						+ ' (' + issue.checker + ') , '
						+ issue.impact + '\n'
						+ issue.eventTag + ': '
						+ issue.mainEvent;
					const diagnostic: Diagnostic = {
						severity: getSeverity(issue.impact),
						range: {
							// start: { line: issue.lineNumber - 1, character: 0 },
							start: { line: i, character: 0 },
							end: { line: i, character: Number.MAX_VALUE },
						},
						message: content,
						source: 'covlint'
					};
					diagnostics.push(diagnostic);

				}
			}
		}
	}
	await connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });

}

function getSeverity(impact: string): DiagnosticSeverity {
	if (impact === '高') {
		return DiagnosticSeverity.Error;
	} else if (impact === '中') {
		return DiagnosticSeverity.Warning;
	} else if (impact === '低') {
		return DiagnosticSeverity.Information;
	} else {
		return DiagnosticSeverity.Hint;
	}
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
