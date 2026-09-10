import http from 'node:http';
import { writeFile } from 'node:fs/promises';

const port = Number(process.env.FRESNICA_PRODUCT_FLOW_PORT ?? '8767');
const resultPath = process.env.FRESNICA_PRODUCT_FLOW_RESULT;
const timeoutMs = Number(process.env.FRESNICA_PRODUCT_FLOW_TIMEOUT_MS ?? '180000');
const OK_MARKER = 'FRESNICA_PRODUCT_FLOW_SMOKE_OK';
const FAIL_MARKER = 'FRESNICA_PRODUCT_FLOW_SMOKE_FAIL';
const OK_FIELDS = Object.freeze([
  'networkId',
  'coldBootstrap',
  'pendingBackup',
  'mainShell',
  'accountRead',
  'sourceAddress',
  'beforeNativeBalance',
  'afterNativeBalance',
  'transactionHash',
  'writeStatus',
]);

if (!resultPath) {
  throw new Error('product-flow-smoke-result-path-required');
}

let settled = false;

function parsePublicPayload(marker, body) {
  const payload = JSON.parse(body);
  const expectedFields = marker === OK_MARKER ? OK_FIELDS : ['stage'];
  const actualFields = Object.keys(payload).sort();
  const allowedFields = [...expectedFields].sort();
  if (
    actualFields.length !== allowedFields.length ||
    actualFields.some((field, index) => field !== allowedFields[index])
  ) {
    throw new Error('product-flow-smoke-non-public-callback-field');
  }
  if (marker === FAIL_MARKER && typeof payload.stage !== 'string') {
    throw new Error('product-flow-smoke-invalid-failure-stage');
  }
  return payload;
}

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
    if (marker !== OK_MARKER && marker !== FAIL_MARKER) {
      response.writeHead(404).end();
      return;
    }

    try {
      const payload = parsePublicPayload(marker, body);
      response.writeHead(204).end();
      await finish(marker === OK_MARKER ? 0 : 1, marker, payload);
    } catch {
      response.writeHead(400).end();
      await finish(3, 'FRESNICA_PRODUCT_FLOW_SMOKE_INVALID_CALLBACK', {
        stage: 'callback-validation',
      });
    }
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Product flow smoke server listening on 127.0.0.1:${port}`);
});

setTimeout(async () => {
  await finish(2, 'FRESNICA_PRODUCT_FLOW_SMOKE_TIMEOUT', { stage: 'timeout' });
}, timeoutMs).unref();
