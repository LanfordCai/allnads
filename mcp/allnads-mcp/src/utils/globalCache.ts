import { TemplateCache } from './templateCache.js';
import { env } from '../config/env.js';

// Create a global template cache instance
export const templateCache = new TemplateCache(env.ALLNADS_SERVER_API_URL);

// Initialize the cache
(async () => {
  try {
    console.log('Initializing global template cache...');
    await templateCache.fetchAllTemplates();
    console.log('Global template cache initialized successfully');
  } catch (error) {
    console.error('Failed to initialize global template cache:', error);
    console.log('The TemplateCache will handle retries automatically.');
    // The TemplateCache will handle retries internally
  }
})(); 