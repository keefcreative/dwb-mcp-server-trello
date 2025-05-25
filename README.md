# DWB Custom MCP Trello Server

A custom Model Context Protocol (MCP) server for Trello board automation and client onboarding. This server extends the original `mcp-server-trello` with additional tools for creating boards, managing members, and automating client onboarding workflows.

## 🚀 Features

### Original Tools (Maintained)
- **Full Trello Board Integration**: Interact with cards, lists, and board activities
- **Built-in Rate Limiting**: Respects Trello's API limits (300 requests/10s per API key, 100 requests/10s per token)
- **Type-Safe Implementation**: Written in TypeScript with comprehensive type definitions
- **Input Validation**: Robust validation for all API inputs
- **Error Handling**: Graceful error handling with informative messages

### New Custom Tools
- **Board Creation**: Create new Trello boards with standardized client onboarding templates
- **Board Management**: List and filter available boards
- **Member Management**: Add members to boards with specified permissions
- **Template Engine**: Automated list creation with emoji fallback support

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd dwb-trello-mcp

# Install dependencies
pnpm install

# Build the project
pnpm run build
```

## ⚙️ Configuration

Create a `.env` file based on `.env.example`:

```env
TRELLO_API_KEY=your-api-key
TRELLO_TOKEN=your-token
TRELLO_BOARD_ID=your-default-board-id
TRELLO_ORG_ID=your-organization-id  # Optional
```

### Getting Trello Credentials

1. **API Key**: Get from https://trello.com/app-key
2. **Token**: Generate using your API key at:
   ```
   https://trello.com/1/authorize?expiration=never&name=DWB_MCP_SERVER&scope=read,write&response_type=token&key=YOUR_API_KEY
   ```
3. **Board ID**: Found in the board URL: `https://trello.com/b/BOARD_ID/board-name`
4. **Organization ID**: Optional, found in organization settings

## 🛠️ Available Tools

### Original Tools
- `get_cards_by_list_id` - Fetch cards from a specific list
- `get_lists` - Retrieve all lists from the board
- `get_recent_activity` - Fetch recent board activity
- `add_card_to_list` - Add a new card to a list
- `update_card_details` - Update existing card details
- `archive_card` - Archive a card
- `add_list_to_board` - Add a new list to the board
- `archive_list` - Archive a list
- `get_my_cards` - Fetch cards assigned to current user

### New Custom Tools

#### `create_board`
Creates a new Trello board with standard client onboarding template.

```typescript
{
  name: string,              // Board name (required)
  description?: string,      // Board description (optional)
  default_lists?: boolean,   // Create template lists (default: true)
  organization_id?: string   // Organization ID (optional)
}
```

**Features:**
- Automatically creates 5 standardized lists:
  - 🟢 New Request
  - 📥 Queue
  - 🛠 In Progress
  - 🧐 Review
  - ✅ Completed
- Emoji fallback support (uses plain text if emojis fail)
- Sets board description with client onboarding instructions
- Supports organization-level board creation

#### `get_boards`
Lists available Trello boards with optional filtering.

```typescript
{
  organization_id?: string,  // Filter by organization
  limit?: number            // Maximum boards to return
}
```

#### `add_member_to_board`
Adds a member to a board by email with specified permissions.

```typescript
{
  board_id: string,         // Board ID (required)
  email: string,           // Member email (required)
  permission?: string      // 'normal', 'admin', or 'observer' (default: 'normal')
}
```

## 🎯 Client Onboarding Workflow

The server is designed to automate client onboarding with a standardized workflow:

1. **Create Board**: Use `create_board` to create a new client board
2. **Add Client**: Use `add_member_to_board` to invite the client
3. **Template Applied**: Board automatically includes:
   - Standardized list structure
   - Client instructions in board description
   - Emoji-based list names with fallbacks

## 🐳 Docker Deployment

### Build and Run
```bash
# Build the Docker image
docker build -t dwb-trello-mcp .

# Run with environment variables
docker run -d \
  --name dwb-trello-mcp \
  -e TRELLO_API_KEY=your-key \
  -e TRELLO_TOKEN=your-token \
  -e TRELLO_BOARD_ID=your-board-id \
  -e TRELLO_ORG_ID=your-org-id \
  dwb-trello-mcp
```

### Using Docker Compose
```bash
# Production
docker-compose up -d

# Development with hot reload
docker-compose --profile dev up -d
```

## 🧪 Testing

```bash
# Run the MCP inspector
pnpm run inspector

# List available tools
npx @modelcontextprotocol/sdk list-tools build/index.js

# Run custom test script
node test-tools.js
```

## 📁 Project Structure

```
dwb-trello-mcp/
├── src/
│   ├── index.ts              # Main MCP server
│   ├── trello-client.ts      # Extended Trello API client
│   ├── board-templates.ts    # Board template engine
│   ├── types.ts              # TypeScript definitions
│   ├── validators.ts         # Input validation
│   └── rate-limiter.ts       # Rate limiting logic
├── templates/
│   ├── default-board-lists.json      # List template
│   └── board-readme-template.md      # Board description template
├── build/                    # Compiled JavaScript
├── Dockerfile               # Container configuration
├── docker-compose.yml       # Development environment
└── README.md               # This file
```

## 🔧 Development

```bash
# Start development server
pnpm run dev

# Build project
pnpm run build

# Format code
pnpm run format

# Lint code
pnpm run lint
```

## 📋 Template Configuration

The board template is defined in `templates/default-board-lists.json`:

```json
{
  "template_name": "default_client_board",
  "lists": [
    "🟢 New Request",
    "📥 Queue",
    "🛠 In Progress",
    "🧐 Review",
    "✅ Completed"
  ],
  "fallback_lists": [
    "New Request",
    "Queue",
    "In Progress",
    "Review",
    "Completed"
  ]
}
```

## 🚦 Rate Limiting

The server implements automatic rate limiting to comply with Trello's API limits:
- 300 requests per 10 seconds per API key
- 100 requests per 10 seconds per token

Requests are automatically queued and retried when limits are reached.

## 🐛 Error Handling

The server provides detailed error messages for:
- Invalid input parameters
- Rate limit exceeded
- API authentication errors
- Network issues
- Invalid board/list/card IDs
- Template loading failures

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Check the [PROJECT_PLAN.md](PROJECT_PLAN.md) for implementation details
- Review the original [mcp-server-trello](https://github.com/MCP-Mirror/delorenj_mcp-server-trello) documentation
