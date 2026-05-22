import { z } from 'zod';

export const toolDefinitions = [
  {
    name: 'search_snippets',
    description:
      'Search your snippets by keyword, language, or category. Returns summary list without code content — use get_snippet to retrieve code fragments.',
    inputSchema: {
      query: z.string().optional().describe('Search term matched against title and description'),
      search_code: z.boolean().optional().describe('Also search inside code fragment content'),
      language: z.string().optional().describe('Filter by programming language (e.g. "javascript", "python")'),
      categories: z
        .array(z.string())
        .optional()
        .describe('Filter by categories — all listed categories must match (AND logic)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Max results to return (default 20, max 100)'),
    },
  },
  {
    name: 'get_snippet',
    description: 'Fetch a single snippet by ID, including all code fragments with their content.',
    inputSchema: {
      id: z.number().int().describe('Snippet ID'),
    },
  },
  {
    name: 'create_snippet',
    description: 'Save a new code snippet. At least one fragment (code file) is required.',
    inputSchema: {
      title: z.string().describe('Snippet title'),
      description: z.string().optional().describe('Optional description'),
      fragments: z
        .array(
          z.object({
            file_name: z.string().describe('File name (e.g. "index.js")'),
            code: z.string().describe('Code content'),
            language: z.string().describe('Programming language (e.g. "javascript")'),
          })
        )
        .min(1)
        .describe('Code fragments — at least one required. Multi-file snippets have multiple fragments.'),
      categories: z.array(z.string()).optional().describe('Category tags'),
      is_public: z.boolean().optional().describe('Make publicly visible (default false)'),
    },
  },
  {
    name: 'update_snippet',
    description:
      'Replace an existing snippet. All fragments are replaced atomically — include every fragment you want to keep.',
    inputSchema: {
      id: z.number().int().describe('ID of the snippet to update'),
      title: z.string().describe('Snippet title'),
      description: z.string().optional().describe('Optional description'),
      fragments: z
        .array(
          z.object({
            file_name: z.string().describe('File name'),
            code: z.string().describe('Code content'),
            language: z.string().describe('Programming language'),
          })
        )
        .min(1)
        .describe('Replacement fragments — all existing fragments are removed and replaced by this list'),
      categories: z.array(z.string()).optional().describe('Category tags'),
      is_public: z.boolean().optional().describe('Make publicly visible'),
    },
  },
  {
    name: 'delete_snippet',
    description:
      'Move a snippet to the recycle bin. It is permanently deleted after 30 days. Use this instead of hard-deleting.',
    inputSchema: {
      id: z.number().int().describe('Snippet ID to delete'),
    },
  },
  {
    name: 'list_metadata',
    description:
      'Get all available categories and languages across your snippets, plus total count. Use this to discover filter values before calling search_snippets.',
    inputSchema: {},
  },
];
