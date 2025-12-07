
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, 'package.json');
const versionJsonPath = path.resolve(__dirname, 'public/version.json');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

// Create public directory if it doesn't exist
const publicDir = path.dirname(versionJsonPath);
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

// Write version.json
const versionData = { version };
fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2));

console.log(`Generated version.json with version ${version}`);
