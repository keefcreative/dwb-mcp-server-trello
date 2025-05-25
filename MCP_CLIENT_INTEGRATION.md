# 🔗 MCP Client Integration Guide

## Overview

This guide covers integrating your DWB MCP Trello Server with your Next.js website at `/Users/keithhodgetts/Dropbox/Mac/Documents/GitHub/aximo-clean-template-final`. The integration will automatically create Trello boards for new client signups and store the board data in Supabase.

## 🎯 Integration Goals

- Create Trello boards automatically when clients sign up
- Store `board_id` and `list_ids` in Supabase clients table
- Provide fallback handling when MCP server is unavailable
- Maintain clean separation between MCP client and business logic

## 📋 Prerequisites

- [x] DWB MCP Trello Server running locally on `http://localhost:3001`
- [x] Next.js project with Supabase integration
- [x] Trello API credentials configured in MCP server

## 🚀 Implementation Steps

### Step 1: Install Dependencies

```bash
cd /Users/keithhodgetts/Dropbox/Mac/Documents/GitHub/aximo-clean-template-final

# Install MCP SDK
npm install @modelcontextprotocol/sdk

# Install additional dependencies for HTTP client
npm install axios
```

### Step 2: Environment Variables

Add to your `.env.local` file:

```env
# MCP Trello Server Configuration
NEXT_PUBLIC_MCP_TRELLO_URL=http://localhost:3001
MCP_TRELLO_ENABLED=true

# For production, this will be your deployed MCP server URL
# NEXT_PUBLIC_MCP_TRELLO_URL=https://your-mcp-server.render.com
```

### Step 3: Create MCP Client Module

Create `lib/mcp-client.js`:

```javascript
import axios from 'axios';

export class TrelloMCPClient {
  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_MCP_TRELLO_URL || 'http://localhost:3001';
    this.enabled = process.env.MCP_TRELLO_ENABLED === 'true';
  }

  async isHealthy() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      console.warn('MCP Trello server health check failed:', error.message);
      return false;
    }
  }

  async createBoard({ name, description, clientEmail }) {
    if (!this.enabled) {
      throw new Error('MCP Trello integration is disabled');
    }

    try {
      const response = await axios.post(`${this.baseURL}/tools/create_board`, {
        name,
        description: description || `Project board for ${clientEmail}`,
        default_lists: true,
        // organization_id will use TRELLO_ORG_ID from server env
      }, {
        timeout: 30000, // 30 second timeout for board creation
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        board_id: response.data.id,
        board_url: response.data.url,
        list_ids: response.data.lists?.map(list => ({
          id: list.id,
          name: list.name
        })) || []
      };
    } catch (error) {
      console.error('Failed to create Trello board:', error);
      throw new Error(`Board creation failed: ${error.message}`);
    }
  }

  async addMemberToBoard({ boardId, email, permission = 'normal' }) {
    if (!this.enabled) {
      throw new Error('MCP Trello integration is disabled');
    }

    try {
      const response = await axios.post(`${this.baseURL}/tools/add_member_to_board`, {
        board_id: boardId,
        email,
        permission
      }, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        member: response.data
      };
    } catch (error) {
      console.error('Failed to add member to board:', error);
      // Don't throw here - member addition is not critical
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getBoards() {
    if (!this.enabled) {
      return [];
    }

    try {
      const response = await axios.get(`${this.baseURL}/tools/get_boards`, {
        timeout: 10000
      });

      return response.data || [];
    } catch (error) {
      console.error('Failed to get boards:', error);
      return [];
    }
  }
}

// Export singleton instance
export const trelloMCPClient = new TrelloMCPClient();
```

### Step 4: Update Supabase Schema

Add columns to your `clients` table:

