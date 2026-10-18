import { greenfieldPreviewTokens } from './greenfield-preview-tokens.mjs';
// Self-contained static preview from actual Greenfield React components and local CSS.
// Uses installed esbuild only. Never runs Next.js, reads .env files, or connects to services.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const src=resolve(root,'src');
const outdir=await mkdtemp(join(tmpdir(),'greenfield-calendar-assessments-'));
const result=await build({absWorkingDir:root,entryPoints:[{in:'src/components/academics/calendar-assessment-preview-entry.tsx',out:'preview'}],outdir,bundle:true,write:false,format:'iife',platform:'browser',target:['es2022'],jsx:'automatic',sourcemap:false,minify:false,logLevel:'info',plugins:[{name:'greenfield-source-alias',setup(api){api.onResolve({filter:/^@\//},args=>{const base=resolve(src,args.path.slice(2));const match=['','.tsx','.ts','.jsx','.js','.css'].map(ext=>`${base}${ext}`).find(existsSync);return match?{path:match}:{errors:[{text:`Unable to resolve ${args.path}`} ]};});}}]});
const js=result.outputFiles.find(file=>file.path.endsWith('preview.js'))?.text;
const css=result.outputFiles.find(file=>file.path.endsWith('preview.css'))?.text;
if(!js||!css)throw new Error('Preview bundle is incomplete.');
for(const marker of ['Calendar & assessments','Fictional preview','greenfield-dropdown-options','planCalendarCommand','planAssessmentCommand','student-amina'])if(!js.includes(marker)&&!css.includes(marker))throw new Error(`Preview marker missing: ${marker}`);
if(/\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|EventSource|localStorage|sessionStorage|indexedDB|serviceWorker/.test(js))throw new Error('Network or persistent storage API found in generated preview.');
if(/@import\s+url\s*\(|url\(\s*['"]?https?:/i.test(css))throw new Error('External asset reference found in generated styles.');
const inline=js.replace(/<\/script/gi,'<\\/script');
const hash=createHash('sha256').update(inline).digest('base64');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>Greenfield Calendar &amp; Assessments — Offline Preview</title><style>${css}${greenfieldPreviewTokens}*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,'Segoe UI',Arial,sans-serif;background:var(--canvas);color:var(--ink)}button,input,select,textarea{font:inherit}.offline-frame{width:min(1440px,100%);min-height:100vh;margin:0 auto;padding:24px 30px}.offline-heading{margin:0 0 12px;color:#607467;font-size:11px;line-height:1.5}@media(max-width:640px){.offline-frame{padding:14px 12px}.offline-heading{font-size:10px}}</style></head><body><div class="offline-frame"><p class="offline-heading">Standalone Greenfield preview · fictional records · all changes memory-only · no network access</p><div id="greenfield-calendar-assessments"></div></div><script>${inline}</script></body></html>`;
await writeFile(join(outdir,'index.html'),html,'utf8');
process.stdout.write(`Offline preview created: ${join(outdir,'index.html')}\n`);
