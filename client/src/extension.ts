/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import {
	commands,
	window,
	workspace, ExtensionContext
} from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
	RequestType
} from 'vscode-languageclient/node';

let client: LanguageClient;
const openCSVRequest = new RequestType<string, void, void>('covlint/openCSV');

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	// サーバーはノードに実装されます
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	// 拡張機能がデバッグ モードで起動される場合は、デバッグ サーバー オプションが使用されます。
	// それ以外の場合は、実行オプションが使用されます。
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'plaintext' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	const disposable = commands.registerCommand('covlint.activate', async () => {
		const csvFileName = await window.showInputBox({
			prompt: 'Enter the CSV file name',
			placeHolder: '1001.csv'
		});
		if (!csvFileName) {
			window.showWarningMessage('No CSV file name provided. Exiting.');
			return;
		}

		client.sendRequest(openCSVRequest, csvFileName);
	});
	context.subscriptions.push(disposable);

	// Create the language client and start the client.
	client = new LanguageClient(
		'covlint',
		'Covlint Language Server client',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();

}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
