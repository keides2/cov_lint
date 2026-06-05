#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { builtinModules } = require('module');

const rootDir = path.resolve(__dirname, '..');
const rootPackage = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const vsixPath = resolveVsixPath(process.argv[2]);
const buffer = fs.readFileSync(vsixPath);
const entries = readZipEntries(buffer);
const entryNames = new Set(entries.map((entry) => entry.name));

const requiredFiles = [
	'extension/package.json',
	'extension/client/out/extension.js',
	'extension/server/out/server.js',
	'extension/README.md',
	'extension/CHANGELOG.md',
	'extension/LICENSE.txt',
	'extension/img/COVLint.jpg'
];

const requiredActivationEvents = [
	'onCommand:covlint.activate',
	'onLanguage:plaintext'
];

const allowedExternalRequires = new Set([
	'vscode',
	...builtinModules,
	...builtinModules.map((name) => name.replace(/^node:/, ''))
]);

const failures = [];
const warnings = [];

console.log(`Checking VSIX: ${path.relative(rootDir, vsixPath)}`);

for (const fileName of requiredFiles) {
	if (!entryNames.has(fileName)) {
		failures.push(`Missing required file: ${fileName}`);
	}
}

const packageJson = readJson('extension/package.json');
if (packageJson) {
	if (packageJson.name !== rootPackage.name) {
		failures.push(`Manifest name mismatch: ${packageJson.name} != ${rootPackage.name}`);
	}
	if (packageJson.publisher !== rootPackage.publisher) {
		failures.push(`Manifest publisher mismatch: ${packageJson.publisher} != ${rootPackage.publisher}`);
	}
	if (packageJson.version !== rootPackage.version) {
		failures.push(`Manifest version mismatch: ${packageJson.version} != ${rootPackage.version}`);
	}
	if (packageJson.main !== './client/out/extension') {
		failures.push(`Unexpected extension main: ${packageJson.main}`);
	}

	const activationEvents = new Set(packageJson.activationEvents || []);
	for (const eventName of requiredActivationEvents) {
		if (!activationEvents.has(eventName)) {
			failures.push(`Missing activation event: ${eventName}`);
		}
	}

	const commands = new Set(
		(((packageJson.contributes || {}).commands) || []).map((command) => command.command)
	);
	if (!commands.has('covlint.activate')) {
		failures.push('Missing contributed command: covlint.activate');
	}
}

checkBundleRequires('extension/client/out/extension.js');
checkBundleRequires('extension/server/out/server.js');

if ([...entryNames].some((name) => name.startsWith('extension/client/src/'))) {
	failures.push('Client source files were packaged unexpectedly: extension/client/src/*');
}
if ([...entryNames].some((name) => name.startsWith('extension/server/src/'))) {
	failures.push('Server source files were packaged unexpectedly: extension/server/src/*');
}
if ([...entryNames].some((name) => name.startsWith('extension/scripts/'))) {
	failures.push('Development scripts were packaged unexpectedly: extension/scripts/*');
}

if (failures.length > 0) {
	console.error('\nVSIX package check failed:');
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	if (warnings.length > 0) {
		console.error('\nWarnings:');
		for (const warning of warnings) {
			console.error(`- ${warning}`);
		}
	}
	process.exit(1);
}

console.log('\nVSIX package check passed.');
if (warnings.length > 0) {
	console.log('\nWarnings:');
	for (const warning of warnings) {
		console.log(`- ${warning}`);
	}
}

function resolveVsixPath(argumentPath) {
	if (argumentPath) {
		return path.resolve(rootDir, argumentPath);
	}

	const expectedName = `${rootPackage.name}-${rootPackage.version}.vsix`;
	const expectedPath = path.join(rootDir, expectedName);
	if (fs.existsSync(expectedPath)) {
		return expectedPath;
	}

	const candidates = fs.readdirSync(rootDir)
		.filter((name) => name.endsWith('.vsix'))
		.map((name) => path.join(rootDir, name))
		.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
	if (candidates.length > 0) {
		return candidates[0];
	}

	console.error('No VSIX file found. Pass a VSIX path or run vsce package first.');
	process.exit(1);
}

