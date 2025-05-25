#!/usr/bin/env node
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { TrelloClient } from './trello-client.js';
import { createServer } from 'http';
import {
  validateGetCardsListRequest,
  validateGetRecentActivityRequest,
  validateAddCardRequest,
  validateUpdateCardRequest,
  validateArchiveCardRequest,
  validateAddListRequest,
  validateArchiveListRequest,
  validateCreateBoardRequest,
  validateGetBoardsRequest,
  validateAddMemberRequest,
} from './validators.js';

class TrelloServer {
  private server: Server;
  private trelloClient: TrelloClient;

  constructor() {
    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;
    const boardId = process.env.TRELLO_BOARD_ID;
    const organizationId = process.env.TRELLO_ORG_ID;

    if (!apiKey || !token || !boardId) {
      throw new Error('TRELLO_API_KEY, TRELLO_TOKEN, and TRELLO_BOARD_ID environment variables are required');
    }

    this.trelloClient = new TrelloClient({ apiKey, token, boardId, organizationId });

    this.server = new Server(
      {
        name: 'dwb-trello-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupHealthCheck();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_cards_by_list_id',
          description: 'Fetch cards from a specific Trello list',
          inputSchema: {
            type: 'object',
            properties: {
              listId: {
                type: 'string',
                description: 'ID of the Trello list',
              },
            },
            required: ['listId'],
          },
        },
        {
          name: 'get_lists',
          description: 'Retrieve all lists from the specified board',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'get_recent_activity',
          description: 'Fetch recent activity on the Trello board',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Number of activities to fetch (default: 10)',
              },
            },
            required: [],
          },
        },
        {
          name: 'add_card_to_list',
          description: 'Add a new card to a specified list',
          inputSchema: {
            type: 'object',
            properties: {
              listId: {
                type: 'string',
                description: 'ID of the list to add the card to',
              },
              name: {
                type: 'string',
                description: 'Name of the card',
              },
              description: {
                type: 'string',
                description: 'Description of the card',
              },
              dueDate: {
                type: 'string',
                description: 'Due date for the card (ISO 8601 format)',
              },
              labels: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Array of label IDs to apply to the card',
              },
            },
            required: ['listId', 'name'],
          },
        },
        {
          name: 'update_card_details',
          description: 'Update an existing card\'s details',
          inputSchema: {
            type: 'object',
            properties: {
              cardId: {
                type: 'string',
                description: 'ID of the card to update',
              },
              name: {
                type: 'string',
                description: 'New name for the card',
              },
              description: {
                type: 'string',
                description: 'New description for the card',
              },
              dueDate: {
                type: 'string',
                description: 'New due date for the card (ISO 8601 format)',
              },
              labels: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'New array of label IDs for the card',
              },
            },
            required: ['cardId'],
          },
        },
        {
          name: 'archive_card',
          description: 'Send a card to the archive',
          inputSchema: {
            type: 'object',
            properties: {
              cardId: {
                type: 'string',
                description: 'ID of the card to archive',
              },
            },
            required: ['cardId'],
          },
        },
        {
          name: 'add_list_to_board',
          description: 'Add a new list to the board',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the new list',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'archive_list',
          description: 'Send a list to the archive',
          inputSchema: {
            type: 'object',
            properties: {
              listId: {
                type: 'string',
                description: 'ID of the list to archive',
              },
            },
            required: ['listId'],
          },
        },
        {
          name: 'get_my_cards',
          description: 'Fetch all cards assigned to the current user',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'create_board',
          description: 'Creates a new Trello board with standard client onboarding template',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Board name',
              },
              description: {
                type: 'string',
                description: 'Board description (optional, uses README template if not provided)',
              },
              default_lists: {
                type: 'boolean',
                description: 'Create default list template (default: true)',
              },
              organization_id: {
                type: 'string',
                description: 'Organization ID (optional, uses TRELLO_ORG_ID env var if not provided)',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'get_boards',
          description: 'Lists available Trello boards',
          inputSchema: {
            type: 'object',
            properties: {
              organization_id: {
                type: 'string',
                description: 'Filter by organization (optional)',
              },
              limit: {
                type: 'number',
                description: 'Max boards to return (optional)',
              },
            },
            required: [],
          },
        },
        {
          name: 'add_member_to_board',
          description: 'Adds a member to a board by email with specified permissions',
          inputSchema: {
            type: 'object',
            properties: {
              board_id: {
                type: 'string',
                description: 'Board ID',
              },
              email: {
                type: 'string',
                description: 'Member email address',
              },
              permission: {
                type: 'string',
                enum: ['normal', 'admin', 'observer'],
                description: 'Member permission level (default: normal)',
              },
            },
            required: ['board_id', 'email'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        if (!request.params.arguments) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing arguments');
        }

        const args = request.params.arguments as Record<string, unknown>;

        switch (request.params.name) {
          case 'get_cards_by_list_id': {
            const validArgs = validateGetCardsListRequest(args);
            const cards = await this.trelloClient.getCardsByList(validArgs.listId);
            return {
              content: [{ type: 'text', text: JSON.stringify(cards, null, 2) }],
            };
          }

          case 'get_lists': {
            const lists = await this.trelloClient.getLists();
            return {
              content: [{ type: 'text', text: JSON.stringify(lists, null, 2) }],
            };
          }

          case 'get_recent_activity': {
            const validArgs = validateGetRecentActivityRequest(args);
            const activity = await this.trelloClient.getRecentActivity(validArgs.limit);
            return {
              content: [{ type: 'text', text: JSON.stringify(activity, null, 2) }],
            };
          }

          case 'add_card_to_list': {
            const validArgs = validateAddCardRequest(args);
            const card = await this.trelloClient.addCard(validArgs);
            return {
              content: [{ type: 'text', text: JSON.stringify(card, null, 2) }],
            };
          }

          case 'update_card_details': {
            const validArgs = validateUpdateCardRequest(args);
            const card = await this.trelloClient.updateCard(validArgs);
            return {
              content: [{ type: 'text', text: JSON.stringify(card, null, 2) }],
            };
          }

          case 'archive_card': {
            const validArgs = validateArchiveCardRequest(args);
            const card = await this.trelloClient.archiveCard(validArgs.cardId);
            return {
              content: [{ type: 'text', text: JSON.stringify(card, null, 2) }],
            };
          }

          case 'add_list_to_board': {
            const validArgs = validateAddListRequest(args);
            const list = await this.trelloClient.addList(validArgs.name);
            return {
              content: [{ type: 'text', text: JSON.stringify(list, null, 2) }],
            };
          }

          case 'archive_list': {
            const validArgs = validateArchiveListRequest(args);
            const list = await this.trelloClient.archiveList(validArgs.listId);
            return {
              content: [{ type: 'text', text: JSON.stringify(list, null, 2) }],
            };
          }

          case 'get_my_cards': {
            const cards = await this.trelloClient.getMyCards();
            return {
              content: [{ type: 'text', text: JSON.stringify(cards, null, 2) }],
            };
          }

          case 'create_board': {
            const validArgs = validateCreateBoardRequest(args);
            const board = await this.trelloClient.createBoard(validArgs);
            return {
              content: [{ type: 'text', text: JSON.stringify(board, null, 2) }],
            };
          }

          case 'get_boards': {
            const validArgs = validateGetBoardsRequest(args);
            const boards = await this.trelloClient.getBoards(validArgs);
            return {
              content: [{ type: 'text', text: JSON.stringify(boards, null, 2) }],
            };
          }

          case 'add_member_to_board': {
            const validArgs = validateAddMemberRequest(args);
            const member = await this.trelloClient.addMemberToBoard(validArgs);
            return {
              content: [{ type: 'text', text: JSON.stringify(member, null, 2) }],
            };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : 'Unknown error occurred',
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupHealthCheck() {
    const port = process.env.HEALTH_CHECK_PORT || 3001;
    
    const healthServer = createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '0.1.0',
          uptime: process.uptime(),
          service: 'dwb-trello-mcp'
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
    });

    healthServer.listen(port, () => {
      console.error(`Health check server running on port ${port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      healthServer.close(() => {
        console.error('Health check server closed');
      });
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Trello MCP server running on stdio');
  }
}

const server = new TrelloServer();
server.run().catch(console.error);
