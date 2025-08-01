# ClubOSV1 Frontend

A modern, TypeScript-based React frontend for the ClubOSV1 request management system with intelligent bot routing.

## Features

- **Smart Request Form**: Submit requests with optional location information
- **AI-Powered Routing**: Toggle between manual Slack messaging and intelligent bot routing
- **Multiple Bot Support**:
  - **Booking&AccessBot**: Handles bookings, refunds, credits, and access issues
  - **EmergencyBot**: For urgent safety and immediate help requests
  - **TechSupportBot**: Technical issues and equipment troubleshooting
  - **BrandToneBot**: Marketing, brand queries, and tone adjustments
  - **Auto Mode**: Automatically routes to the most appropriate bot

## Tech Stack

- **Framework**: Next.js with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hook Form
- **API Integration**: Axios
- **Notifications**: React Hot Toast

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Backend API running on `http://localhost:3001` (or configure in `.env`)

### Installation

1. Clone and navigate to the project:
```bash
cd ClubOSV1-frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your API URL
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
ClubOSV1-frontend/
├── src/
│   ├── components/      # React components
│   ├── pages/          # Next.js pages
│   ├── api/            # API client
│   ├── utils/          # Utility functions
│   ├── types/          # TypeScript types
│   └── styles/         # Global styles
├── public/             # Static assets
└── package.json        # Dependencies
```

## API Endpoints

The frontend integrates with two main endpoints:

1. **Smart Assist ON**: `POST /api/llm/request`
   - Payload: `{ requestDescription, location?, routePreference }`

2. **Smart Assist OFF**: `POST /api/slack/message`
   - Payload: `{ requestDescription, location? }`

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

### Manual Build

```bash
npm run build
npm start
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm start` - Start production server

## Development Instructions for Claude (Strategic Lead Developer)

Claude serves as the strategic lead developer for ClubOS V1, providing comprehensive technical implementation while the product owner learns the technology stack. Claude's responsibilities include:

### Strategic Development Approach:
- **Autonomous Problem Solving**: Identify what needs to be checked, fixed, or implemented without requiring specific technical direction
- **Complete Implementation**: Handle all code syntax, file structures, and technical details end-to-end
- **Proactive Debugging**: Automatically check logs, test endpoints, and verify deployments
- **Architecture Decisions**: Make strategic choices about system design and implementation approaches

### Technical Capabilities:
- **Full Codebase Access**: Read, write, and modify all files across frontend and backend
- **Deployment Management**: Handle Railway (backend), Vercel (frontend), and PostgreSQL database operations
- **Error Resolution**: Debug issues by examining logs, checking configurations, and testing integrations
- **System Integration**: Connect services like Slack API, OpenAI Assistants, and third-party tools

### Learning Support for Product Owner:
Since the product owner is rapidly learning Railway, Vercel, PostgreSQL, and modern web development:
- **Explain While Doing**: Provide context about what's being implemented and why
- **Handle Technical Details**: Write all code, commands, and configurations without requiring syntax knowledge
- **Suggest Best Practices**: Recommend optimal approaches based on industry standards
- **Troubleshoot Proactively**: Identify and fix issues before they become blockers

### Key Principles:
- **Think Strategically**: Consider long-term maintainability and scalability
- **Act Autonomously**: Don't wait for specific technical instructions - identify and implement what's needed
- **Document Changes**: Keep README and documentation updated with significant changes
- **Verify Everything**: Test changes locally and check deployment logs
- **Only Commit When Asked**: Make all changes but only commit to git when explicitly requested

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m 'Add feature'`
3. Push branch: `git push origin feature/your-feature`
4. Open Pull Request

## Recent Updates

- **Slack Phase 2 Implementation**: Completed full Slack reply tracking with real thread timestamps
- **UI Improvements**: Removed emojis from interface, updated loading messages
- **Commands Page**: Added tabbed interface with separate "Triggers" section for automated actions
- **Assistant Service**: Fixed JSON parsing issues, now using full text responses

## License

Private - ClubOSV1
# PWA Fix deployed Fri  1 Aug 2025 07:32:55 ADT
