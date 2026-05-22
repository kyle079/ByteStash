import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHandlers } from './handlers.js';

const TEST_USER_ID = 42;

const mockSnippet = {
  id: 1,
  title: 'Test Snippet',
  description: 'A test',
  categories: ['utils'],
  updated_at: '2026-01-01T00:00:00Z',
  is_pinned: 0,
  is_favorite: 0,
  fragments: [
    { id: 10, file_name: 'index.js', code: 'console.log("hi")', language: 'javascript', position: 0 },
  ],
};

const mockService = {
  getSnippetsPaginated: async ({ limit }) => ({
    snippets: [{ ...mockSnippet, share_count: 0 }],
    total: 1,
  }),
  findById: async (id, userId) =>
    id === 1 && userId === TEST_USER_ID ? mockSnippet : null,
  createSnippet: async (data, userId) => ({ id: 99, ...data, user_id: userId }),
  updateSnippet: async (id, data, userId) =>
    id === 1 && userId === TEST_USER_ID ? { id, ...data } : null,
  moveToRecycle: async (id, userId) =>
    id === 1 && userId === TEST_USER_ID ? { id } : null,
  getMetadata: async () => ({
    categories: ['utils', 'scripts'],
    languages: ['javascript', 'python'],
    counts: { total: 5 },
  }),
};

const DB_ERROR = new Error('DB connection failed');

const throwingService = {
  getSnippetsPaginated: async () => { throw DB_ERROR; },
  findById: async () => { throw DB_ERROR; },
  createSnippet: async () => { throw DB_ERROR; },
  updateSnippet: async () => { throw DB_ERROR; },
  moveToRecycle: async () => { throw DB_ERROR; },
  getMetadata: async () => { throw DB_ERROR; },
};

describe('createHandlers', () => {
  const handlers = createHandlers(TEST_USER_ID, mockService);

  describe('search_snippets', () => {
    test('returns JSON array of summaries', async () => {
      const result = await handlers.search_snippets({});
      assert.equal(result.content[0].type, 'text');
      const data = JSON.parse(result.content[0].text);
      assert.ok(Array.isArray(data));
      assert.equal(data[0].id, 1);
      assert.equal(data[0].title, 'Test Snippet');
      assert.equal(data[0].fragments, undefined, 'fragments must be stripped from search results');
    });

    test('passes limit to service', async () => {
      let capturedLimit;
      const capturingService = {
        ...mockService,
        getSnippetsPaginated: async ({ limit }) => { capturedLimit = limit; return { snippets: [], total: 0 }; },
      };
      await createHandlers(TEST_USER_ID, capturingService).search_snippets({ limit: 10 });
      assert.equal(capturedLimit, 10);
    });

    test('lowercases categories before passing to service', async () => {
      let capturedCategories;
      const capturingService = {
        ...mockService,
        getSnippetsPaginated: async ({ filters }) => { capturedCategories = filters.categories; return { snippets: [], total: 0 }; },
      };
      await createHandlers(TEST_USER_ID, capturingService).search_snippets({ categories: ['Utils', 'SCRIPTS'] });
      assert.deepEqual(capturedCategories, ['utils', 'scripts']);
    });
  });

  describe('get_snippet', () => {
    test('returns full snippet when found', async () => {
      const result = await handlers.get_snippet({ id: 1 });
      assert.equal(result.isError, undefined);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.id, 1);
      assert.ok(Array.isArray(data.fragments));
    });

    test('returns isError when not found', async () => {
      const result = await handlers.get_snippet({ id: 999 });
      assert.equal(result.isError, true);
    });
  });

  describe('create_snippet', () => {
    test('returns created snippet with id', async () => {
      const result = await handlers.create_snippet({
        title: 'New',
        fragments: [{ file_name: 'a.js', code: 'x', language: 'javascript' }],
      });
      assert.equal(result.isError, undefined);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.id, 99);
    });
  });

  describe('update_snippet', () => {
    test('returns updated snippet when found', async () => {
      const result = await handlers.update_snippet({
        id: 1,
        title: 'Updated',
        fragments: [{ file_name: 'a.js', code: 'y', language: 'javascript' }],
      });
      assert.equal(result.isError, undefined);
    });

    test('returns isError when not found', async () => {
      const result = await handlers.update_snippet({
        id: 999,
        title: 'X',
        fragments: [{ file_name: 'a.js', code: 'x', language: 'javascript' }],
      });
      assert.equal(result.isError, true);
    });
  });

  describe('delete_snippet', () => {
    test('returns id on success', async () => {
      const result = await handlers.delete_snippet({ id: 1 });
      assert.equal(result.isError, undefined);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.id, 1);
    });

    test('returns isError when not found', async () => {
      const result = await handlers.delete_snippet({ id: 999 });
      assert.equal(result.isError, true);
    });
  });

  describe('list_metadata', () => {
    test('returns categories, languages, and counts', async () => {
      const result = await handlers.list_metadata({});
      const data = JSON.parse(result.content[0].text);
      assert.ok(Array.isArray(data.categories));
      assert.ok(Array.isArray(data.languages));
      assert.ok(typeof data.counts.total === 'number');
    });
  });

  describe('error handling', () => {
    const errorHandlers = createHandlers(TEST_USER_ID, throwingService);

    test('search_snippets returns isError and JSON error when service throws', async () => {
      const result = await errorHandlers.search_snippets({});
      assert.equal(result.isError, true);
      const data = JSON.parse(result.content[0].text);
      assert.equal(typeof data.error, 'string');
      assert.ok(data.error.length > 0);
    });

    test('get_snippet returns isError and JSON error when service throws', async () => {
      const result = await errorHandlers.get_snippet({ id: 1 });
      assert.equal(result.isError, true);
      const data = JSON.parse(result.content[0].text);
      assert.equal(typeof data.error, 'string');
      assert.ok(data.error.length > 0);
    });

    test('create_snippet returns isError and JSON error when service throws', async () => {
      const result = await errorHandlers.create_snippet({
        title: 'X',
        fragments: [{ file_name: 'a.js', code: 'x', language: 'javascript' }],
      });
      assert.equal(result.isError, true);
      const data = JSON.parse(result.content[0].text);
      assert.equal(typeof data.error, 'string');
      assert.ok(data.error.length > 0);
    });

    test('update_snippet returns isError and JSON error when service throws', async () => {
      const result = await errorHandlers.update_snippet({
        id: 1,
        title: 'X',
        fragments: [{ file_name: 'a.js', code: 'x', language: 'javascript' }],
      });
      assert.equal(result.isError, true);
      const data = JSON.parse(result.content[0].text);
      assert.equal(typeof data.error, 'string');
      assert.ok(data.error.length > 0);
    });

    test('delete_snippet returns isError and JSON error when service throws', async () => {
      const result = await errorHandlers.delete_snippet({ id: 1 });
      assert.equal(result.isError, true);
      const data = JSON.parse(result.content[0].text);
      assert.equal(typeof data.error, 'string');
      assert.ok(data.error.length > 0);
    });

    test('list_metadata returns isError and JSON error when service throws', async () => {
      const result = await errorHandlers.list_metadata({});
      assert.equal(result.isError, true);
      const data = JSON.parse(result.content[0].text);
      assert.equal(typeof data.error, 'string');
      assert.ok(data.error.length > 0);
    });
  });
});
