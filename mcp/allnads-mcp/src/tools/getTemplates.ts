import { z } from 'zod';
import { createTextResponse, ContentResult } from './types.js';
import { templateCache } from '../utils/globalCache.js';
import { Template } from '../types/template.js';

/**
 * Tool for getting all templates information (excluding imageData)
 */
export const getTemplatesTool = {
  name: 'get_all_templates',
  description: 'Get information about available templates (excluding image data), you can filter by type, if you want to get all templates, you can use the type "all"',
  parameters: z.object({
    type: z.enum(['all', 'background', 'hairstyle', 'eyes', 'mouth', 'accessory'])
      .describe('Filter templates by type (all, background, hairstyle, eyes, mouth, accessory)')
  }),
  
  execute: async (params: { type: string }): Promise<ContentResult> => {
    try {
      // Fetch all templates from the cache
      const allTemplates = await templateCache.fetchAllTemplates();
      
      // Process templates to exclude imageData and convert bigint to string
      const processedTemplates: Record<string, any[]> = {};
      
      Object.entries(allTemplates).forEach(([typeName, templates]) => {
        processedTemplates[typeName.toLowerCase()] = templates.map(template => {
          // Create a new object without the imageData property and convert bigint to string
          const { imageData, ...rest } = template;
          
          // Convert all bigint properties to strings
          const templateWithStringValues = {
            ...rest,
            id: template.id.toString(),
            maxSupply: template.maxSupply.toString(),
            currentSupply: template.currentSupply.toString(),
            price: template.price.toString()
          };
          
          return templateWithStringValues;
        });
      });
      
      // Filter by type if not 'all'
      let result;
      if (params.type === 'all') {
        result = processedTemplates;
      } else {
        // Convert type to lowercase for case-insensitive comparison
        const typeKey = params.type.toLowerCase();
        result = processedTemplates[typeKey] || [];
      }
      
      // Format the response - return only the templates field
      const responseText = JSON.stringify(result, null, 2);
      
      return createTextResponse(responseText);
    } catch (error) {
      return createTextResponse(`Error getting templates: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
