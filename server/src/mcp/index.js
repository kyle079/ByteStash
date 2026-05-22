import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { toolDefinitions } from './tools.js';
import { createHandlers } from './handlers.js';
import Logger from '../logger.js';

const router = express.Router();

// In-process session store — adequate for single-process self-hosted deployment.
const sessions = {};

function createMcpServer(userId) {
  const server = new McpServer({ name: 'bytestash', version: '1.0.0' });
  const handlers = createHandlers(userId);
  for (const { name, description, inputSchema } of toolDefinitions) {
    server.registerTool(name, { description, inputSchema }, handlers[name]);
  }
  return server;
}

router.post('/', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'];

    if (sessionId && sessions[sessionId]) {
      try {
        await sessions[sessionId].handleRequest(req, res, req.body);
      } catch (err) {
        Logger.error(`MCP session ${sessionId} handleRequest error:`, err);
        delete sessions[sessionId];
        if (!res.headersSent) {
          res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
        }
      }
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      if (!req.user) {
        return res.status(401).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Unauthorized' }, id: null });
      }
      const userId = req.user.id;
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          sessions[sid] = transport;
          Logger.debug(`MCP session initialized: ${sid} for user ${userId}`);
        },
      });

      // onclose handles transport-initiated closes (e.g., client disconnect)
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions[sid]) {
          delete sessions[sid];
          Logger.debug(`MCP session closed: ${sid}`);
        }
      };

      const server = createMcpServer(userId);
      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (err) {
        Logger.error('MCP initialize error:', err);
        await transport.close().catch(() => {});
        if (!res.headersSent) {
          res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
        }
      }
      return;
    }

    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: sessionId ? 'Session not found or expired' : 'Bad Request: expected initialize request',
      },
      id: null,
    });
  } catch (error) {
    Logger.error('MCP POST error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

router.get('/', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Invalid or missing session ID' }, id: null });
    return;
  }
  try {
    await sessions[sessionId].handleRequest(req, res);
  } catch (err) {
    Logger.error(`MCP GET session ${sessionId} error:`, err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    } else {
      res.end();
    }
  }
});

router.delete('/', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Invalid or missing session ID' }, id: null });
    return;
  }
  try {
    await sessions[sessionId].handleRequest(req, res);
  } finally {
    // Explicit cleanup in addition to onclose — ensures removal even if transport doesn't fire onclose on DELETE
    delete sessions[sessionId];
  }
});

export default router;
