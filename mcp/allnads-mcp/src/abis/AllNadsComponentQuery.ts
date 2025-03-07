export const AllNadsComponentQueryABI = [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_componentContract",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "internalType": "uint256[]",
          "name": "templateIds",
          "type": "uint256[]"
        }
      ],
      "name": "batchCheckTemplateOwnership",
      "outputs": [
        {
          "internalType": "bool[]",
          "name": "ownedTemplates",
          "type": "bool[]"
        },
        {
          "internalType": "uint256[]",
          "name": "tokenIds",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "componentContract",
      "outputs": [
        {
          "internalType": "contract AllNadsComponent",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "getAllOwnedTemplates",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "ownedTemplateIds",
          "type": "uint256[]"
        },
        {
          "internalType": "enum AllNadsComponent.ComponentType[]",
          "name": "templateTypes",
          "type": "uint8[]"
        },
        {
          "internalType": "uint256[]",
          "name": "tokenIds",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "getOwnedTemplateCounts",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "counts",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "internalType": "enum AllNadsComponent.ComponentType",
          "name": "componentType",
          "type": "uint8"
        }
      ],
      "name": "getOwnedTemplatesByType",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "ownedTemplateIds",
          "type": "uint256[]"
        },
        {
          "internalType": "uint256[]",
          "name": "ownedTokenIds",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]