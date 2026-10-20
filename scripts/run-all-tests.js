#!/usr/bin/env node
/**
 * scripts/run-all-tests.js
 *
 * Runs all regression suites in order.
 * Stops immediately on the first failure and exits with code 1.
 * Exits code 0 with "ALL <n> SUITES PASS" if all pass.
 *
 * Automatically verifies and starts local Python sidecar if offline,
 * ensuring seamless execution across developer environments.
 */

'use strict';

const { spawnSync, spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');

// Isolate test DB from dev DB so test runs do not wipe user Library
process.env.DB_PATH = path.join(ROOT, 'storage', 'test-data.db');

const TIMEOUT_MS = 600_000;

const SUITES = [
  'phase5_7_3_parse_test.js',
  'build3b_test.js',
  'build3b_finalization_test.js',
  'build3b_hardening_test.js',
  'build3b16_structure_test.js',
  'build3b17_real_pdf_test.js',
  'build3b19_pdfjs_parser_test.js',
  'build4_1_editorial_intelligence_test.js',
  'build4_2a_planner_test.js',
  'build4_2bc_single_book_test.js',
  'build4_editorial_synthesis_test.js',
  'build4_4_progressive_synthesis_test.js',
  'build4_5_bge_migration_test.js',
  'build4_14_eval_harness_test.js',
  'build4_19_contract_test.js',
  'build4_15_parser_stress_test.js',
  'build4_15b_front_matter_filter_test.js',
  'build5_1a_bibliographic_test.js',
  'build5_1b_provenance_test.js',
  'build5_3_library_split_test.js',
  'phase5_6_validation_test.js',
  'phase5_7_ocr_test.js',
  'phase5_7_2_nlp_test.js',
  'phase5_7_2_embed_test.js',
  'phase5_7_2_parallel_test.js',
  'phase5_8_0j_chatlog_detect_test.js',
  'phase5_8_0j_legacy_font_test.js',
  'f32_section_classifier_test.js',
  'f32_1_structure_detector_test.js',
  'f31_math_extractor_test.js',
  'f34_rerank_batch_test.js',
  'f33_surrogate_sanitize_test.js',
  'f32_3_toc_chapter_builder_test.js',
  'f34_1a_rerank_multi_test.js',
  'f32_3a_page_tracking_test.js',
  'f37_python_embedder_default_test.js',
  'f37_2_embed_batch_size_test.js',
  'f37_5_pipeline_reliability_test.js',
  'f38_manual_resynthesize_test.js',
  'f43_node_lifecycle_test.js',
  'f49_synopsis_retry_test.js',
  'f51a_encoding_detection_test.js',
  'f51c_txt_import_test.js',
  'f51e_single_chapter_outline_test.js',
  'tier2_chardet_encoding_test.js',
  'import_queue_pipeline_test.js',
  'web_expanded_search_test.js',
  'f63_settings_service_test.js',
  'f52_schema_and_lifecycle_test.js',
  'f52_endpoints_test.js',
  'f52_delete_resynthesis_recovery_test.js',
  'f54_synopsis_regenerate_test.js',
  'f58_1_dossier_dedup_test.js',
  'f81_omni_reading_time_test.js',
  'f81_1_omni_read_fallback_test.js',
  'f79b_append_source_test.js',
  'f85_kokoro_tts_sidecar_test.js',
  's13_resource_manager_test.js',
  'final_polish_verification_test.js',
  'tts_and_library_fix_test.js',
];

const NETWORK_SUITES = [
  'build3a_test.js',
];

function checkOnline() {
  if (process.env.OFFLINE === '1' || process.env.OFFLINE === 'true') {
    return false;
  }
  const check = spawnSync(process.execPath, [
    '-e',
    'require("node:dns").lookup("en.wikipedia.org", (err) => process.exit(err ? 1 : 0))',
  ], { timeout: 2000 });
  return check.status === 0;
}

function checkSidecarRunning(port = 8765) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/v1/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureSidecar() {
  const isRunning = await checkSidecarRunning();
  if (isRunning) {
    return null;
  }

  const venvPythonWin = path.join(ROOT, 'sidecars', 'python', '.venv', 'Scripts', 'python.exe');
  const venvPythonPosix = path.join(ROOT, 'sidecars', 'python', '.venv', 'bin', 'python');
  const pythonBin = fs.existsSync(venvPythonWin) ? venvPythonWin : (fs.existsSync(venvPythonPosix) ? venvPythonPosix : 'python');

  const mainScript = path.join(ROOT, 'sidecars', 'python', 'main.py');
  if (!fs.existsSync(mainScript)) {
    return null;
  }

  process.stdout.write('[Test Runner] Python sidecar not detected on 127.0.0.1:8765. Launching background instance...\n');
  const sidecarChild = spawn(pythonBin, [mainScript, '--port', '8765'], {
    cwd: ROOT,
    stdio: 'ignore',
  });

  const cleanup = () => {
    try {
      if (sidecarChild && !sidecarChild.killed) {
        sidecarChild.kill('SIGTERM');
      }
    } catch (_) {}
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const start = Date.now();
  while (Date.now() - start < 30000) {
    await new Promise((r) => setTimeout(r, 600));
    if (await checkSidecarRunning()) {
      process.stdout.write('[Test Runner] Python sidecar successfully started on port 8765.\n');
      return sidecarChild;
    }
  }

  process.stderr.write('[Test Runner] Warning: Python sidecar did not signal ready within 30s; proceeding with test execution.\n');
  return sidecarChild;
}

async function main() {
  const spawnedSidecar = await ensureSidecar();

  let passed = 0;
  let skipped = 0;

  try {
    for (const name of SUITES) {
      const testPath = path.join(ROOT, 'backend', 'tests', name);

      process.stdout.write(`\n=== ${name} ===\n`);

      const result = spawnSync(process.execPath, [testPath], {
        stdio: 'inherit',
        cwd: ROOT,
        timeout: TIMEOUT_MS,
        killSignal: 'SIGTERM',
      });

      const timedOut = result.error && result.error.code === 'ETIMEDOUT';

      if (timedOut) {
        process.stderr.write(`\nFAILED: ${name} - timed out after ${TIMEOUT_MS / 1000}s\n`);
        process.exit(1);
      }

      if (result.error) {
        process.stderr.write(`\nFAILED: ${name} - spawn error: ${result.error.message}\n`);
        process.exit(1);
      }

      if (result.status !== 0) {
        process.stderr.write(`\nFAILED: ${name} - exited with code ${result.status}\n`);
        process.exit(1);
      }

      passed += 1;
    }

    const isOnline = checkOnline();

    for (const name of NETWORK_SUITES) {
      process.stdout.write(`\n=== ${name} ===\n`);

      if (!isOnline) {
        process.stdout.write(`SKIPPED: ${name} - network required (offline)\n`);
        skipped += 1;
        continue;
      }

      const testPath = path.join(ROOT, 'backend', 'tests', name);

      const result = spawnSync(process.execPath, [testPath], {
        stdio: 'inherit',
        cwd: ROOT,
        timeout: TIMEOUT_MS,
        killSignal: 'SIGTERM',
      });

      const timedOut = result.error && result.error.code === 'ETIMEDOUT';

      if (timedOut) {
        process.stderr.write(`\nFAILED: ${name} - timed out after ${TIMEOUT_MS / 1000}s\n`);
        process.exit(1);
      }

      if (result.error) {
        process.stderr.write(`\nFAILED: ${name} - spawn error: ${result.error.message}\n`);
        process.exit(1);
      }

      if (result.status !== 0) {
        process.stderr.write(`\nFAILED: ${name} - exited with code ${result.status}\n`);
        process.exit(1);
      }

      passed += 1;
    }

    process.stdout.write(`\n=== run-corpus-tests.js ===\n`);
    const corpusScript = path.join(ROOT, 'scripts', 'run-corpus-tests.js');
    const corpusResult = spawnSync(process.execPath, [corpusScript], {
      stdio: 'inherit',
      cwd: ROOT,
      timeout: TIMEOUT_MS,
      killSignal: 'SIGTERM',
    });

    const corpusTimedOut = corpusResult.error && corpusResult.error.code === 'ETIMEDOUT';
    if (corpusTimedOut) {
      process.stderr.write(`\nFAILED: CORPUS GATE - timed out after ${TIMEOUT_MS / 1000}s\n`);
      process.exit(1);
    }

    if (corpusResult.error) {
      process.stderr.write(`\nFAILED: CORPUS GATE - spawn error: ${corpusResult.error.message}\n`);
      process.exit(1);
    }

    if (corpusResult.status !== 0) {
      process.stderr.write(`\nFAILED: CORPUS GATE - exited with code ${corpusResult.status}\n`);
      process.exit(corpusResult.status || 1);
    }

    if (skipped > 0) {
      process.stdout.write(`\nALL ${passed} UNIT SUITES (${skipped} skipped: network required) + 1 CORPUS GATE PASS\n`);
    } else {
      process.stdout.write(`\nALL ${passed} UNIT SUITES + 1 CORPUS GATE PASS\n`);
    }
    process.exit(0);
  } finally {
    if (spawnedSidecar && !spawnedSidecar.killed) {
      try {
        spawnedSidecar.kill('SIGTERM');
      } catch (_) {}
    }
  }
}

main().catch((err) => {
  process.stderr.write(`\nFATAL TEST RUNNER ERROR: ${err.message}\n`);
  process.exit(1);
});
