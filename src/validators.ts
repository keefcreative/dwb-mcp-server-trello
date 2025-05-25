import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export function validateString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, `${field} must be a string`);
  }
  return value;
}

export function validateOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return validateString(value, 'value');
}

export function validateNumber(value: unknown, field: string): number {
  if (typeof value !== 'number') {
    throw new McpError(ErrorCode.InvalidParams, `${field} must be a number`);
  }
  return value;
}

export function validateOptionalNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  return validateNumber(value, 'value');
}

export function validateStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    throw new McpError(ErrorCode.InvalidParams, 'Value must be an array of strings');
  }
  return value;
}

export function validateOptionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  return validateStringArray(value);
}

export function validateGetCardsListRequest(args: Record<string, unknown>): { listId: string } {
  if (!args.listId) {
    throw new McpError(ErrorCode.InvalidParams, 'listId is required');
  }
  return {
    listId: validateString(args.listId, 'listId'),
  };
}

export function validateGetRecentActivityRequest(args: Record<string, unknown>): { limit?: number } {
  return {
    limit: validateOptionalNumber(args.limit),
  };
}

export function validateAddCardRequest(args: Record<string, unknown>): {
  listId: string;
  name: string;
  description?: string;
  dueDate?: string;
  labels?: string[];
} {
  if (!args.listId || !args.name) {
    throw new McpError(ErrorCode.InvalidParams, 'listId and name are required');
  }
  return {
    listId: validateString(args.listId, 'listId'),
    name: validateString(args.name, 'name'),
    description: validateOptionalString(args.description),
    dueDate: validateOptionalString(args.dueDate),
    labels: validateOptionalStringArray(args.labels),
  };
}

export function validateUpdateCardRequest(args: Record<string, unknown>): {
  cardId: string;
  name?: string;
  description?: string;
  dueDate?: string;
  labels?: string[];
} {
  if (!args.cardId) {
    throw new McpError(ErrorCode.InvalidParams, 'cardId is required');
  }
  return {
    cardId: validateString(args.cardId, 'cardId'),
    name: validateOptionalString(args.name),
    description: validateOptionalString(args.description),
    dueDate: validateOptionalString(args.dueDate),
    labels: validateOptionalStringArray(args.labels),
  };
}

export function validateArchiveCardRequest(args: Record<string, unknown>): { cardId: string } {
  if (!args.cardId) {
    throw new McpError(ErrorCode.InvalidParams, 'cardId is required');
  }
  return {
    cardId: validateString(args.cardId, 'cardId'),
  };
}

export function validateAddListRequest(args: Record<string, unknown>): { name: string } {
  if (!args.name) {
    throw new McpError(ErrorCode.InvalidParams, 'name is required');
  }
  return {
    name: validateString(args.name, 'name'),
  };
}

export function validateArchiveListRequest(args: Record<string, unknown>): { listId: string } {
  if (!args.listId) {
    throw new McpError(ErrorCode.InvalidParams, 'listId is required');
  }
  return {
    listId: validateString(args.listId, 'listId'),
  };
}

export function validateBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new McpError(ErrorCode.InvalidParams, `${field} must be a boolean`);
  }
  return value;
}

export function validateOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  return validateBoolean(value, 'value');
}

export function validateCreateBoardRequest(args: Record<string, unknown>): {
  name: string;
  description?: string;
  default_lists?: boolean;
  organization_id?: string;
} {
  if (!args.name) {
    throw new McpError(ErrorCode.InvalidParams, 'name is required');
  }
  return {
    name: validateString(args.name, 'name'),
    description: validateOptionalString(args.description),
    default_lists: validateOptionalBoolean(args.default_lists),
    organization_id: validateOptionalString(args.organization_id),
  };
}

export function validateGetBoardsRequest(args: Record<string, unknown>): {
  organization_id?: string;
  limit?: number;
} {
  return {
    organization_id: validateOptionalString(args.organization_id),
    limit: validateOptionalNumber(args.limit),
  };
}

export function validateAddMemberRequest(args: Record<string, unknown>): {
  board_id: string;
  email: string;
  permission?: 'normal' | 'admin' | 'observer';
} {
  if (!args.board_id || !args.email) {
    throw new McpError(ErrorCode.InvalidParams, 'board_id and email are required');
  }

  const permission = validateOptionalString(args.permission);
  if (permission && !['normal', 'admin', 'observer'].includes(permission)) {
    throw new McpError(ErrorCode.InvalidParams, 'permission must be one of: normal, admin, observer');
  }

  return {
    board_id: validateString(args.board_id, 'board_id'),
    email: validateString(args.email, 'email'),
    permission: permission as 'normal' | 'admin' | 'observer' | undefined,
  };
}
