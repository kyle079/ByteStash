import snippetService from '../services/snippetService.js';

/**
 * @param {number} userId - authenticated user ID from req.user.id
 * @param {object} service - snippetService (injectable for testing)
 */
export function createHandlers(userId, service = snippetService) {
  return {
    search_snippets: async ({ query, search_code, language, categories, limit = 20 }) => {
      try {
        const { snippets } = await service.getSnippetsPaginated({
          userId,
          filters: {
            search: query || null,
            searchCode: search_code || false,
            language: language || null,
            categories: categories ? categories.map((c) => c.toLowerCase()) : null,
            favorites: false,
            pinned: false,
            recycled: false,
          },
          sort: 'newest',
          limit,
          offset: 0,
        });

        const summaries = snippets.map(
          ({ id, title, description, categories, updated_at, is_pinned, is_favorite }) => ({
            id,
            title,
            description,
            categories,
            updated_at,
            is_pinned: Boolean(is_pinned),
            is_favorite: Boolean(is_favorite),
          })
        );

        return { content: [{ type: 'text', text: JSON.stringify(summaries, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    },

    get_snippet: async ({ id }) => {
      try {
        const snippet = await service.findById(id, userId);
        if (!snippet) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: `Snippet ${id} not found` }) }],
            isError: true,
          };
        }
        return { content: [{ type: 'text', text: JSON.stringify(snippet, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    },

    create_snippet: async ({ title, description, fragments, categories, is_public }) => {
      try {
        const snippet = await service.createSnippet(
          {
            title,
            description: description || '',
            fragments,
            categories: categories || [],
            is_public: is_public || false,
          },
          userId
        );
        return { content: [{ type: 'text', text: JSON.stringify(snippet, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    },

    update_snippet: async ({ id, title, description, fragments, categories, is_public }) => {
      try {
        const snippet = await service.updateSnippet(
          id,
          {
            title,
            description: description || '',
            fragments,
            categories: categories || [],
            is_public: is_public || false,
          },
          userId
        );
        if (!snippet) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: `Snippet ${id} not found` }) }],
            isError: true,
          };
        }
        return { content: [{ type: 'text', text: JSON.stringify(snippet, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    },

    delete_snippet: async ({ id }) => {
      try {
        const result = await service.moveToRecycle(id, userId);
        if (!result) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: `Snippet ${id} not found` }) }],
            isError: true,
          };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ id: result.id }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    },

    list_metadata: async () => {
      try {
        const metadata = await service.getMetadata(userId);
        return { content: [{ type: 'text', text: JSON.stringify(metadata, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    },
  };
}
