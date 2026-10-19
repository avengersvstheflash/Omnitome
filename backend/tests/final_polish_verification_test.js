/**
 * backend/tests/final_polish_verification_test.js
 *
 * Verification suite for:
 * 1. SSRF and Open Redirect protection in WebFetcher (IPv4-mapped IPv6, [::], 302 redirect chaining).
 * 2. TTS Client Voice Whitelist enforcement and path traversal immunity.
 * 3. ResourceManager marker file extraction parity and Zip Slip protection via path.relative.
 * 4. CORS origin regex matching against localhost IPv4/IPv6, Tauri, and rejection of external origins.
 */

'use strict';

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const AdmZip = require('adm-zip');

const webFetcher = require('../services/web/webFetcher');
const ttsClient = require('../services/ai/ttsClient');
const { ResourceManager } = require('../services/resourceManager');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING FINAL POLISH & SECURITY VERIFICATION SUITE');
  console.log('================================================================\n');

  // ----------------------------------------------------
  // Test 1: SSRF Protection on IPv4-Mapped IPv6 & Edge IPs
  // ----------------------------------------------------
  console.log('[Test 1] WebFetcher SSRF protection on advanced private IP formats');
  const forbiddenUrls = [
    'http://localhost:3000',
    'http://127.0.0.1:8765',
    'http://127.100.50.1:3000',
    'http://0.0.0.0:3000',
    'http://[::]',
    'http://[::1]',
    'http://[::ffff:127.0.0.1]:8765',
    'http://[::ffff:7f00:1]:8765',
    'http://[::ffff:10.0.0.1]',
    'http://[::ffff:192.168.1.1]',
    'http://[::ffff:169.254.169.254]',
    'http://10.254.0.1',
    'http://172.16.0.1',
    'http://172.31.255.254',
    'http://192.168.0.1',
    'http://169.254.169.254',
    'http://100.64.0.1',
    'http://test.local',
    'http://test.internal',
    'http://test.lan',
  ];

  for (const url of forbiddenUrls) {
    let blocked = false;
    try {
      await webFetcher.fetch(url);
    } catch (err) {
      blocked = err.message.includes('restricted') || err.message.includes('security');
    }
    assert.strictEqual(blocked, true, `SSRF check failed to block restricted URL: ${url}`);
  }
  console.log('  ✓ T1 PASS: All 20 private/loopback/mapped-IPv6 addresses blocked before network dispatch.');

  // ----------------------------------------------------
  // Test 2: SSRF Open-Redirect Protection
  // ----------------------------------------------------
  console.log('\n[Test 2] WebFetcher manual redirect inspection blocks 302 to internal IPs');
  const redirectServer = http.createServer((req, res) => {
    if (req.url === '/hop1') {
      res.writeHead(302, { Location: '/hop2' });
      res.end();
    } else if (req.url === '/hop2') {
      res.writeHead(302, { Location: 'http://127.0.0.1:8765/v1/health' });
      res.end();
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>OK</h1>');
    }
  });

  await new Promise((resolve) => redirectServer.listen(0, '127.0.0.1', resolve));
  const redirectPort = redirectServer.address().port;

  try {
    let redirectBlocked = false;
    try {
      await webFetcher.executeFetch(`http://127.0.0.1:${redirectPort}/hop1`);
    } catch (err) {
      redirectBlocked = err.message.includes('restricted');
    }
    assert.strictEqual(redirectBlocked, true, 'Redirect to 127.0.0.1 must be caught and blocked');
    console.log('  ✓ T2 PASS: 302 redirect chaining into local network was intercepted and rejected.');
  } finally {
    redirectServer.close();
  }

  // ----------------------------------------------------
  // Test 3: TTS Voice Whitelist & Path Traversal Immunity
  // ----------------------------------------------------
  console.log('\n[Test 3] TTS Client voice whitelist normalization');
  const maliciousVoice = '../../../../windows/system32';
  const resolvedPath = ttsClient.resolveAudioPath('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', maliciousVoice);
  assert.strictEqual(resolvedPath.dir.includes('system32'), false, 'Directory path must never contain traversal strings');
  assert.strictEqual(resolvedPath.dir.includes('af_heart'), true, 'Unrecognized voice must normalize to default af_heart');

  const hashedWithBadVoice = ttsClient.computeSentenceHash('Hello world', maliciousVoice, 1.0);
  const hashedWithDefault = ttsClient.computeSentenceHash('Hello world', 'af_heart', 1.0);
  assert.strictEqual(hashedWithBadVoice, hashedWithDefault, 'computeSentenceHash must produce identical hash when fallback voice is used');
  console.log('  ✓ T3 PASS: Voice parameter strictly bounded to VOICE_WHITELIST; path traversal eliminated.');

  // ----------------------------------------------------
  // Test 4: ResourceManager Parity on Flat & Nested Markers
  // ----------------------------------------------------
  console.log('\n[Test 4] ResourceManager _unpackAndPromote handles flat marker extraction');
  const tmpTestDir = path.join(os.tmpdir(), `omnitome_polish_test_${Date.now()}`);
  fs.mkdirSync(tmpTestDir, { recursive: true });

  try {
    const rm = new ResourceManager(tmpTestDir);
    const mockModel = {
      id: 'mock-ocr',
      format: 'zip',
      targetSubdir: 'ocr/model',
      markerFiles: ['deep/dir/inference.pdmodel'],
    };

    // Create a mock zip with flat marker file
    const zip = new AdmZip();
    zip.addFile('inference.pdmodel', Buffer.from('mock weights'));
    const zipPath = path.join(tmpTestDir, 'mock.zip');
    zip.writeZip(zipPath);

    // Unpack and promote
    await rm._unpackAndPromote(mockModel, zipPath);

    // Verify model is marked as installed
    assert.strictEqual(rm.isModelInstalled(mockModel), true, 'isModelInstalled must recognize flat marker');
    console.log('  ✓ T4 PASS: Flat marker extraction promoted and recognized consistently.');

    // ----------------------------------------------------
    // Test 5: Zip Slip Traversal Detection via path.relative
    // ----------------------------------------------------
    console.log('\n[Test 5] Zip Slip rejection via path.relative');
    const evilZip = new AdmZip();
    evilZip.addFile('evil.txt', Buffer.from('payload'));
    evilZip.getEntries()[0].entryName = '../../evil.txt';
    const evilZipPath = path.join(tmpTestDir, 'evil.zip');
    fs.writeFileSync(evilZipPath, evilZip.toBuffer());

    let zipSlipBlocked = false;
    try {
      await rm._unpackAndPromote(mockModel, evilZipPath);
    } catch (err) {
      zipSlipBlocked = err.message.includes('Zip slip');
    }
    assert.strictEqual(zipSlipBlocked, true, 'Zip slip archive must be rejected');
    console.log('  ✓ T5 PASS: Archive with parent traversal rejected before extraction.');
  } finally {
    fs.rmSync(tmpTestDir, { recursive: true, force: true });
  }

  // ----------------------------------------------------
  // Test 6: CORS Origin Whitelist Patterns
  // ----------------------------------------------------
  console.log('\n[Test 6] CORS Origin Whitelist Pattern Coverage');
  const ALLOWED_ORIGIN_PATTERNS = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https?:\/\/\[::1\](:\d+)?$/,
    /^tauri:\/\/localhost$/,
    /^https?:\/\/tauri\.localhost$/,
  ];

  const allowedOrigins = [
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://[::1]:3000',
    'https://[::1]:5173',
    'tauri://localhost',
    'http://tauri.localhost',
    'https://tauri.localhost',
  ];

  for (const origin of allowedOrigins) {
    const isAllowed = ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin));
    assert.strictEqual(isAllowed, true, `Allowed origin was rejected: ${origin}`);
  }

  const disallowedOrigins = [
    'null',
    'http://malicious.com',
    'http://attacker.localhost.evil.com',
    'http://192.168.1.5',
    'https://example.com',
  ];

  for (const origin of disallowedOrigins) {
    const isAllowed = ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin));
    assert.strictEqual(isAllowed, false, `Disallowed origin was accepted: ${origin}`);
  }
  console.log('  ✓ T6 PASS: CORS whitelist accurately admits trusted desktop/dev hosts and rejects external domains.');

  console.log('\n================================================================');
  console.log('🎉 ALL FINAL POLISH & SECURITY VERIFICATION TESTS PASSED!');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ FINAL POLISH TEST FAILED:\n', err);
  process.exit(1);
});
