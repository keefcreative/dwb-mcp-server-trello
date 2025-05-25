#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing DWB Custom MCP Trello Server (with dummy env)');
console.log('========================================================\n');

// Test the MCP server by sending requests via stdio
const serverPath = join(__dirname, 'build', 'index.js');

function testMCPServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TRELLO_API_KEY: 'dummy_api_key',
        TRELLO_TOKEN: 'dummy_token',
        TRELLO_BOARD_ID: 'dummy_board_id',
        TRELLO_ORG_ID: 'dummy_org_id'
      }
    });

    let output = '';
    let errorOutput = '';

    server.stdout.on('data', (data) => {
      output += data.toString();
    });

    server.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    server.on('close', (code) => {
      resolve({ code, output, errorOutput });
    });

    server.on('error', (error) => {
      reject(error);
    });

    // Send initialization request
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    };

    // Send list tools request
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };

    // Send requests
    server.stdin.write(JSON.stringify(initRequest) + '\n');
    
    // Wait a bit before sending the second request
    setTimeout(() => {
      server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
      server.stdin.end();
    }, 100);

    // Kill after timeout
    setTimeout(() => {
      server.kill('SIGTERM');
    }, 3000);
  });
}

async function main() {
  try {
    console.log('📡 Starting MCP server test with dummy environment...\n');
    
    const result = await testMCPServer();
    
    console.log('📊 Test Results:');
    console.log('================');
    console.log(`Exit Code: ${result.code}`);
    
    if (result.errorOutput) {
      console.log('\n🔍 Server Logs:');
      console.log(result.errorOutput);
    }
    
    if (result.output) {
      console.log('\n📋 Server Responses:');
      const lines = result.output.split('\n').filter(line => line.trim());
      
      lines.forEach((line, index) => {
        try {
          const response = JSON.parse(line);
          console.log(`\nResponse ${index + 1}:`);
          
          // Check if this is a tools/list response
          if (response.result && response.result.tools) {
            console.log('\n🛠️  Available Tools:');
            console.log('==================');
            response.result.tools.forEach((tool, toolIndex) => {
              const isCustom = ['create_board', 'get_boards', 'add_member_to_board'].includes(tool.name);
              const prefix = isCustom ? '🆕' : '📋';
              console.log(`${prefix} ${toolIndex + 1}. ${tool.name}`);
              console.log(`   Description: ${tool.description}`);
              console.log(`   Required params: ${tool.inputSchema.required?.join(', ') || 'none'}`);
              console.log('');
            });
            
            // Check for our custom tools
            const customTools = ['create_board', 'get_boards', 'add_member_to_board'];
            const foundCustomTools = response.result.tools.filter(tool => 
              customTools.includes(tool.name)
            );
            
            console.log('✅ Custom Tools Status:');
            console.log('=======================');
            customTools.forEach(toolName => {
              const found = foundCustomTools.find(t => t.name === toolName);
              console.log(`${found ? '✅' : '❌'} ${toolName}: ${found ? 'Found' : 'Missing'}`);
            });
            
            console.log(`\n📈 Summary: ${foundCustomTools.length}/${customTools.length} custom tools found`);
            console.log(`📊 Total tools: ${response.result.tools.length}`);
            
            if (foundCustomTools.length === customTools.length) {
              console.log('\n🎉 SUCCESS: All custom tools are properly registered!');
            } else {
              console.log('\n⚠️  WARNING: Some custom tools are missing!');
            }
          } else {
            console.log(JSON.stringify(response, null, 2));
          }
        } catch (e) {
          console.log(`Raw line ${index + 1}: ${line}`);
        }
      });
    }
    
    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();