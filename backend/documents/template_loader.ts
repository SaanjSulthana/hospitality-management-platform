/**
 * Template Loader
 * Loads and compiles Handlebars templates with caching
 */

import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { registerHelpers } from './templates/helpers';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TemplateLoader {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private isInitialized = false;
  private templatesDir: string;

  constructor() {
    this.templatesDir = path.join(__dirname, 'templates');
    this.initialize();
  }

  private initialize(): void {
    if (this.isInitialized) return;

    // Register all helpers
    registerHelpers(Handlebars);

    // Register partials
    this.registerPartials();

    this.isInitialized = true;
    console.log('[TemplateLoader] Initialized successfully');
  }

  private registerPartials(): void {
    const partialsDir = path.join(this.templatesDir, 'partials');
    
    if (!fs.existsSync(partialsDir)) {
      console.warn('[TemplateLoader] Partials directory not found:', partialsDir);
      return;
    }

    const partialFiles = fs.readdirSync(partialsDir).filter(f => f.endsWith('.hbs'));
    
    for (const file of partialFiles) {
      const partialName = path.basename(file, '.hbs');
      const partialPath = path.join(partialsDir, file);
      const partialContent = fs.readFileSync(partialPath, 'utf-8');
      Handlebars.registerPartial(partialName, partialContent);
      console.log(`[TemplateLoader] Registered partial: ${partialName}`);
    }
  }

  /**
   * Load and compile a template
   */
  getTemplate(templateName: string): HandlebarsTemplateDelegate {
    // Check cache
    if (this.templates.has(templateName)) {
      return this.templates.get(templateName)!;
    }

    // Try multiple possible paths for templates
    const possiblePaths = [
      path.join(this.templatesDir, `${templateName}.hbs`),
      path.join(process.cwd(), 'backend', 'documents', 'templates', `${templateName}.hbs`),
      path.join(process.cwd(), 'documents', 'templates', `${templateName}.hbs`),
    ];
    
    let templatePath: string | null = null;
    for (const possPath of possiblePaths) {
      if (fs.existsSync(possPath)) {
        templatePath = possPath;
        console.log(`[TemplateLoader] Found template at: ${templatePath}`);
        break;
      }
    }
    
    if (!templatePath) {
      console.error(`[TemplateLoader] Template not found. Tried paths:`, possiblePaths);
      throw new Error(`Template not found: ${templateName}`);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    
    // Compile template
    const template = Handlebars.compile(templateContent);
    
    // Cache compiled template
    this.templates.set(templateName, template);
    
    console.log(`[TemplateLoader] Loaded and compiled template: ${templateName}`);
    
    return template;
  }

  /**
   * Render a template with data
   */
  render(templateName: string, data: any): string {
    const template = this.getTemplate(templateName);
    return template(data);
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templates.clear();
    console.log('[TemplateLoader] Template cache cleared');
  }

  /**
   * List available templates
   */
  listTemplates(): string[] {
    if (!fs.existsSync(this.templatesDir)) {
      return [];
    }

    return fs.readdirSync(this.templatesDir)
      .filter(f => f.endsWith('.hbs'))
      .map(f => path.basename(f, '.hbs'));
  }
}

// Export singleton instance
export const templateLoader = new TemplateLoader();

