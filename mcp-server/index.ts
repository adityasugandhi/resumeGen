#!/usr/bin/env node

/**
 * Resume Editor MCP Server
 *
 * Main entry point for the Model Context Protocol server
 * Provides AI-powered tools, resources, and prompts for LaTeX resume editing
 */

import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { MCPConfig } from './config';

// Import tool registration functions
import {
  registerFileOperationTools,
  registerLatexOperationTools,
  registerAIOperationTools,
  registerKnowledgeOperationTools
} from './tools';

// Import resource registration function
import { registerResources } from './resources';

// Import prompt registration function
import { registerPrompts } from './prompts';

// Import integration clients
import { getFileSystemClient, getAPIClient } from './integrations';

/**
 * Initialize the file system client
 */
async function initializeFileSystem(): Promise<void> {
  try {
    const fileClient = getFileSystemClient();
    await fileClient.initialize();
    console.log(`✓ File system initialized at: ${fileClient.getBaseDir()}`);
  } catch (error) {
    console.error('Failed to initialize file system:', error);
    throw error;
  }
}

/**
 * Check connectivity to Next.js API
 */
async function checkAPIConnectivity(): Promise<void> {
  try {
    const apiClient = getAPIClient();
    const isConnected = await apiClient.testConnection();

    if (isConnected) {
      console.log(`✓ Connected to Next.js API at: ${apiClient.getBaseUrl()}`);
    } else {
      console.warn(`⚠ Cannot connect to Next.js API at: ${apiClient.getBaseUrl()}`);
      console.warn('  Make sure Next.js dev server is running (npm run dev)');
      console.warn('  LaTeX compilation features will not work until the API is available');
    }
  } catch (error) {
    console.warn('⚠ Error checking API connectivity:', error);
  }
}

/**
 * Create and configure the MCP server
 */
function createMCPServer(): McpServer {
  const server = new McpServer({
    name: MCPConfig.server.name,
    version: MCPConfig.server.version
  });

  // Register all tools
  console.log('Registering tools...');
  registerFileOperationTools(server);
  registerLatexOperationTools(server);
  registerAIOperationTools(server);
  registerKnowledgeOperationTools(server);
  console.log('✓ Tools registered');

  // Register all resources
  console.log('Registering resources...');
  registerResources(server);
  console.log('✓ Resources registered');

  // Register all prompts
  console.log('Registering prompts...');
  registerPrompts(server);
  console.log('✓ Prompts registered');

  return server;
}

/**
 * Start the MCP server
 */
async function startServer(): Promise<void> {
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Resume Editor MCP Server v${MCPConfig.server.version}`);
  console.log('═══════════════════════════════════════════════════\n');

  // Initialize file system
  await initializeFileSystem();

  // Check API connectivity
  await checkAPIConnectivity();

  // Create MCP server
  const mcpServer = createMCPServer();

  // Create Express app
  const app = express();

  // Enable CORS if configured
  if (MCPConfig.features.enableCORS) {
    app.use(cors({
      origin: '*',
      exposedHeaders: ['Mcp-Session-Id'],
      allowedHeaders: ['Content-Type', 'mcp-session-id']
    }));
  }

  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      server: MCPConfig.server.name,
      version: MCPConfig.server.version,
      timestamp: new Date().toISOString()
    });
  });

  // MCP endpoint
  app.post('/mcp', async (req, res) => {
    try {
      // Create a new transport for each request to prevent request ID collisions
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
      });

      res.on('close', () => {
        transport.close();
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          },
          id: null
        });
      }
    }
  });

  // Handle other MCP-related requests
  app.all('/mcp', (req, res) => {
    res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are supported on the /mcp endpoint'
    });
  });

  // Start listening
  const port = MCPConfig.network.port;
  const host = MCPConfig.network.host;

  app.listen(port, host, () => {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  Server Running');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  HTTP: http://${host}:${port}`);
    console.log(`  MCP:  http://${host}:${port}/mcp`);
    console.log('───────────────────────────────────────────────────');
    console.log('\n📚 Available Features:');
    console.log('  • File Operations: create, update, delete, rename, pin');
    console.log('  • LaTeX Operations: compile, validate, export');
    console.log('  • AI Analysis: resume review, optimization, tailoring');
    console.log('  • Knowledge Base: search projects, RAG tailoring, indexing');
    console.log('  • Resources: templates, file access, system status');
    console.log('  • Prompts: resume review, section improvement, error fixing');
    console.log('\n🔧 Testing:');
    console.log(`  • Health: http://${host}:${port}/health`);
    console.log('  • MCP Inspector: npx @modelcontextprotocol/inspector http://localhost:3001/mcp');
    console.log(`  • Claude Code: claude mcp add --transport http resume-mcp http://${host}:${port}/mcp`);
    console.log('\n💡 Make sure Next.js is running on port 3000 for LaTeX compilation');
    console.log('   Run: npm run dev (in another terminal)\n');
  }).on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${port} is already in use`);
      console.error('   Try stopping the other process or use a different port:');
      console.error(`   MCP_PORT=3002 npm run mcp:dev\n`);
    } else {
      console.error('\n❌ Server error:', error);
    }
    process.exit(1);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down MCP server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down MCP server...');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
