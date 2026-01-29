import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const DonutChart = ({ analytics }) => {
  if (!analytics || !analytics.breakdown) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No analytics data available
      </div>
    );
  }

  const { breakdown } = analytics;

  // Prepare chart data
  const data = [
    {
      name: 'Materials',
      value: breakdown.materials.amount,
      percentage: breakdown.materials.percentage,
      source: breakdown.materials.source,
      color: '#3B82F6' // Blue
    },
    {
      name: 'Labor',
      value: breakdown.labor.amount,
      percentage: breakdown.labor.percentage,
      source: breakdown.labor.source,
      color: '#10B981' // Green
    },
    {
      name: 'Overhead',
      value: breakdown.overhead.amount,
      percentage: breakdown.overhead.percentage,
      source: breakdown.overhead.source,
      color: '#F59E0B' // Amber
    },
    {
      name: 'Net Profit',
      value: breakdown.profit.amount,
      percentage: breakdown.profit.percentage,
      source: breakdown.profit.source,
      color: breakdown.profit.amount >= 0 ? '#8B5CF6' : '#EF4444' // Purple for positive, red for negative
    }
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const sourceText = data.source === 'actual' ? 'Actual Cost' : 
                        data.source === 'estimated' ? 'Estimated Cost' :
                        data.source === 'target' ? 'Target Percentage' :
                        data.source === 'calculated' ? 'Calculated' :
                        data.source === 'default' ? 'Default (No Data)' : 
                        data.source;

      return (
        <div className="bg-gray-800 text-white p-3 rounded-lg shadow-lg border">
          <p className="font-semibold">{data.name}</p>
          <p>Amount: ${data.value.toLocaleString()}</p>
          <p>Percentage: {data.percentage.toFixed(1)}%</p>
          <p>Source: {sourceText}</p>
        </div>
      );
    }
    return null;
  };

  // Custom label function
  const renderLabel = (entry) => {
    return `${entry.percentage.toFixed(1)}%`;
  };

  return (
    <div className="relative">
      {/* Chart Container */}
      <div className="h-80 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={100}
              innerRadius={60}
              fill="#8884d8"
              dataKey="value"
              animationBegin={0}
              animationDuration={1000}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value, entry) => `${value}: ${entry.payload.percentage.toFixed(1)}%`}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              ${analytics.jobPrice.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">
              Total Job Price
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="font-semibold text-gray-900">
            {breakdown.profit.percentage >= 0 ? '+' : ''}{breakdown.profit.percentage.toFixed(1)}%
          </div>
          <div className="text-gray-600">Net Profit</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="font-semibold text-gray-900">
            {analytics.isHealthy ? 'Healthy' : 'At Risk'}
          </div>
          <div className="text-gray-600">Profitability</div>
        </div>
      </div>

      {/* Data Source Legend */}
      <div className="mt-4 text-xs text-gray-500">
        <div className="flex flex-wrap gap-4 justify-center">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Materials ({breakdown.materials.source})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Labor ({breakdown.labor.source})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
            <span>Overhead (target)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${breakdown.profit.amount >= 0 ? 'bg-purple-500' : 'bg-red-500'}`}></div>
            <span>Profit (calculated)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonutChart;