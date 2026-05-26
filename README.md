# Civic Issue Reporting & Management Platform

A comprehensive web-based platform that connects citizens with local municipal authorities to report, track, and resolve civic issues efficiently.

## 🌟 Features

### For Citizens
- **Simple Issue Reporting**: Photo capture, GPS location tagging, and voice/text descriptions
- **Real-time Tracking**: Track report progress with notifications at every stage
- **Live City Map**: View all reported issues and their current status
- **Mobile-first Design**: Responsive interface optimized for all devices

### For Municipal Staff
- **Interactive Dashboard**: Map and list view of all incoming reports
- **Smart Categorization**: Filter and categorize issues by type and urgency
- **Automated Routing**: Intelligent assignment to relevant departments
- **Performance Analytics**: Track response times, resolution rates, and trends

## 🏗️ Architecture

```
civic-issue-platform/
├── backend/              # Node.js/Express API server
│   ├── src/
│   ├── config/
│   ├── migrations/
│   └── tests/
├── frontend/             # React web applications
│   ├── citizen-app/      # Citizen reporting interface
│   ├── admin-dashboard/  # Municipal staff dashboard
│   └── shared/           # Shared components and utilities
├── docs/                 # Documentation
├── scripts/              # Deployment and utility scripts
└── docker/               # Docker configurations
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd civic-issue-platform
```

2. Set up the backend:
```bash
cd backend
npm install
npm run setup:db
npm run dev
```

3. Set up the frontend:
```bash
cd ../frontend/citizen-app
npm install
npm start
```

4. Access the applications:
- Citizen Dashboard: http://localhost:3000
- Admin Dashboard: http://localhost:3001
- API Server: http://localhost:5000

## 📖 Documentation

- [API Documentation](./docs/api.md)
- [Database Schema](./docs/database.md)
- [Deployment Guide](./docs/deployment.md)
- [User Guide](./docs/user-guide.md)

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT
- **File Storage**: Multer + Cloud Storage
- **Real-time**: Socket.io

### Frontend
- **Framework**: React
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS
- **Maps**: Leaflet/OpenStreetMap
- **HTTP Client**: Axios
- **Real-time**: Socket.io-client

### DevOps
- **Containerization**: Docker
- **Process Management**: PM2
- **Testing**: Jest, Supertest
- **Linting**: ESLint, Prettier

## 🌍 Environmental Impact

This platform promotes sustainable urban management by:
- Reducing response times to infrastructure issues
- Enabling data-driven resource allocation
- Improving citizen engagement in community well-being
- Supporting transparent governance

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
