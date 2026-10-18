import { greenfieldPreviewTokens } from './greenfield-preview-tokens.mjs';
// Builds a self-contained file:// preview from real Greenfield React components.
// Uses only the repository's already-installed esbuild package; no server/network.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'src');
const outdir = await mkdtemp(join(tmpdir(), 'greenfield-academic-operations-'));

const result = await build({
  absWorkingDir: root,
  entryPoints: [{ in: 'src/components/academics/academic-operations-preview-entry.tsx', out: 'preview' }],
  outdir,
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  sourcemap: false,
  minify: false,
  logLevel: 'info',
  plugins: [{
    name: 'greenfield-source-alias',
    setup(buildApi) {
      buildApi.onResolve({ filter: /^@\// }, args => {
        const base = resolve(src, args.path.slice(2));
        const match = ['', '.tsx', '.ts', '.jsx', '.js', '.css'].map(extension => `${base}${extension}`).find(candidate => existsSync(candidate));
        return match ? { path: match } : { errors: [{ text: `Cannot resolve Greenfield source alias: ${args.path}` }] };
      });
    },
  }],
});

const scriptOutput = result.outputFiles.find(file => file.path.endsWith('preview.js'));
const styleOutput = result.outputFiles.find(file => file.path.endsWith('preview.css'));
if (!scriptOutput || !styleOutput) throw new Error('esbuild did not produce the expected preview bundle files.');
const script = scriptOutput.text;
const styles = styleOutput.text;
const dropdownMarkers = ['greenfield-dropdown-options', 'aria-haspopup', 'getDropdownLayout', 'nextEnabledOptionIndex', 'ArrowDown'];
const missingDropdownMarkers = dropdownMarkers.filter(marker => !script.includes(marker));
if (missingDropdownMarkers.length) {
  throw new Error(`Updated shared GreenfieldDropdown is missing from the preview bundle: ${missingDropdownMarkers.join(', ')}`);
}
if (/\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|EventSource/.test(script)) {
  throw new Error('Unexpected network-capable API found in generated preview bundle.');
}
if (/@import\s+url\s*\(|url\(\s*['"]?https?:/i.test(styles)) {
  throw new Error('External stylesheet or asset reference found in generated preview styles.');
}

const inlineScript = script.replace(/<\/script/gi, '<\\/script');
const scriptHash = createHash('sha256').update(inlineScript).digest('base64');
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">
  <title>Greenfield Academic Operations — Offline Preview</title>
  <style>${styles}
    ${greenfieldPreviewTokens}
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,'Segoe UI',Arial,sans-serif;background:var(--canvas);color:var(--ink)}
    button,input,select,textarea{font:inherit}.offline-frame{width:min(1440px,100%);min-height:100vh;margin:0 auto;padding:24px 30px}.offline-heading{margin:0 0 12px;color:#607467;font-size:11px;line-height:1.5}
    @media(max-width:640px){.offline-frame{padding:14px 12px}.offline-heading{font-size:10px}}
  </style>
</head>
<body><div class="offline-frame"><p class="offline-heading">Standalone Greenfield preview · fictional records · no persistence or network access</p><div id="greenfield-academic-operations"></div></div><script>${inlineScript}</script></body>
</html>`;
await writeFile(join(outdir, 'index.html'), html, 'utf8');
process.stdout.write(`Offline preview created: ${join(outdir, 'index.html')}\n`);
