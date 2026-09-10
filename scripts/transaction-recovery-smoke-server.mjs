import http from 'node:http';
import {writeFile} from 'node:fs/promises';

const port = Number(process.env.FRESNICA_TRANSACTION_RECOVERY_PORT ?? '8766');
const pendingPath = process.env.FRESNICA_TRANSACTION_RECOVERY_PENDING_RESULT;
const finalPath = process.env.FRESNICA_TRANSACTION_RECOVERY_FINAL_RESULT;
const timeoutMs = Number(process.env.FRESNICA_TRANSACTION_RECOVERY_TIMEOUT_MS ?? '180000');

if (!pendingPath || !finalPath) {
  throw new Error('transaction-recovery-smoke-result-paths-required');
}

let settled = false;

async function writeResult(path, marker, body) {
  await writeFile(
    path,
    `${JSON.stringify({marker, body, receivedAt: new Date().toISOString()}, null, 2)}\n`,
    'utf8',
  );
}

async function finish(code, marker, body) {
  if (settled) return;
  settled = true;
  await writeResult(finalPath, marker, body);
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

    if (marker === 'FRESNICA_TRANSACTION_RECOVERY_PENDING') {
      await writeResult(pendingPath, marker, body);
      return;
    }
    if (marker === 'FRESNICA_TRANSACTION_RECOVERY_RECOVERED') {
      await finish(0, marker, body);
      return;
    }
    if (marker === 'FRESNICA_TRANSACTION_RECOVERY_FAIL') {
      await finish(1, marker, body);
    }
  });
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Transaction recovery server listening on 127.0.0.1:${port}`);
});

setTimeout(async () => {
  await finish(2, 'FRESNICA_TRANSACTION_RECOVERY_TIMEOUT', '');
}, timeoutMs).unref();
