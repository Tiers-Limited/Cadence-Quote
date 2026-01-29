import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { apiService } from '../services/apiService';
import DonutChart from '../components/JobAnalytics/DonutChart';
import CostBreakdownTable from '../components/JobAnalytics/CostBreakdownTable';

const JobAnalyticsPage = () => {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, [quoteId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiService.get(`/job-analytics/${quoteId}`);

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch analytics');
      }

      setAnalytics(data.data);
    } catch (err) {
      console.error('Error fetching job analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatusIcon = (status) => {
    switch (status) {
      case 'good':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fair':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'poor':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      default:
        return <TrendingUp className="h-5 w-5 text-gray-500" />;
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
          <Button
            variant="ghost"
            onClick={() => navigate('/quotes')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Quotes
          </Button>
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/quotes')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Quotes
          </Button>
          
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getHealthStatusColor(analytics.healthStatus)}`}>
            {getHealthStatusIcon(analytics.healthStatus)}
            <span className="text-sm font-medium capitalize">
              {analytics.healthStatus} Profitability
            </span>
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Job Analytics
          </h1>
          <div className="text-gray-600">
            <p className="text-lg">
              Quote #{analytics.quoteNumber} - {analytics.customerName}
            </p>
            <p className="text-sm">
              Final Job Price: <span className="font-semibold text-gray-900">
                ${analytics.jobPrice.toLocaleString()}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cost Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart analytics={analytics} />
          </CardContent>
        </Card>

        {/* Cost Breakdown Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <CostBreakdownTable analytics={analytics} />
          </CardContent>
        </Card>
      </div>

      {/* Industry Standards Comparison */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Industry Standards Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(analytics.industryStandards).map(([category, standard]) => {
              const actual = analytics.breakdown[category]?.percentage || 0;
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

      {/* Analysis & Recommendations */}
      {analytics.analysis && (analytics.analysis.warnings.length > 0 || analytics.analysis.recommendations.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis & Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.analysis.warnings.length > 0 && (
                <div>
                  <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Warnings
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-yellow-700">
                    {analytics.analysis.warnings.map((warning, index) => (
                      <li key={index} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analytics.analysis.recommendations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Recommendations
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    {analytics.analysis.recommendations.map((recommendation, index) => (
                      <li key={index} className="text-sm">{recommendation}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer Info */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Analytics calculated on {new Date(analytics.calculatedAt).toLocaleDateString()} at{' '}
          {new Date(analytics.calculatedAt).toLocaleTimeString()}
        </p>
        <p className="mt-1">
          This is a read-only analysis. No pricing modifications can be made from this view.
        </p>
      </div>
    </div>
  );
};

export default JobAnalyticsPage;