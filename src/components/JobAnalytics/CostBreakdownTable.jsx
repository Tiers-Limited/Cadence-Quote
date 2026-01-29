import React from 'react';
import { Badge } from '../ui/badge';
import { Info } from 'lucide-react';

const CostBreakdownTable = ({ analytics }) => {
  if (!analytics || !analytics.breakdown) {
    return (
      <div className="text-center text-gray-500 py-8">
        No breakdown data available
      </div>
    );
  }

  const { breakdown, industryStandards } = analytics;

  const getSourceBadge = (source) => {
    const sourceConfig = {
      actual: { label: 'Actual', variant: 'success', description: 'Real tracked costs' },
      estimated: { label: 'Estimated', variant: 'secondary', description: 'From original quote' },
      target: { label: 'Target', variant: 'info', description: 'From settings percentage' },
      calculated: { label: 'Calculated', variant: 'default', description: 'Remainder after allocations' },
      default: { label: 'Default', variant: 'warning', description: 'No data available' }
    };

    const config = sourceConfig[source] || sourceConfig.default;
    
    return (
      <Badge 
        variant={config.variant}
        className="text-xs"
        title={config.description}
      >
        {config.label}
      </Badge>
    );
  };

  const getPercentageStatus = (category, percentage) => {
    const standard = industryStandards[category];
    if (!standard) return 'neutral';

    if (percentage >= standard.min && percentage <= standard.max) {
      return 'good';
    } else if (percentage < standard.min - 5 || percentage > standard.max + 5) {
      return 'poor';
    } else {
      return 'fair';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'good':
        return 'text-green-600 bg-green-50';
      case 'fair':
        return 'text-yellow-600 bg-yellow-50';
      case 'poor':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const categories = [
    { key: 'materials', label: 'Materials', icon: '🎨' },
    { key: 'labor', label: 'Labor', icon: '👷' },
    { key: 'overhead', label: 'Overhead', icon: '🏢' },
    { key: 'profit', label: 'Net Profit', icon: breakdown.profit.amount >= 0 ? '💰' : '⚠️' }
  ];

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Percentage
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {categories.map((category) => {
              const data = breakdown[category.key];
              const status = getPercentageStatus(category.key, data.percentage);
              
              return (
                <tr key={category.key} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-lg mr-2">{category.icon}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {category.label}
                        </div>
                        {industryStandards[category.key] && (
                          <div className="text-xs text-gray-500">
                            Target: {industryStandards[category.key].min}%-{industryStandards[category.key].max}%
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <div className={`text-sm font-medium ${data.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      ${Math.abs(data.amount).toLocaleString()}
                      {data.amount < 0 && <span className="text-red-500 ml-1">(Loss)</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                      {data.percentage >= 0 ? '+' : ''}{data.percentage.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    {getSourceBadge(data.source)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                Total
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                ${analytics.jobPrice.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                100.0%
              </td>
              <td className="px-4 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Data Source Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <div className="font-medium text-blue-900 mb-2">Data Sources</div>
            <div className="space-y-1 text-blue-800">
              <div><strong>Actual:</strong> Real costs tracked during job execution</div>
              <div><strong>Estimated:</strong> Costs from the original quote</div>
              <div><strong>Target:</strong> Percentage-based allocation from settings</div>
              <div><strong>Calculated:</strong> Remainder after all other allocations</div>
              <div><strong>Default:</strong> No data available, using $0</div>
            </div>
          </div>
        </div>
      </div>

      {/* Profitability Summary */}
      <div className={`border rounded-lg p-4 ${analytics.isHealthy ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-sm font-medium ${analytics.isHealthy ? 'text-green-900' : 'text-red-900'}`}>
              Profitability Status: {analytics.healthStatus.charAt(0).toUpperCase() + analytics.healthStatus.slice(1)}
            </div>
            <div className={`text-xs ${analytics.isHealthy ? 'text-green-700' : 'text-red-700'}`}>
              {analytics.isHealthy 
                ? 'Profit margin meets healthy business standards (≥8%)'
                : 'Profit margin below recommended minimum of 8%'
              }
            </div>
          </div>
          <div className={`text-2xl font-bold ${analytics.isHealthy ? 'text-green-600' : 'text-red-600'}`}>
            {breakdown.profit.percentage >= 0 ? '+' : ''}{breakdown.profit.percentage.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostBreakdownTable;