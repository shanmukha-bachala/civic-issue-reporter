import React from 'react';
import { List, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const MyIssuesPage: React.FC = () => {
  return (
    <div className="min-h-screen app-auth-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Issues</h1>
          <Link
            to="/report"
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Report New Issue
          </Link>
        </div>
        
        <div className="card p-8">
          <div className="text-center">
            <List className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Issues Reported Yet</h2>
            <p className="text-gray-600 mb-6">
              You haven't reported any civic issues yet. Start by reporting your first issue!
            </p>
            <Link
              to="/report"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Report Your First Issue
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyIssuesPage;