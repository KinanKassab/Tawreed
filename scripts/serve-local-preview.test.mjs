import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import test from 'node:test';
import { previewHandler } from './serve-local-preview.mjs';

test('preview serves documents without substituting HTML for old development assets', async () => {
  const base = await mkdtemp(join(tmpdir(), 'tawreed-preview-'));
  const server = createServer(previewHandler(base));
  try {
    await mkdir(join(base, 'product'));
    await writeFile(join(base, 'index.html'), '<html>Home</html>');
    await writeFile(join(base, 'login.html'), '<html>Login</html>');
    await writeFile(join(base, 'product', '[id].html'), '<html>Product</html>');
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(origin + '/login?returnTo=%2Faccount', { headers: { accept: 'text/html' } });
    assert.equal(login.status, 200);
    assert.equal(login.headers.get('cache-control'), 'no-store');
    assert.equal(await login.text(), '<html>Login</html>');
    for (const path of ['/apps/doctor/node_modules/expo-router/entry.bundle', '/_expo/static/js/web/deleted-chunk.js', '/missing.json']) {
      const response = await fetch(origin + path);
      assert.equal(response.status, 404, path);
      assert.match(response.headers.get('content-type'), /^text\/plain/);
      assert.equal((await response.text()).includes('<html'), false);
    }
    const product = await fetch(origin + '/product/example-id', { headers: { accept: 'text/html' } });
    assert.equal(await product.text(), '<html>Product</html>');
    const head = await fetch(origin + '/login', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  } finally {
    if (server.listening) await new Promise((done) => server.close(done));
    const absolute = resolve(base);
    if (!absolute.startsWith(resolve(tmpdir()) + sep) || !basename(absolute).startsWith('tawreed-preview-')) throw new Error('Unexpected test fixture directory');
    await rm(absolute, { recursive: true, force: true });
  }
});
