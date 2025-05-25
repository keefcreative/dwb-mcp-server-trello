export interface TrelloConfig {
  apiKey: string;
  token: string;
  boardId: string;
  organizationId?: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  idList: string;
  idLabels: string[];
  closed: boolean;
  url: string;
  dateLastActivity: string;
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  idBoard: string;
  pos: number;
}

export interface TrelloAction {
  id: string;
  idMemberCreator: string;
  type: string;
  date: string;
  data: {
    text?: string;
    card?: {
      id: string;
      name: string;
    };
    list?: {
      id: string;
      name: string;
    };
    board: {
      id: string;
      name: string;
    };
  };
  memberCreator: {
    id: string;
    fullName: string;
    username: string;
  };
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

export interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
}

export interface RateLimiter {
  canMakeRequest(): boolean;
  waitForAvailableToken(): Promise<void>;
}

export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  url: string;
  closed: boolean;
  idOrganization?: string;
  dateLastActivity: string;
  prefs: {
    permissionLevel: string;
    voting: string;
    comments: string;
    invitations: string;
    selfJoin: boolean;
    cardCovers: boolean;
    background: string;
  };
}

export interface BoardTemplate {
  template_name: string;
  lists: string[];
  fallback_lists: string[];
}

export enum MemberPermission {
  NORMAL = 'normal',
  ADMIN = 'admin',
  OBSERVER = 'observer'
}

export interface CreateBoardParams {
  name: string;
  description?: string;
  default_lists?: boolean;
  organization_id?: string;
}

export interface AddMemberParams {
  board_id: string;
  email: string;
  permission?: 'normal' | 'admin' | 'observer';
}

export interface GetBoardsParams {
  organization_id?: string;
  limit?: number;
}