```sql
-- Add Trello integration columns
ALTER TABLE clients 
ADD COLUMN trello_board_id TEXT,
ADD COLUMN trello_board_url TEXT,
ADD COLUMN trello_list_ids JSONB,
ADD COLUMN trello_integration_status TEXT DEFAULT 'pending';

-- Add index for faster queries
CREATE INDEX idx_clients_trello_board_id ON clients(trello_board_id);

-- Add comments for documentation
COMMENT ON COLUMN clients.trello_board_id IS 'Trello board ID created for this client';
COMMENT ON COLUMN clients.trello_board_url IS 'Direct URL to the Trello board';
COMMENT ON COLUMN clients.trello_list_ids IS 'JSON array of list objects with id and name';
COMMENT ON COLUMN clients.trello_integration_status IS 'Status: pending, success, failed, disabled';
```

### Step 5: Create API Route

Create `pages/api/trello/create-board.js`:

```javascript
import { createClient } from '@supabase/supabase-js';
import { trelloMCPClient } from '../../../lib/mcp-client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientId, clientName, clientEmail } = req.body;

  if (!clientId || !clientName || !clientEmail) {
    return res.status(400).json({ 
      error: 'Missing required fields: clientId, clientName, clientEmail' 
    });
  }

  try {
    // Check if client exists and doesn't already have a board
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, trello_board_id, trello_integration_status')
      .eq('id', clientId)
      .single();

    if (clientError) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (client.trello_board_id) {
      return res.status(409).json({ 
        error: 'Client already has a Trello board',
        board_id: client.trello_board_id 
      });
    }

    // Check MCP server health
    const isHealthy = await trelloMCPClient.isHealthy();
    if (!isHealthy) {
      // Update status to failed but don't block the signup
      await supabase
        .from('clients')
        .update({ trello_integration_status: 'failed' })
        .eq('id', clientId);

      return res.status(503).json({ 
        error: 'Trello integration temporarily unavailable',
        fallback: true 
      });
    }

    // Create the board
    const boardData = await trelloMCPClient.createBoard({
      name: `${clientName} - Project Board`,
      description: `Project management board for ${clientName} (${clientEmail})`,
      clientEmail
    });

    // Store board data in Supabase
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        trello_board_id: boardData.board_id,
        trello_board_url: boardData.board_url,
        trello_list_ids: boardData.list_ids,
        trello_integration_status: 'success'
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('Failed to update client with board data:', updateError);
      return res.status(500).json({ error: 'Failed to save board data' });
    }

    // Optionally add client as member to the board
    try {
      await trelloMCPClient.addMemberToBoard({
        boardId: boardData.board_id,
        email: clientEmail,
        permission: 'normal'
      });
    } catch (memberError) {
      console.warn('Failed to add client as board member:', memberError);
      // Don't fail the entire operation for this
    }

    res.json({
      success: true,
      board_id: boardData.board_id,
      board_url: boardData.board_url,
      list_ids: boardData.list_ids
    });

  } catch (error) {
    console.error('Board creation error:', error);

    // Update status to failed
    await supabase
      .from('clients')
      .update({ trello_integration_status: 'failed' })
      .eq('id', clientId);

    res.status(500).json({ 
      error: 'Failed to create Trello board',
      details: error.message 
    });
  }
}
```

### Step 6: Create Health Check API Route

Create `pages/api/trello/health.js`:

```javascript
import { trelloMCPClient } from '../../../lib/mcp-client';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const isHealthy = await trelloMCPClient.isHealthy();
    
    res.json({
      healthy: isHealthy,
      enabled: process.env.MCP_TRELLO_ENABLED === 'true',
      server_url: process.env.NEXT_PUBLIC_MCP_TRELLO_URL,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
```

### Step 7: Integrate with Signup Flow

Update your signup component to trigger board creation:

