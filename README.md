# Dance Choreography Platform

A modern web application for choreographers and dancers to create, share, and perfect dance routines.

## Features

- Choreography Builder with 3D animation support
- Team Management for collaboration
- Video upload and processing
- 3D model visualization
- Access control and permissions

## Tech Stack

- Frontend: React.js with Material-UI
- Backend: Node.js with Express
- Database: MongoDB
- 3D Visualization: Three.js

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd dance-choreography-platform
```

2. Install dependencies:
```bash
# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

3. Create a `.env` file in the server directory:
```
MONGODB_URI=mongodb://localhost:27017/dance-platform
JWT_SECRET=your-secret-key
PORT=5000
```

4. Start the development servers:
```bash
# Start the backend server
cd server
npm run dev

# Start the frontend development server
cd client
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## Development

- Frontend code is located in the `client` directory
- Backend code is located in the `server` directory
- API documentation will be available at `/api-docs` when the server is running

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

