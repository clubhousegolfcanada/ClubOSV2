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

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m 'Add feature'`
3. Push branch: `git push origin feature/your-feature`
4. Open Pull Request

## License

Private - ClubOSV1