```javascript
// components/signup/SignupForm.jsx
import { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

export default function SignupForm() {
  const [loading, setLoading] = useState(false);
  const [trelloStatus, setTrelloStatus] = useState(null);
  const supabase = useSupabaseClient();

  const handleSignup = async (formData) => {
    setLoading(true);
    
    try {
      // 1. Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password
      });

      if (authError) throw authError;

      // 2. Create client record
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({
          name: formData.name,
          email: formData.email,
          user_id: authData.user.id
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // 3. Create Trello board (non-blocking)
      try {
        const response = await fetch('/api/trello/create-board', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: clientData.id,
            clientName: formData.name,
            clientEmail: formData.email
          })
        });

        const trelloResult = await response.json();
        
        if (trelloResult.success) {
          setTrelloStatus('success');
        } else if (trelloResult.fallback) {
          setTrelloStatus('fallback');
        } else {
          setTrelloStatus('failed');
        }
      } catch (trelloError) {
        console.warn('Trello board creation failed:', trelloError);
        setTrelloStatus('failed');
        // Don't block signup for Trello failures
      }

      // Show success message
      alert('Account created successfully!');
      
    } catch (error) {
      console.error('Signup error:', error);
      alert('Signup failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignup}>
      {/* Your form fields */}
      
      {trelloStatus === 'success' && (
        <div className="alert alert-success">
          ✅ Trello project board created successfully!
        </div>
      )}
      
      {trelloStatus === 'fallback' && (
        <div className="alert alert-warning">
          ⚠️ Account created! Trello board will be created shortly.
        </div>
      )}
      
      {trelloStatus === 'failed' && (
        <div className="alert alert-info">
          ℹ️ Account created! Trello board can be created later from your dashboard.
        </div>
      )}
      
      <button type="submit" disabled={loading}>
        {loading ? 'Creating Account...' : 'Sign Up'}
      </button>
    </form>
  );
}
```

### Step 8: Add MCP Server Health Check Endpoint

Add to your MCP server (`src/index.ts`):

```typescript
// Add this to your TrelloServer class
private setupHealthCheck() {
  // Simple HTTP server for health checks
  const http = require('http');
  
  const server = http.createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '0.1.0'
      }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(3001, () => {
    console.log('Health check server running on port 3001');
  });
}

// Call this in your constructor
constructor() {
  // ... existing code ...
  this.setupHealthCheck();
}
```

## 🧪 Testing the Integration

### 1. Test MCP Server Health

```bash
curl http://localhost:3001/health
```

### 2. Test API Routes

```bash
# Test health endpoint
curl http://localhost:3000/api/trello/health

# Test board creation (replace with real client data)
curl -X POST http://localhost:3000/api/trello/create-board \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "your-client-id",
    "clientName": "Test Client",
    "clientEmail": "test@example.com"
  }'
```

### 3. Test Complete Flow

1. Start MCP server: `cd dwb-trello-mcp && pnpm run dev`
2. Start Next.js app: `cd aximo-clean-template-final && npm run dev`
3. Sign up a new client through the UI
4. Check Supabase for board data
5. Verify board exists in Trello

## 🔧 Troubleshooting

### Common Issues

1. **MCP Server Not Responding**
   - Check if server is running on port 3001
   - Verify environment variables are set
   - Check server logs for errors

2. **Board Creation Fails**
   - Verify Trello API credentials
   - Check organization ID is valid
   - Ensure rate limits aren't exceeded

3. **Supabase Update Fails**
   - Check service role key permissions
   - Verify table schema matches
   - Check for foreign key constraints

### Debug Mode

Add debug logging to your MCP client:

```javascript
// In lib/mcp-client.js
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('MCP Request:', { name, description, clientEmail });
  console.log('MCP Response:', response.data);
}
```

## 🚀 Next Steps

1. Test the integration thoroughly in development
2. Add monitoring and alerting for production
3. Consider implementing retry logic for failed board creations
4. Add admin interface to manually create boards for failed cases
5. Review deployment options in `DEPLOYMENT_STRATEGY.md`

## 📚 Additional Resources

- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [Trello API Reference](https://developer.atlassian.com/cloud/trello/rest/api-group-boards/)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)