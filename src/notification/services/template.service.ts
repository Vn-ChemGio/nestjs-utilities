/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface TemplateSource {
  type: 'file' | 'string';
  content: string;
}

export class TemplateService {
  private handlebars: any = null;
  private initPromise: Promise<void> | null = null;

  constructor(private templatesDir?: string) {}

  private async ensureHandlebars(): Promise<void> {
    if (this.handlebars) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const hbs = await import('handlebars');
      this.handlebars = hbs.default;
    })();

    return this.initPromise;
  }

  async render(
    templateName: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    await this.ensureHandlebars();

    const source = this.resolveTemplate(templateName);
    const template = this.handlebars.compile(source.content);
    return template(context) as string;
  }

  private resolveTemplate(templateName: string): TemplateSource {
    if (this.templatesDir) {
      const filePath = path.resolve(this.templatesDir, `${templateName}.hbs`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { type: 'file', content };
      }
    }

    throw new Error(
      `Template "${templateName}" not found${this.templatesDir ? ` in ${this.templatesDir}` : ''}`,
    );
  }
}
