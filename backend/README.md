# AllNads Backend

## Overview
AllNads Backend is a Node.js Express server that provides API endpoints for chat functionality, user management, NFT operations, and Model Context Protocol (MCP) integration. The application uses PostgreSQL with Drizzle ORM for data persistence.

## Features
- Real-time chat functionality via WebSockets
- RESTful API endpoints for chat, user management, and NFT operations
- Model Context Protocol (MCP) integration
- PostgreSQL database with Drizzle ORM
- Authentication using Privy
- Blockchain service integration

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Language**: TypeScript
- **Real-time Communication**: WebSockets
- **Authentication**: Privy
- **AI Integration**: OpenRouter API
- **Blockchain Integration**: Viem

## Prerequisites
- Node.js (v16+)
- PostgreSQL
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```
Edit the `.env` file with your configuration.

4. Set up the database:
```bash
npm run db:generate
npm run db:migrate
```

## Environment Variables

Key environment variables include:
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development, production)
- `OPENROUTER_API_KEY`: OpenRouter API key
- `OPENROUTER_MODEL`: OpenRouter model to use
- `SERVICE_API_KEY`: API key for service authentication
- `POSTGRES_*`: PostgreSQL connection details
- `PRIVY_APP_ID`: Your Privy App ID
- `PRIVY_APP_SECRET`: Your Privy App Secret

See `.env.example` for all required variables.

## Database Schema
The application uses the following main tables:
- `sessions`: Stores chat sessions
- `messages`: Stores chat messages
- `addressBook`: Stores user address book entries
- `userClaims`: Tracks NFT and token claims

## Available Scripts
- `npm start`: Start the production server
- `npm run dev`: Start the development server with hot reload
- `npm run build`: Build the TypeScript project
- `npm run lint`: Run ESLint
- `npm run db:generate`: Generate Drizzle migrations
- `npm run db:migrate`: Run database migrations

## API Endpoints

### Health Check
- `GET /api/health`: Check server status

### Chat
- `GET /api/chat`: Chat API endpoints
- WebSocket: `ws://localhost:3000/ws` for real-time chat

### User Management
- `GET /api/users`: User management endpoints

### NFT Operations
- `GET /api/nft`: NFT-related endpoints

### MCP Integration
- `GET /api/mcp`: Model Context Protocol endpoints

## Development
The project follows a modular Express.js architecture with clear separation of concerns:

### Project Structure
```
src/
├── controllers/     # Request handlers for API endpoints
│   ├── addressBookController.ts  # Address book management
│   ├── chatController.ts         # Chat functionality
│   ├── mcpController.ts          # Model Context Protocol integration
│   ├── nftController.ts          # NFT operations
│   └── userController.ts         # User management
├── models/          # Database schema definitions and ORM models
├── routes/          # API route definitions and endpoint mapping
├── services/        # Business logic and third-party service integration
├── middleware/      # Express middleware (auth, validation, error handling)
├── utils/           # Helper functions and common utilities
├── config/          # Application configuration and environment setup
├── types/           # TypeScript type definitions and interfaces
│   ├── chat.ts      # Chat-related type definitions
│   └── mcp.ts       # MCP-related type definitions
├── contracts/       # Blockchain smart contract ABIs
│   ├── AllNads.json
│   ├── AllNadsAccount.json
│   ├── AllNadsComponent.json
│   └── AllNadsAirdropper.json
└── scripts/         # Utility scripts for tasks like database migration
    └── db-migrate.ts
```

### Development Workflow
1. Make changes to the codebase
2. Run linting: `npm run lint`
3. Test your changes locally: `npm run dev`
4. Build the project: `npm run build`
5. Deploy to your environment

## License

MIT


