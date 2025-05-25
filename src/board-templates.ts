import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BoardTemplate } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class BoardTemplateEngine {
  private template: BoardTemplate | null = null;

  constructor() {
    this.loadTemplate();
  }

  private loadTemplate(): void {
    try {
      const templatePath = join(__dirname, '..', 'templates', 'default-board-lists.json');
      const templateData = readFileSync(templatePath, 'utf-8');
      this.template = JSON.parse(templateData) as BoardTemplate;
    } catch (error) {
      console.error('Failed to load board template:', error);
      // Fallback template
      this.template = {
        template_name: 'default_client_board',
        lists: [
          '🟢 New Request',
          '📥 Queue',
          '🛠 In Progress',
          '🧐 Review',
          '✅ Completed'
        ],
        fallback_lists: [
          'New Request',
          'Queue',
          'In Progress',
          'Review',
          'Completed'
        ]
      };
    }
  }

  public getTemplate(): BoardTemplate {
    if (!this.template) {
      throw new Error('Board template not loaded');
    }
    return this.template;
  }

  public getListNames(): string[] {
    return this.getTemplate().lists;
  }

  public getFallbackListNames(): string[] {
    return this.getTemplate().fallback_lists;
  }

  public getReadmeTemplate(): string {
    try {
      const readmePath = join(__dirname, '..', 'templates', 'board-readme-template.md');
      return readFileSync(readmePath, 'utf-8');
    } catch (error) {
      console.error('Failed to load README template:', error);
      return `# Welcome to Your Trello Board

This board is organized to help you manage your design requests efficiently:

## Lists:
- **🟢 New Request**: Submit new work requests here
- **📥 Queue**: Approved requests waiting to be started
- **🛠 In Progress**: Work currently being done
- **🧐 Review**: Items ready for your feedback
- **✅ Completed**: Finished work

## How to Use:
1. Add cards to "New Request" with clear descriptions
2. Our team will review and move to "Queue"
3. Track progress as cards move through the workflow
4. Provide feedback on items in "Review"
5. Completed work will be in "Completed"

For questions or support, please contact our team.`;
    }
  }
}