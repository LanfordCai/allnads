"use client";
import { useState } from 'react';
import { useNotification } from '../contexts/NotificationContext';

interface AddressEntry {
  name: string;
  address: string;
  id: string; // Adding an id field for easier deletion
}

interface AddressBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  nftAccount?: string | null;
}

export default function AddressBookModal({ 
  isOpen, 
  onClose
}: AddressBookModalProps) {
  const { showNotification } = useNotification();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  
  // Mock data for address book entries - in a real app, this would come from a database or blockchain
  const [addressEntries, setAddressEntries] = useState<AddressEntry[]>([
    { id: '1', name: "Alice", address: "0x1234567890123456789012345678901234567890" },
    { id: '2', name: "Bob", address: "0x2345678901234567890123456789012345678901" },
    { id: '3', name: "Charlie", address: "0x3456789012345678901234567890123456789012" },
    { id: '4', name: "David", address: "0x4567890123456789012345678901234567890123" },
    { id: '5', name: "Eve", address: "0x5678901234567890123456789012345678901234" },
    { id: '6', name: "Frank", address: "0x6789012345678901234567890123456789012345" },
    { id: '7', name: "Grace", address: "0x7890123456789012345678901234567890123456" },
  ]);
  
  // Format address for display
  const formatAddress = (address: string) => {
    if (!address || address.length < 42) return address;
    return `${address.substring(0, 10)}...${address.substring(address.length - 8)}`;
  };
  
  // Copy address to clipboard
  const copyToClipboard = (address: string, name: string) => {
    navigator.clipboard.writeText(address);
    showNotification(`${name}'s address copied to clipboard`, "success");
  };
  
  // Delete an address entry
  const deleteEntry = (id: string) => {
    const entryToDelete = addressEntries.find(entry => entry.id === id);
    if (entryToDelete) {
      setAddressEntries(addressEntries.filter(entry => entry.id !== id));
      showNotification(`${entryToDelete.name}'s address has been removed`, "success");
    }
  };
  
  // Add a new address entry
  const addNewAddress = () => {
    // Basic validation
    if (!newName.trim()) {
      showNotification("Please enter a name", "error");
      return;
    }
    
    if (!newAddress.trim()) {
      showNotification("Please enter an address", "error");
      return;
    }
    
    // Simple Ethereum address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(newAddress)) {
      showNotification("Please enter a valid Ethereum address", "error");
      return;
    }
    
    // Create new entry with a unique ID
    const newEntry: AddressEntry = {
      id: Date.now().toString(),
      name: newName.trim(),
      address: newAddress.trim()
    };
    
    // Add to the list
    setAddressEntries([...addressEntries, newEntry]);
    
    // Reset form
    setNewName('');
    setNewAddress('');
    setShowAddForm(false);
    
    // Show success notification
    showNotification(`${newName} has been added to your address book`, "success");
  };
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Modal backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
        onClick={onClose}
      >
        {/* Modal content */}
        <div 
          className="bg-white rounded-xl shadow-[8px_8px_0px_0px_#8B5CF6] border-4 border-[#8B5CF6] w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col m-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="p-4 border-b-4 border-[#8B5CF6] flex justify-between items-center">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-[#6D28D9]">
                {showAddForm ? "Add New Address" : "Address Book"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {showAddForm ? "Enter the details of the address you want to save" : "Manage your saved addresses"}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-[#8B5CF6] hover:text-[#7C3AED] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Add New Address Form */}
            {showAddForm ? (
              <div className="p-4 rounded-lg border border-[#C4B5FD]">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-[#6D28D9] mb-1">Name</label>
                    <input
                      type="text"
                      id="name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full p-2 border border-[#C4B5FD] rounded-md focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                      placeholder="Enter name"
                    />
                  </div>
                  <div>
                    <label htmlFor="address" className="block text-sm font-medium text-[#6D28D9] mb-1">Ethereum Address</label>
                    <input
                      type="text"
                      id="address"
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      className="w-full p-2 border border-[#C4B5FD] rounded-md focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] font-mono"
                      placeholder="0x..."
                    />
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="py-2 px-4 rounded-lg font-medium text-sm transition-all
                        bg-white text-[#6D28D9] border border-[#C4B5FD] hover:bg-[#F3F0FF]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addNewAddress}
                      className="py-2 px-4 rounded-lg font-bold text-sm transition-all
                        bg-[#8B5CF6] text-white border-2 border-[#7C3AED] shadow-[2px_2px_0px_0px_#5B21B6] 
                        hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#5B21B6]"
                    >
                      Save Address
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Address List */
              <div className="rounded-lg border border-[#C4B5FD] overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 bg-[#F3F0FF] p-3 font-medium text-xs text-[#6D28D9] uppercase">
                  <div className="col-span-3 pl-3">Name</div>
                  <div className="col-span-7">Address</div>
                  <div className="col-span-2 text-center">Actions</div>
                </div>
                
                {/* Table Body with Scrollable Content */}
                <div className="max-h-[250px] overflow-y-auto">
                  {addressEntries.length > 0 ? (
                    addressEntries.map((entry) => (
                      <div key={entry.id} className="grid grid-cols-12 p-3 border-t border-[#C4B5FD] hover:bg-[#F9F7FF]">
                        <div className="col-span-3 pl-3 font-medium">{entry.name}</div>
                        <div className="col-span-7 font-mono text-[#6D28D9]">
                          {formatAddress(entry.address)}
                        </div>
                        <div className="col-span-2 flex justify-center space-x-2">
                          <button
                            className="p-1 text-[#8B5CF6] hover:bg-[#F3F0FF] rounded-md transition-colors"
                            onClick={() => copyToClipboard(entry.address, entry.name)}
                            aria-label="Copy address"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                            </svg>
                          </button>
                          <button
                            className="p-1 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            onClick={() => deleteEntry(entry.id)}
                            aria-label="Delete address"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32">
                      <p className="text-gray-500">No addresses saved yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Modal Footer with Add New Address button */}
          <div className="p-4 border-t border-gray-200 flex justify-end">
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="py-2 px-4 rounded-lg font-bold text-sm transition-all
                  bg-[#8B5CF6] text-white border-2 border-[#7C3AED] shadow-[2px_2px_0px_0px_#5B21B6] 
                  hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#5B21B6]"
              >
                Add New Address
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
} 