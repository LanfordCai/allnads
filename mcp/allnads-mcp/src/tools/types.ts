import { z } from 'zod';

// Define the TextContent type that FastMCP expects
export interface TextContent {
  type: 'text';
  text: string;
}

// Define the ContentResult type that FastMCP expects
export interface ContentResult {
  content: TextContent[];
}

// Helper function to format text responses in the way FastMCP expects
export function createTextResponse(text: string): ContentResult {
  return {
    content: [{
      type: 'text',
      text
    }]
  };
} 