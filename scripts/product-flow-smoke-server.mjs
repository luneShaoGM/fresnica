import http from 'node:http';
import { writeFile } from 'node:fs/promises';

const port = Number(process.env.FRESNICA_PRODUCT_FLOW_PORT ?? '8767');
const resultPath = process.env.FRESNICA_PRODUCT_FLOW_RESULT;
const timeoutMs = Number(process.env.FRESNICA_PRODUCT_FLOW_TIMEOUT_MS ?? '180000');

if (!resultPath) {
  throw new Error('product-flow-smoke-result-path-required');
}

let settled = false;

async function finish(code, marker, body) {
  if (settled) return;
  settled = true;
  await writeFile(
    resultPath,
    `${JSON.stringify({ marker, body, receivedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  );
  server.close(() => process.exit(code));
}
const server = http.createServer((request, response) => {
  if (request.method !== 'POST') {
    response.writeHead(405).end();
    return;
  }

  let body = '';
  request.setEncoding('utf8');
  request.on('data', chunk => {
    body += chunk;
  });
  request.on('end', async () => {
    const marker = request.url?.slice(1) ?? '';
    response.writeHead(204).end();
    if (marker === 'FRESNICA_PRODUCT_FLOW_SMOKE_OK') {
      await finish(0, marker, body);
    } else if (marker === 'FRESNICA_PRODUCT_FLOW_SMOKE_FAIL') {
      await finish(1, marker, body);
    }
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Product flow smoke server listening on 127.0.0.1:${port}`);
});
setTimeout(async () => {
  await finish(2, 'FRESNICA_PRODUCT_FLOW_SMOKE_TIMEOUT', '');
}, timeoutMs).unref();
