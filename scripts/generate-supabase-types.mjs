import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const outputPath = resolve(workspaceRoot, 'packages/types/src/database.generated.ts');
const cliEntry = resolve(workspaceRoot, 'node_modules/supabase/dist/supabase.js');

const child = spawn(process.execPath, [cliEntry, 'gen', 'types', 'typescript', '--local', '--schema', 'public'], {
  cwd: workspaceRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let generated = '';
child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => { generated += chunk; });
child.stderr.pipe(process.stderr);

child.on('error', (error) => {
  console.error(`Could not start Supabase type generation: ${error.message}`);
  process.exitCode = 1;
});

child.on('close', async (code) => {
  if (code !== 0) {
    if (generated) process.stderr.write(generated);
    console.error('Supabase type generation failed; the existing generated-types file was preserved.');
    process.exitCode = code ?? 1;
    return;
  }

  if (!generated.includes('export type Database')) {
    console.error('Supabase returned unexpected type output; the existing generated-types file was preserved.');
    process.exitCode = 1;
    return;
  }

  await writeFile(outputPath, generated, 'utf8');
  console.log(`Updated ${outputPath}`);
});
