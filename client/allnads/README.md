# AllNads Client

AllNads Client is a web application that provides an AI chatbot experience for users who own an AllNads NFT. The application integrates blockchain authentication, NFT verification, and a real-time chat interface.

## Features

- **Web3 Authentication**: Secure login using Privy for wallet-based authentication
- **NFT Verification**: Access to the AI chatbot is gated by NFT ownership
- **NFT Airdrop**: Users without an NFT can request one to access the platform
- **Real-time Chat**: WebSocket-based chat interface with the AI assistant
- **Chat History**: Save and manage multiple chat sessions
- **Responsive Design**: Works on mobile, tablet, and desktop devices
- **Progressive Web App**: Can be installed on devices for offline access

## Tech Stack

- **Frontend**: Next.js 15.2.0 with React 19
- **Styling**: TailwindCSS 4
- **Authentication**: Privy.io for Web3 authentication
- **State Management**: React hooks and context
- **Web3 Integration**: Viem for blockchain interactions
- **Real-time Communication**: WebSocket for chat functionality
- **TypeScript**: For type safety and better developer experience
- **PWA Support**: next-pwa for Progressive Web App capabilities

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Privy.io account for authentication

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd allnads
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env.local` file based on the example:
   ```bash
   cp .env.local.example .env.local
   ```

4. Update the environment variables in `.env.local`:
   ```
    # WebSocket connection URL
    NEXT_PUBLIC_WEBSOCKET_URL='YOUR_WEBSOCKET_URL'
    NEXT_PUBLIC_API_URL='YOUR_API_URL'

    # WebSocket reconnection settings
    NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS=5
    NEXT_PUBLIC_MAX_RECONNECT_DELAY=30000

    # Responsive design breakpoints
    NEXT_PUBLIC_MOBILE_BREAKPOINT=768
    NEXT_PUBLIC_LARGE_SCREEN_BREAKPOINT=1024 

    # Privy App ID
    NEXT_PUBLIC_PRIVY_APP_ID='YOUR_PRIVY_APP_ID'

    # Monad Testnet RPC
    NEXT_PUBLIC_MONAD_TESTNET_RPC='YOUR_MONAD_TESTNET_RPC'

    # Monad Testnet AllNads Contracts
    NEXT_PUBLIC_MONAD_TESTNET_ALLNADS_CONTRACT_ADDRESS=0xaeFD9d3471d5C76407F1A3F750Cbe255b5BA194C
    NEXT_PUBLIC_MONAD_TESTNET_ALLNADS_COMPONENT_CONTRACT_ADDRESS=0x8DF326e1E7c06F9236B98CE94aeb9eaB2f0B1Cbd
    NEXT_PUBLIC_MONAD_TESTNET_ALLNADS_COMPONENT_QUERY_CONTRACT_ADDRESS=0xD5514E2116a26A8efC0E064561409E207202dAE6
   ```

### Development

Run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Building for Production

```bash
npm run build
npm run start
# or
yarn build
yarn start
```

## Project Structure

- `/src/app`: Main application code
  - `/components`: Reusable UI components
  - `/contexts`: React context providers
  - `/hooks`: Custom React hooks
  - `/services`: Service classes for API interactions
  - `/types`: TypeScript type definitions
  - `/utils`: Utility functions
  - `/app`: Main application page
  - `/login`: Authentication page
  - `/airdrop`: NFT airdrop page
  - `/offline`: Offline fallback page

## User Flow

1. User visits the application and is redirected to the login page
2. User authenticates with their wallet using Privy
3. The application checks if the user owns an NFT
4. If the user has an NFT, they are redirected to the main app
5. If the user doesn't have an NFT, they are redirected to the airdrop page
6. On the airdrop page, the user can request an NFT
7. Once the user has an NFT, they can access the AI chatbot
8. The user can create new chat sessions, send messages, and view chat history

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgements

- [Privy.io](https://privy.io) for Web3 authentication
- [Next.js](https://nextjs.org) for the React framework
- [TailwindCSS](https://tailwindcss.com) for styling
- [Viem](https://viem.sh) for Ethereum interactions
