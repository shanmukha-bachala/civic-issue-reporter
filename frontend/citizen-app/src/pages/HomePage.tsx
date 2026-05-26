import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, MapPin, Eye, Users, Clock, CheckCircle, AlertTriangle, Zap } from 'lucide-react';

const HomePage: React.FC = () => {
  const [recentIssues] = React.useState<any[]>([
    {
      id: '1',
      title: 'Pothole on Main Street',
      category: 'Road Maintenance',
      status: 'in_progress',
      priority: 'high',
      location: 'Main St & 5th Ave',
      time: '2 hours ago',
      icon: '🚧'
    },
    {
      id: '2',
      title: 'Broken Street Light',
      category: 'Street Lighting',
      status: 'submitted',
      priority: 'medium',
      location: 'Park Avenue',
      time: '4 hours ago',
      icon: '💡'
    },
    {
      id: '3',
      title: 'Overflowing Trash Can',
      category: 'Sanitation',
      status: 'resolved',
      priority: 'low',
      location: 'Central Park',
      time: '1 day ago',
      icon: '🗑️'
    }
  ]);

  const [summary, setSummary] = React.useState<{ totalIssues: number; totalReporters: number }>({ totalIssues: 0, totalReporters: 0 });
  const [topReporters, setTopReporters] = React.useState<{ id: string; name: string; issueCount: number }[]>([]);
  React.useEffect(() => {
    fetch('http://localhost:5000/api/analytics/public-summary').then(r => r.json()).then(j => { if (j?.success) setSummary(j.data); });
    fetch('http://localhost:5000/api/analytics/top-reporters?limit=5').then(r => r.json()).then(j => { if (j?.success) setTopReporters(j.data); });
  }, []);
  const stats = [
    { label: 'Total Issues Reported', value: String(summary.totalIssues), icon: AlertTriangle, color: 'text-blue-600' },
    { label: 'Active Citizens', value: String(summary.totalReporters), icon: Users, color: 'text-purple-600' },
  ];

  const getStatusBadge = (status: string) => {
    const badges = {
      submitted: 'bg-yellow-100 text-yellow-800',
      acknowledged: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-purple-100 text-purple-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    return badges[status as keyof typeof badges] || badges.submitted;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'text-gray-500',
      medium: 'text-yellow-500',
      high: 'text-orange-500',
      urgent: 'text-red-500'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  return (
    <div className="min-h-screen app-ui-bg">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              {(() => {
                const [error, setError] = [false, () => {}] as any; // placeholder for JSX scope
                return (
                  <img
                    src={process.env.REACT_APP_LOGO_URL || '/logo.png'}
                    alt="Logo"
                    className="w-16 h-16 object-contain rounded hidden"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                );
              })()}
              {React.createElement(require('../components/CivicLogo').default, { size: 64 })}
            </div>
            <h1 className="text-4xl font-bold mb-4">
              Report Civic Issues in Your Community
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Help improve your neighborhood by reporting issues like potholes, broken streetlights, 
              and maintenance problems. Track progress and stay informed.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/map"
                className="inline-flex items-center px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-blue-600 transition-colors"
              >
                <MapPin className="w-5 h-5 mr-2" />
                View Issues Map
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  </div>
                  <Icon className={`w-8 h-8 ${stat.color}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Solved issues map only on Home page and only for visitors (hide after login) */}
        {(() => {
          let user: any = null; try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}
          if (user) return null;
          return (
            <div className="mt-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Recently Solved Issues</h2>
              {React.createElement(require('../components/SolvedIssuesMap').default)}
            </div>
          );
        })()}
      </div>

      {/* Top Reporters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Top 5 Citizens by Issues Reported</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {topReporters.length === 0 ? (
              <div className="p-6 text-gray-600">No data yet.</div>
            ) : topReporters.map((r) => (
              <div key={r.id} className="p-6 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900">{r.name}</div>
                <div className="text-sm text-gray-600">{r.issueCount} issues</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-sm text-gray-600 flex justify-between">
          <div>
            Trusted by {summary.totalReporters} citizens • {summary.totalIssues} issues reported
          </div>
          <div>
            © {new Date().getFullYear()} Civic Issues
          </div>
        </div>
      </footer>

      {/* How It Works */}
      <div className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Reporting civic issues is simple and helps create a better community for everyone.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">1. Report</h3>
              <p className="text-gray-600">
                Take a photo and describe the issue. We'll automatically detect your location.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">2. Track</h3>
              <p className="text-gray-600">
                Monitor the progress of your report and receive updates as it's being addressed.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">3. Resolve</h3>
              <p className="text-gray-600">
                Get notified when the issue is resolved and see the improvement in your community.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;