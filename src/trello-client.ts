import axios, { AxiosInstance } from 'axios';
import { TrelloConfig, TrelloCard, TrelloList, TrelloAction, TrelloMember, TrelloBoard, CreateBoardParams, AddMemberParams, GetBoardsParams } from './types.js';
import { createTrelloRateLimiters } from './rate-limiter.js';
import { BoardTemplateEngine } from './board-templates.js';

export class TrelloClient {
  private axiosInstance: AxiosInstance;
  private rateLimiter;
  private templateEngine: BoardTemplateEngine;

  constructor(private config: TrelloConfig) {
    this.axiosInstance = axios.create({
      baseURL: 'https://api.trello.com/1',
      params: {
        key: config.apiKey,
        token: config.token,
      },
    });

    this.rateLimiter = createTrelloRateLimiters();
    this.templateEngine = new BoardTemplateEngine();

    // Add rate limiting interceptor
    this.axiosInstance.interceptors.request.use(async (config) => {
      await this.rateLimiter.waitForAvailable();
      return config;
    });
  }

  private async handleRequest<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          // Rate limit exceeded, wait and retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.handleRequest(request);
        }
        throw new Error(`Trello API error: ${error.response?.data?.message ?? error.message}`);
      }
      throw error;
    }
  }

  async getCardsByList(listId: string): Promise<TrelloCard[]> {
    return this.handleRequest(async () => {
      const response = await this.axiosInstance.get(`/lists/${listId}/cards`);
      return response.data;
    });
  }

  async getLists(): Promise<TrelloList[]> {
    return this.handleRequest(async () => {
      const response = await this.axiosInstance.get(`/boards/${this.config.boardId}/lists`);
      return response.data;
    });
  }

  async getRecentActivity(limit: number = 10): Promise<TrelloAction[]> {
    return this.handleRequest(async () => {
      const response = await this.axiosInstance.get(`/boards/${this.config.boardId}/actions`, {
        params: { limit },
      });
      return response.data;
    });
  }

  async addCard(params: {
    listId: string;
    name: string;
    description?: string;
    dueDate?: string;
    labels?: string[];
  }): Promise<TrelloCard> {
    return this.handleRequest(async () => {
      const response = await this.axiosInstance.post('/cards', {
        idList: params.listId,
        name: params.name,
        desc: params.description,
        due: params.dueDate,
        idLabels: params.labels,
      });
      return response.data;
    });
  }

  async updateCard(params: {
    cardId: string;
    name?: string;
    description?: string;
    dueDate?: string;
    labels?: string[];
  }): Promise<TrelloCard> {
    return this.handleRequest(async () => {
      const response = await this.axiosInstance.put(`/cards/${params.cardId}`, {
        name: params.name,
        desc: params.description,
        due: params.dueDate,
        idLabels: params.labels,
      });
      return response.data;
    });
  }

  async archiveCard(cardId: string): Promise<TrelloCard> {
    return this.handleRequest(async () => {
      const response = await this.axiosInstance.put(`/cards/${cardId}`, {
        closed: true,
      });
      return response.data;
    });
  }

  async addList(name: string): Promise<TrelloList> {
    return this.handleRequest(async () => {
      const response = await this.axiosInstance.post('/lists', {
        name,
        idBoard: this.config.boardId,
      });
      return response.data;
    });
  }

  async archiveList(listId: string): Promise<TrelloList> {
    return this.handleRequest(async () => {
      const response = await this.axiosInstance.put(`/lists/${listId}/closed`, {
        value: true,
      });
      return response.data;
    });
  }

  async getMyCards(): Promise<TrelloCard[]> {
    return this.handleRequest(async () => {
      const response = await this.axiosInstance.get('/members/me/cards');
      return response.data;
    });
  }

  async createBoard(params: CreateBoardParams): Promise<TrelloBoard> {
    return this.handleRequest(async () => {
      const boardData: any = {
        name: params.name,
        desc: params.description || this.templateEngine.getReadmeTemplate(),
      };

      // Add organization if specified
      if (params.organization_id || this.config.organizationId) {
        boardData.idOrganization = params.organization_id || this.config.organizationId;
      }

      // Create the board
      const response = await this.axiosInstance.post('/boards', boardData);
      const board = response.data;

      // Create default lists if requested
      if (params.default_lists !== false) {
        await this.createDefaultLists(board.id);
      }

      return board;
    });
  }

  private async createDefaultLists(boardId: string): Promise<void> {
    const template = this.templateEngine.getTemplate();
    const listNames = template.lists;
    const fallbackNames = template.fallback_lists;

    for (let i = 0; i < listNames.length; i++) {
      const listName = listNames[i];
      const fallbackName = fallbackNames[i];

      try {
        await this.createListWithFallback(boardId, listName, fallbackName);
      } catch (error) {
        console.error(`Failed to create list "${listName}":`, error);
        // Continue with next list even if one fails
      }
    }
  }

  private async createListWithFallback(boardId: string, listName: string, fallbackName: string): Promise<TrelloList> {
    try {
      return await this.handleRequest(async () => {
        const response = await this.axiosInstance.post('/lists', {
          name: listName,
          idBoard: boardId,
        });
        return response.data;
      });
    } catch (error) {
      // If emoji or special characters cause issues, try fallback name
      if (error instanceof Error && (
        error.message.includes('emoji') ||
        error.message.includes('character') ||
        error.message.includes('invalid')
      )) {
        console.warn(`Failed to create list "${listName}", trying fallback "${fallbackName}"`);
        return await this.handleRequest(async () => {
          const response = await this.axiosInstance.post('/lists', {
            name: fallbackName,
            idBoard: boardId,
          });
          return response.data;
        });
      }
      throw error;
    }
  }

  async getBoards(params: GetBoardsParams = {}): Promise<TrelloBoard[]> {
    return this.handleRequest(async () => {
      let url = '/members/me/boards';
      const queryParams: any = {};

      if (params.organization_id) {
        url = `/organizations/${params.organization_id}/boards`;
      }

      if (params.limit) {
        queryParams.limit = params.limit;
      }

      const response = await this.axiosInstance.get(url, { params: queryParams });
      return response.data;
    });
  }

  async addMemberToBoard(params: AddMemberParams): Promise<TrelloMember> {
    return this.handleRequest(async () => {
      const response = await this.axiosInstance.put(`/boards/${params.board_id}/members`, {
        email: params.email,
        type: params.permission || 'normal',
      });
      return response.data;
    });
  }
}
