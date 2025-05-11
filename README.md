# Dance Flow Platform

A modern web application for choreographers and dancers to create, share, and perfect dance routines.

## Video Analyzer - Dancer Detection

The platform includes a video analyzer component that can detect dancers in video. The current implementation focuses on dancer detection in pause mode:

1. Enter "Find Dancer" mode
2. The video will automatically pause
3. Click on the area where a dancer is located
4. The system will outline the detected dancer

## Features

- Choreography Builder with 3D animation support
- Team Management for collaboration
- Video upload and processing
- 3D model visualization
- Access control and permissions
- Dancer detection in videos

## Tech Stack

- Frontend: React.js with Material-UI
- Backend: Python FastAPI with MediaPipe for pose detection
- Database: MongoDB
- 3D Visualization: Three.js

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- Python 3.8+ with pip
- MongoDB
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd dance-flow
```

2. Install client dependencies:
```bash
cd client
npm install
cd ..
```

3. Install server dependencies:
```bash
cd server
npm install
cd ..
```

4. Install backend dependencies:
```bash
cd backend
pip install -r requirements.txt
cd ..
```

### Running the Application

1. Start the backend (pose detection server):
```bash
cd backend
python run_server.py
```

2. Start the server:
```bash
cd server
npm run dev
```

3. Start the client:
```bash
cd client
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Project Structure

```
dance-flow/
├── client/             # React frontend
│   ├── src/
│   │   ├── components/ # React components
│   │   │   └── VideoAnalyzer.js  # Dancer detection UI
│   │   └── ...
├── server/             # Node.js server
│   └── ...
├── backend/            # Python backend for video analysis
│   ├── video_analyzer/ # Pose detection module
│   │   ├── __init__.py
│   │   └── detector.py # Pose detection implementation
│   ├── requirements.txt
│   └── run_server.py   # Backend server launcher
└── README.md
```

## Development

- Frontend code is located in the `client` directory
- Backend code is located in the `server`