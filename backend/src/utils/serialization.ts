/**
 * Utility functions for serializing data types that can't be directly converted to JSON
 */

/**
 * Serializes an object containing BigInt values to make it JSON-safe
 * Converts all BigInt values to strings
 * 
 * @param obj The object to serialize
 * @returns A new object with BigInt values converted to strings
 */
export function serializeBigInt<T>(obj: T): any {
  return JSON.parse(
    JSON.stringify(obj, (_, value) => 
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

/**
 * Serializes a template object by converting BigInt values to strings
 * 
 * @param template The template object to serialize
 * @returns A new template object with BigInt values converted to strings
 */
export function serializeTemplate(template: any): any {
  return {
    ...template,
    id: template.id?.toString(),
    price: template.price?.toString()
  };
}

/**
 * Serializes a collection of templates grouped by type
 * 
 * @param templates The templates object to serialize
 * @returns A new templates object with all BigInt values converted to strings
 */
export function serializeTemplates(templates: { [key: string]: any[] }): { [key: string]: any[] } {
  const serialized: { [key: string]: any[] } = {};
  
  for (const [key, templateList] of Object.entries(templates)) {
    serialized[key] = templateList.map(serializeTemplate);
  }
  
  return serialized;
} 