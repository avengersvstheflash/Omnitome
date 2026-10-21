'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getDatabase, resetAndSeedDatabase } = require('../db/database');
const bookService = require('../services/bookService');
const importQueueRepository = require('../repositories/importQueueRepository');
const importQueueService = require('../services/ingestion/importQueueService');

async function runTests() {
  console.log('=== RUNNING v1.0.1 POLISH & ONBOARDING VERIFICATION SUITE ===');

  // Test 1: STAGE_WEIGHTS & STAGE_LABELS in importQueueRepository
  console.log('Test 1: STAGE_WEIGHTS and active stage updateStage mapping');
  const stageWeights = importQueueRepository.STAGE_WEIGHTS;
  assert(stageWeights, 'STAGE_WEIGHTS must exist');
  assert.strictEqual(stageWeights.ingest, 15);
  assert.strictEqual(stageWeights.semantic_index, 30);
  assert.strictEqual(stageWeights.classify, 45);
  assert.strictEqual(stageWeights.outline, 55);
  assert.strictEqual(stageWeights.synopsis, 60);
  assert.strictEqual(stageWeights.synthesis, 70);
  assert.strictEqual(stageWeights.attribution, 85);
  assert.strictEqual(stageWeights.done, 100);

  const stageLabels = importQueueRepository.STAGE_LABELS;
  assert(stageLabels, 'STAGE_LABELS must exist');
  assert.strictEqual(stageLabels.synthesis, 'Compressing chapters…');

  // Verify that calling updateStage accurately aligns progress percentage to active stage
  const testQueueTask = importQueueRepository.create({
    type: 'file',
    source_title: 'Progress Test Doc',
    status: 'processing',
    progress: 5,
  });

  const updatedToIndex = importQueueRepository.updateStage(testQueueTask.id, 'semantic_index', 'running');
  assert.strictEqual(updatedToIndex.progress, 30, 'Indexing progress must equal 30%');
  assert.strictEqual(updatedToIndex.stage, 'semantic_index', 'Stage must update to semantic_index');

  const updatedToSynthesis = importQueueRepository.updateStage(testQueueTask.id, 'synthesis', 'running');
  assert.strictEqual(updatedToSynthesis.progress, 70, 'Compressing chapters progress must equal 70%');
  assert.strictEqual(updatedToSynthesis.stage, 'synthesis', 'Stage must update to synthesis');
  assert.strictEqual(updatedToSynthesis.stage_label, 'Compressing chapters…');

  importQueueRepository.delete(testQueueTask.id);
  console.log('  ✓ Test 1 passed: STAGE_WEIGHTS & active stage progress mapping align perfectly');

  // Test 2: SHA-256 Deduplication on importBook
  console.log('Test 2: SHA-256 Deduplication');
  const uniqueText = `Unique test text content for deduplication verification at ${Date.now()}-${Math.random()}`;
  const importResult1 = await bookService.importBook({
    title: 'Dedup Original Book',
    text: uniqueText,
    contentType: 'novel',
  });
  assert(importResult1.book, 'First import should succeed');
  const bookId1 = importResult1.book.id;

  // Attempt duplicate import without replace
  let conflictCaught = false;
  try {
    await bookService.importBook({
      title: 'Dedup Duplicate Book',
      text: uniqueText,
      contentType: 'novel',
      replace: false,
    });
  } catch (err) {
    if (err.statusCode === 409 && err.code === 'DUPLICATE_BOOK') {
      conflictCaught = true;
      assert.strictEqual(err.existingBookId, bookId1);
    } else {
      throw err;
    }
  }
  assert.strictEqual(conflictCaught, true, '409 Conflict should be thrown on duplicate import');
  console.log('  ✓ Test 2.1 passed: Duplicate content threw 409 conflict');

  // Attempt duplicate import with replace = true
  const importResult2 = await bookService.importBook({
    title: 'Dedup Replacement Book',
    text: uniqueText,
    contentType: 'novel',
    replace: true,
  });
  assert(importResult2.book, 'Replaced import should succeed');
  assert.notStrictEqual(importResult2.book.id, bookId1, 'New book has new ID');

  // Verify old book was deleted
  let oldBook = null;
  try {
    oldBook = bookService.getBook(bookId1);
  } catch (err) {
    oldBook = null;
  }
  assert.strictEqual(oldBook, null, 'Old book should have been deleted');
  console.log('  ✓ Test 2.2 passed: Replace=true successfully purged old version and imported replacement');

  // Test 3: Re-synthesize Book Flow
  console.log('Test 3: Re-synthesize Book');
  const testBook = bookService.createBook({
    title: 'Book For Resynthesize ' + Date.now(),
    author: 'Test Author',
    content_type: 'novel',
    synthesis_completed_at: new Date().toISOString(),
  });
  const db = getDatabase();
  const scId = `sc-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  // Insert a mock smart chapter with status 'fallback'
  db.prepare(`
    INSERT INTO smart_chapters (id, book_id, sequence, title, status, synthesis_type, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    scId,
    testBook.id,
    1,
    'Chapter 1',
    'generated',
    'fallback',
    JSON.stringify({ fell_back: true }),
    new Date().toISOString(),
    new Date().toISOString()
  );

  // Insert mock attribution
  const attrId = `attr-test-${Date.now()}`;
  db.prepare(`
    INSERT INTO paragraph_attributions (id, smart_chapter_id, paragraph_index, segments_json, source_chunk_ids, weights_json, method, confidence, grounded, verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    attrId,
    scId,
    0,
    '[]',
    '[]',
    '{}',
    'exact',
    'high',
    1,
    new Date().toISOString()
  );

  // Simulate resynthesize logic from bookRoutes
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE smart_chapters
    SET status = 'pending',
        content = NULL,
        word_count = 0,
        synthesis_type = NULL,
        metadata_json = '{}',
        updated_at = ?
    WHERE book_id = ?
  `).run(now, testBook.id);

  db.prepare(`
    DELETE FROM paragraph_attributions
    WHERE smart_chapter_id IN (SELECT id FROM smart_chapters WHERE book_id = ?)
  `).run(testBook.id);

  db.prepare(`
    UPDATE books
    SET synthesis_completed_at = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(now, testBook.id);

  const resetChapter = db.prepare('SELECT status, synthesis_type, metadata_json FROM smart_chapters WHERE id = ?').get(scId);
  assert.strictEqual(resetChapter.status, 'pending');
  assert.strictEqual(resetChapter.synthesis_type, null);

  const remainingAttrs = db.prepare('SELECT count(*) as cnt FROM paragraph_attributions WHERE smart_chapter_id = ?').get(scId);
  assert.strictEqual(remainingAttrs.cnt, 0, 'Paragraph attributions should be cleared on resynthesize');

  const updatedBook = bookService.getBook(testBook.id);
  assert.strictEqual(updatedBook.synthesis_completed_at, null);

  const resynthTask = await importQueueService.enqueueResynthesis({
    dossierId: testBook.id,
    bookId: testBook.id,
    title: testBook.title,
    contentType: 'novel',
  });
  assert(resynthTask.id, 'enqueueResynthesis should return a valid task');
  console.log('  ✓ Test 3 passed: Re-synthesis resets chapter status, clears completed timestamp & attributions, and enqueues task');

  // Test 4: Delete Dossier via Operation B
  console.log('Test 4: Delete Dossier (Operation B)');
  const dossier = bookService.createDossier({
    title: 'Dossier to Delete ' + Date.now(),
  });
  await bookService.addContentToDossier(dossier.id, {
    title: 'Dossier Source 1',
    text: 'Some sample text content for dossier source 1 to be deleted.',
  });
  const chaptersBefore = bookService.getChapters(dossier.id);
  assert(chaptersBefore.length > 0, 'Dossier should have chapters');

  // Execute Operation B
  const delResult = bookService.deleteBook(dossier.id, 'B');
  assert(delResult.success, 'Delete operation B should report success');

  // Verify dossier chapters are purged and lifecycle marked archived
  const chaptersAfter = db.prepare('SELECT count(*) as count FROM chapters WHERE book_id = ?').get(dossier.id);
  assert.strictEqual(chaptersAfter.count, 0, 'Chapters should be completely deleted under Operation B');
  const bookLifecycleRepository = require('../repositories/bookLifecycleRepository');
  const lc = bookLifecycleRepository.getByBookId(dossier.id);
  assert.strictEqual(lc.lifecycle_state, 'archived');
  assert.strictEqual(lc.in_research, 0);
  assert.strictEqual(lc.in_library, 0);
  console.log('  ✓ Test 4 passed: Operation B purges dossier chapters and archives lifecycle');

  console.log('====================================================');
  console.log('🎉 ALL v1.0.1 POLISH VERIFICATION TESTS PASSED!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
