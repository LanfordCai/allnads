import { z } from 'zod';
import { isAddress } from 'viem';
import { createTextResponse, ContentResult } from './types.js';
import { env } from '../config/env.js';

interface AddressBookEntry {
  id: string;
  name: string;
  address: string;
}

const getApiUrl = (privyUserId: string) => {
  const apiUrl = `${env.ALLNADS_SERVER_API_URL}/api/users/${encodeURIComponent(privyUserId)}/address-book`;
  console.log(`getApiUrl: ${apiUrl}`);
  return apiUrl;
}

// Tool for getting all addresses in the address book
export const getAllAddressesTool = {
  name: 'get_all_addresses',
  description: 'Get all addresses in the user\'s address book',
  parameters: z.object({
    privyUserId: z.string()
      .min(1, 'Privy user ID is required')
      .describe('The Privy userId of the sender')
  }),
  
  execute: async (params: { privyUserId: string }): Promise<ContentResult> => {
    try {
      const { privyUserId } = params;
      
      const response = await fetch(getApiUrl(privyUserId), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.ALLNADS_SERVER_API_KEY}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      return createTextResponse(JSON.stringify(data, null, 2));
      
    } catch (error) {
      return createTextResponse(`Error getting address book: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};

// Tool for adding a new address to the address book
export const addAddressTool = {
  name: 'add_address',
  description: 'Add a new address to the user\'s address book',
  parameters: z.object({
    privyUserId: z.string()
      .min(1, 'Privy user ID is required')
      .describe('The Privy user ID of the sender'),
    addressName: z.string()
      .min(1, 'Address name is required')
      .describe('The name/label for the address'),
    address: z.string()
      .refine(addr => isAddress(addr), {
        message: 'Invalid ethereum address format',
        path: ['address']
      })
      .describe('The ethereum address to add')
  }),
  
  execute: async (params: { privyUserId: string; addressName: string; address: string }): Promise<ContentResult> => {
    try {
      const { privyUserId, addressName, address } = params;
      
      const response = await fetch(getApiUrl(privyUserId), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.ALLNADS_SERVER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: addressName,
          address: address
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      return createTextResponse(JSON.stringify(data, null, 2));
      
    } catch (error) {
      return createTextResponse(`Error adding address: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};

// Tool for removing an address from the address book
export const removeAddressTool = {
  name: 'remove_address',
  description: 'Remove an address from the user\'s address book',
  parameters: z.object({
    privyUserId: z.string()
      .min(1, 'Privy user ID is required')
      .describe('The Privy user ID of the sender'),
    addressIdentifier: z.string()
      .min(1, 'Address identifier is required')
      .describe('The address or name to find and remove from the address book')
  }),
  
  execute: async (params: { privyUserId: string; addressIdentifier: string }): Promise<ContentResult> => {
    try {
      const { privyUserId, addressIdentifier } = params;
      
      // First, get all addresses to find the ID
      const getResponse = await fetch(getApiUrl(privyUserId), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.ALLNADS_SERVER_API_KEY}`
        }
      });
      
      if (!getResponse.ok) {
        throw new Error(`API error while fetching addresses: ${getResponse.status}`);
      }
      
      const addressBook = await getResponse.json();
      console.log(`addressBook: ${JSON.stringify(addressBook, null, 2)}`);
      const entries: AddressBookEntry[] = addressBook.data.addresses || [];
      
      // Find the entry by name or address
      const targetEntry = entries.find(entry => 
        entry.name.toLowerCase() === addressIdentifier.toLowerCase() ||
        entry.address.toLowerCase() === addressIdentifier.toLowerCase()
      );
      
      if (!targetEntry) {
        return createTextResponse(JSON.stringify({
          success: false,
          error: `Address not found with identifier: ${addressIdentifier}`
        }, null, 2));
      }
      
      // Delete the address using its ID
      const deleteResponse = await fetch(`${getApiUrl(privyUserId)}/${targetEntry.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${env.ALLNADS_SERVER_API_KEY}`
        }
      });
      
      if (!deleteResponse.ok) {
        throw new Error(`API error while deleting: ${deleteResponse.status}`);
      }
      
      const data = await deleteResponse.json();
      return createTextResponse(JSON.stringify(data, null, 2));
      
    } catch (error) {
      return createTextResponse(`Error removing address: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};

// Tool for updating an address in the address book
export const updateAddressTool = {
  name: 'update_address',
  description: 'Update either the name or address of an existing entry in the user\'s address book',
  parameters: z.object({
    privyUserId: z.string()
      .min(1, 'Privy user ID is required')
      .describe('The Privy user ID of the sender'),
    addressIdentifier: z.string()
      .min(1, 'Address identifier is required')
      .describe('The current address or name to find in the address book'),
    newName: z.string()
      .optional()
      .describe('The new name for the address'),
    newAddress: z.string()
      .optional()
      .refine(addr => addr === undefined || isAddress(addr), {
        message: 'Invalid ethereum address format',
        path: ['newAddress']
      })
      .describe('The new ethereum address')
  }).refine(data => {
    // Ensure exactly one of newName or newAddress is provided
    return (data.newName !== undefined && data.newAddress === undefined) || 
           (data.newName === undefined && data.newAddress !== undefined);
  }, {
    message: 'Exactly one of newName or newAddress must be provided',
    path: ['newName', 'newAddress']
  }),
  
  execute: async (params: { 
    privyUserId: string; 
    addressIdentifier: string;
    newName?: string;
    newAddress?: string;
  }): Promise<ContentResult> => {
    try {
      const { privyUserId, addressIdentifier, newName, newAddress } = params;
      
      if ((newName && newAddress) || (!newName && !newAddress)) {
        return createTextResponse(JSON.stringify({
          success: false,
          error: 'Exactly one of newName or newAddress must be provided'
        }, null, 2));
      }

      // First, get all addresses to find the ID
      const getResponse = await fetch(getApiUrl(privyUserId), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.ALLNADS_SERVER_API_KEY}`
        }
      });
      
      if (!getResponse.ok) {
        throw new Error(`API error while fetching addresses: ${getResponse.status}`);
      }
      
      const addressBook = await getResponse.json();
      const entries: AddressBookEntry[] = addressBook.data.addresses || [];
      
      // Find the entry by name or address
      const targetEntry = entries.find(entry => 
        entry.name.toLowerCase() === addressIdentifier.toLowerCase() ||
        entry.address.toLowerCase() === addressIdentifier.toLowerCase()
      );
      
      if (!targetEntry) {
        return createTextResponse(JSON.stringify({
          success: false,
          error: `Address not found with identifier: ${addressIdentifier}`
        }, null, 2));
      }
      
      // Update the address using its ID
      const updateResponse = await fetch(`${getApiUrl(privyUserId)}/${targetEntry.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${env.ALLNADS_SERVER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newName || targetEntry.name,
          address: newAddress || targetEntry.address
        })
      });
      
      if (!updateResponse.ok) {
        throw new Error(`API error while updating: ${updateResponse.status}`);
      }
      
      const data = await updateResponse.json();
      return createTextResponse(JSON.stringify(data, null, 2));
      
    } catch (error) {
      return createTextResponse(`Error updating address: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};
