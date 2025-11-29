/**
 * Document Renderer Orchestrator
 * Coordinates PDF and Excel rendering based on export type
 */

import { RenderContext, RenderResult } from './types';
import { renderPDF } from './render_pdf';
import { renderExcel } from './render_excel';

export async function render(context: RenderContext): Promise<RenderResult> {
  console.log(`[Renderer] Rendering ${context.exportType} as ${context.format}`);
  
  // Validate context
  if (!context.exportType) {
    throw new Error('Export type is required');
  }
  
  if (!context.format) {
    throw new Error('Format is required');
  }
  
  if (!context.data) {
    throw new Error('Data is required for rendering');
  }
  
  // Route to appropriate renderer
  try {
    let result: RenderResult;
    
    if (context.format === 'pdf') {
      result = await renderPDF(context);
    } else if (context.format === 'xlsx') {
      result = await renderExcel(context);
    } else {
      throw new Error(`Unsupported format: ${context.format}`);
    }
    
    console.log(`[Renderer] Successfully rendered ${context.exportType} (${result.fileSizeBytes} bytes)`);
    
    return result;
  } catch (error) {
    console.error('[Renderer] Rendering failed:', error);
    throw error;
  }
}

