This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# ChatBot Application

A responsive ChatBot application with a wallet interface designed for both desktop and mobile experiences.

## Features

- **Responsive Design**: Optimized for both desktop and mobile
- **Chat Interface**: Real-time messaging interface with chat history
- **Wallet Integration**: Displays balance and provides financial actions
- **Mobile Navigation**: Special mobile experience with intuitive navigation

## Layout

### Desktop
- Left: Chat history
- Middle: Chat area with message input
- Right: Wallet interface showing balance and avatar

### Mobile
- Default view: Wallet interface
- Chat button: Opens the chat area
- History button: Slides in chat history from the left

## Development

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

### Environment Variables

The application uses the following environment variables:

- `NEXT_PUBLIC_WEBSOCKET_URL`: WebSocket server URL (default: `ws://localhost:3030/ws`)
- `NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS`: Maximum WebSocket reconnection attempts (default: `5`) 
- `NEXT_PUBLIC_MAX_RECONNECT_DELAY`: Maximum delay in milliseconds between reconnection attempts (default: `30000`)
- `NEXT_PUBLIC_MOBILE_BREAKPOINT`: Screen width in pixels below which mobile layout is used (default: `768`)
- `NEXT_PUBLIC_LARGE_SCREEN_BREAKPOINT`: Screen width in pixels above which large screen layout is used (default: `1024`)

Create a `.env.local` file in the root of the project with these variables:

```bash
# WebSocket connection URL
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3030/ws

# WebSocket reconnection settings
NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS=5
NEXT_PUBLIC_MAX_RECONNECT_DELAY=30000

# Responsive design breakpoints
NEXT_PUBLIC_MOBILE_BREAKPOINT=768
NEXT_PUBLIC_LARGE_SCREEN_BREAKPOINT=1024
```

You can customize these values based on your environment.

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Technologies

- Next.js 15.2
- React 19
- TypeScript
- Tailwind CSS 4

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