function readJson(entryName) {
	if (!entryNames.has(entryName)) {
		return undefined;
	}
	return JSON.parse(readEntryText(entryName));
}

function checkBundleRequires(entryName) {
	if (!entryNames.has(entryName)) {
		return;
	}

	const source = readEntryText(entryName);
	const requirePattern = /\brequire\((['"])([^'"]+)\1\)/g;
	const unresolved = new Set();
	let match;
	while ((match = requirePattern.exec(source)) !== null) {
		const moduleName = match[2];
		if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
			continue;
		}
		if (allowedExternalRequires.has(moduleName)) {
			continue;
		}

		const packageRoot = moduleName.startsWith('@')
			? moduleName.split('/').slice(0, 2).join('/')
			: moduleName.split('/')[0];
		const hasPackagedNodeModule = [...entryNames].some((name) =>
			name.startsWith(`extension/node_modules/${packageRoot}/`)
		);
		if (!hasPackagedNodeModule) {
			unresolved.add(moduleName);
		}
	}

	if (unresolved.size > 0) {
		failures.push(`${entryName} has unresolved runtime require(s): ${[...unresolved].sort().join(', ')}`);
	}

	if (entryName === 'extension/client/out/extension.js' && !source.includes('server') && !source.includes('server.js')) {
		warnings.push(`${entryName} does not visibly reference server.js; verify serverModule resolution manually.`);
	}
}

function readEntryText(entryName) {
	const entry = entries.find((candidate) => candidate.name === entryName);
	if (!entry) {
		throw new Error(`Missing ZIP entry: ${entryName}`);
	}

	const localHeaderOffset = entry.localHeaderOffset;
	if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
		throw new Error(`Invalid local file header for ${entryName}`);
	}

	const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
	const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
	const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength;
	const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);

	if (entry.compressionMethod === 0) {
		return compressed.toString('utf8');
	}
	if (entry.compressionMethod === 8) {
		return zlib.inflateRawSync(compressed).toString('utf8');
	}

	throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} for ${entryName}`);
}

function readZipEntries(zipBuffer) {
	const eocdOffset = findEndOfCentralDirectory(zipBuffer);
	const centralDirectorySize = zipBuffer.readUInt32LE(eocdOffset + 12);
	const centralDirectoryOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
	const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
	const result = [];

	let offset = centralDirectoryOffset;
	while (offset < centralDirectoryEnd) {
		if (zipBuffer.readUInt32LE(offset) !== 0x02014b50) {
			throw new Error(`Invalid central directory header at offset ${offset}`);
		}

		const compressionMethod = zipBuffer.readUInt16LE(offset + 10);
		const compressedSize = zipBuffer.readUInt32LE(offset + 20);
		const fileNameLength = zipBuffer.readUInt16LE(offset + 28);
		const extraLength = zipBuffer.readUInt16LE(offset + 30);
		const commentLength = zipBuffer.readUInt16LE(offset + 32);
		const localHeaderOffset = zipBuffer.readUInt32LE(offset + 42);
		const name = zipBuffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');

		result.push({
			name,
			compressionMethod,
			compressedSize,
			localHeaderOffset
		});

		offset += 46 + fileNameLength + extraLength + commentLength;
	}

	return result;
}

function findEndOfCentralDirectory(zipBuffer) {
	const minimumOffset = Math.max(0, zipBuffer.length - 0xffff - 22);
	for (let offset = zipBuffer.length - 22; offset >= minimumOffset; offset--) {
		if (zipBuffer.readUInt32LE(offset) === 0x06054b50) {
			return offset;
		}
	}
	throw new Error('Could not find ZIP end of central directory.');
}
