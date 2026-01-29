import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { apiService } from '../services/apiService';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Eye,
  DollarSign,
  BarChart3,
  PieChart,
  Calendar
} from 'lucide-react';

const JobAnalyticsOverviewPage = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalyticsSummary();
  }, []);

  const fetchAnalyticsSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiService.get('/job-analytics/tenant/summary');

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch analytics summary');
      }

      setSummary(data.data);
    } catch (err) {
      console.error('Error fetching analytics summary:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatusIcon = (status) => {
    switch (status) {
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fair':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'poor':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <TrendingUp className="h-4 w-4 text-gray-500" />;
    }
  };

  const getHealthStatusColor = (status) => {
    switch (status) {
      case 'good':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'fair':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'poor':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Analytics</h1>
        </div>

        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>

        {error.includes('overhead') && (
          <div className="mt-4">
            <Button
              onClick={() => navigate('/settings')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Configure Settings
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!summary || summary.totalJobs === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Analytics</h1>
          <p className="text-gray-600">Track profitability and cost breakdowns for completed jobs</p>
        </div>

        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <PieChart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analytics Available</h3>
              <p className="text-gray-600 mb-6">
                Complete some jobs and mark them as finished to see analytics data here.
              </p>
              <Button
                onClick={() => navigate('/quotes')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                View Quotes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Analytics</h1>
        <p className="text-gray-600">
          Profitability analysis and cost breakdowns for {summary.totalJobs} completed jobs
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalJobs}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Healthy Jobs</p>
                <p className="text-2xl font-bold text-green-600">{summary.healthyJobs}</p>
                <p className="text-xs text-gray-500">{summary.healthPercentage}% of total</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Profit</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.averages.profitPercentage.toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Job Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${summary.averages.averageJobPrice.toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Industry Standards Comparison */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Average Performance vs Industry Standards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(summary.industryStandards).map(([category, standard]) => {
              const actual = summary.averages[`${category}Percentage`] || 0;
              const isWithinRange = actual >= standard.min && actual <= standard.max;
              
              return (
                <div key={category} className="text-center p-4 border rounded-lg">
                  <h4 className="font-semibold capitalize mb-2">{category}</h4>
                  <div className="space-y-1">
                    <div className={`text-2xl font-bold ${isWithinRange ? 'text-green-600' : 'text-red-600'}`}>
                      {actual.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">
                      Target: {standard.min}%-{standard.max}%
                    </div>
                    <div className={`text-xs px-2 py-1 rounded ${isWithinRange ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {isWithinRange ? 'Within Range' : 'Outside Range'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Job Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {summary.recentJobs.map((job) => (
              <div key={job.quoteId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        Quote #{job.quoteNumber}
                      </h4>
                      <p className="text-sm text-gray-600">{job.customerName}</p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getHealthStatusColor(job.healthStatus)}`}>
                      {getHealthStatusIcon(job.healthStatus)}
                      <span className="capitalize">{job.healthStatus}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      ${job.jobPrice.toLocaleString()}
                    </p>
                    <p className={`text-sm ${job.profitPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {job.profitPercentage >= 0 ? '+' : ''}{job.profitPercentage.toFixed(1)}% profit
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {new Date(job.calculatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/job-analytics/${job.quoteId}`)}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {summary.totalJobs > summary.recentJobs.length && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={() => navigate('/quotes')}
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                View All Jobs
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default JobAnalyticsOverviewPage;