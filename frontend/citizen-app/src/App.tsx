import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import ReportIssuePage from './pages/ReportIssuePage';
import IssuesMapPage from './pages/IssuesMapPage';
import MyIssuesPage from './pages/MyIssuesPage';
import LoginPage from './pages/LoginPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/report" element={<ReportIssuePage />} />
            <Route path="/map" element={<IssuesMapPage />} />
            <Route path="/map/citizen" element={React.createElement(require('./pages/CitizenOpenIssuesMapPage').default)} />
            <Route path="/map/admin" element={React.createElement(require('./pages/AdminAreaOpenIssuesMapPage').default)} />
            <Route path="/local" element={React.createElement(require('./pages/CitizenLocalConcernsPage').default)} />
            <Route path="/my-issues" element={<MyIssuesPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/profile" element={React.createElement(require('./pages/ProfilePage').default)} />
            <Route path="/admin/dashboard" element={React.createElement(require('./pages/admin/AdminDashboardPage').default)} />
            <Route path="/admin/analytics" element={React.createElement(require('./pages/admin/AdminAnalyticsPage').default)} />
            <Route path="/citizen/dashboard" element={React.createElement(require('./pages/CitizenDashboardPage').default)} />
            <Route path="/citizen/analytics" element={React.createElement(require('./pages/CitizenAnalyticsPage').default)} />
            <Route path="/issues/:id" element={React.createElement(require('./pages/IssueDetailPage').default)} />
            <Route path="/signup/citizen" element={React.createElement(require('./pages/CitizenSignUpPage').default)} />
            <Route path="/signup/admin" element={React.createElement(require('./pages/AdminSignUpPage').default)} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
