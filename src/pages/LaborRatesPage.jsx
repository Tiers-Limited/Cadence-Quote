// src/pages/LaborRatesPage.jsx
import { useState, useEffect } from 'react';
import { Card, Table, InputNumber, Button, message, Spin, Alert, Divider, Space, Typography } from 'antd';
import { FiSave, FiRefreshCw } from 'react-icons/fi';
import { apiService } from '../services/apiService';

const { Title, Text } = Typography;

function LaborRatesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [rates, setRates] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch categories and rates in parallel
      const [categoriesResponse, ratesResponse] = await Promise.all([
        apiService.get('/labor-categories'),
        apiService.get('/labor-categories/rates')
      ]);

      if (categoriesResponse.success) {
        const cats = categoriesResponse.data || [];
        setCategories(cats);

        // Initialize rates object
        const ratesObj = {};
        cats.forEach(cat => {
          const existingRate = ratesResponse.data?.find(r => r.laborCategoryId === cat.id);
          ratesObj[cat.id] = existingRate ? parseFloat(existingRate.rate) : 0;
        });
        setRates(ratesObj);
      }
    } catch (error) {
      message.error('Failed to load labor categories: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeCategories = async () => {
    try {
      setInitializing(true);
      const response = await apiService.post('/labor-categories/initialize');
      if (response.success) {
        message.success('Labor categories initialized successfully');
        await fetchData();
      }
    } catch (error) {
      message.error('Failed to initialize categories: ' + error.message);
    } finally {
      setInitializing(false);
    }
  };

  const handleRateChange = (categoryId, value) => {
    setRates({ ...rates, [categoryId]: value });
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Prepare bulk update payload
      const ratesArray = Object.entries(rates).map(([categoryId, rate]) => ({
        categoryId: parseInt(categoryId),
        rate: parseFloat(rate) || 0
      }));

      const response = await apiService.post('/labor-categories/rates/bulk', { rates: ratesArray });
      
      if (response.success) {
        message.success('Labor rates saved successfully');
        setHasChanges(false);
        await fetchData();
      }
    } catch (error) {
      message.error('Failed to save labor rates: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const interiorCategories = categories.filter(c => c.categoryType === 'interior');
  const exteriorCategories = categories.filter(c => c.categoryType === 'exterior');

  const getUnitLabel = (unit) => {
    const labels = {
      sqft: 'per sq ft',
      linear_foot: 'per linear foot',
      unit: 'per unit',
      hour: 'per hour'
    };
    return labels[unit] || `per ${unit}`;
  };

  const columns = [
    {
      title: 'Labor Category',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: '40%',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>
        </div>
      )
    },
    {
      title: 'Measurement Unit',
      dataIndex: 'measurementUnit',
      key: 'measurementUnit',
      width: '20%',
      render: (unit) => getUnitLabel(unit)
    },
    {
      title: 'Labor Rate',
      key: 'rate',
      width: '25%',
      render: (_, record) => (
        <InputNumber
          style={{ width: 150 }}
          min={0}
          step={0.25}
          precision={2}
          value={rates[record.id] || 0}
          onChange={(value) => handleRateChange(record.id, value)}
          prefix="$"
          addonAfter={getUnitLabel(record.measurementUnit).replace('per ', '')}
        />
      )
    },
    {
      title: 'Total for 100 units',
      key: 'example',
      width: '15%',
      render: (_, record) => {
        const rate = rates[record.id] || 0;
        const total = rate * 100;
        return <Text type="secondary">${total.toFixed(2)}</Text>;
      }
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>Labor Rates Configuration</Title>
          <Text type="secondary">
            Set your default labor rates for each category. These rates will be used when building quotes.
          </Text>
        </div>
        <Space>
          {categories.length === 0 && (
            <Button
              type="dashed"
              icon={<FiRefreshCw />}
              onClick={initializeCategories}
              loading={initializing}
            >
              Initialize Categories
            </Button>
          )}
          <Button
            type="primary"
            icon={<FiSave />}
            onClick={handleSave}
            loading={saving}
            disabled={!hasChanges}
          >
            Save All Rates
          </Button>
        </Space>
      </div>

      {categories.length === 0 && (
        <Alert
          message="No Labor Categories Found"
          description="Click 'Initialize Categories' to create the standard 14 labor categories for residential painting."
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {categories.length > 0 && (
        <>
          <Card title="Interior Labor Categories" style={{ marginBottom: 24 }}>
            <Alert
              message="Interior Categories"
              description="Set rates for interior painting work. Standard coverage: 350 sq ft per gallon."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Table
              columns={columns}
              dataSource={interiorCategories}
              rowKey="id"
              pagination={false}
              size="middle"
            />
          </Card>

          <Card title="Exterior Labor Categories">
            <Alert
              message="Exterior Categories"
              description="Set rates for exterior painting work. Typically higher than interior due to complexity."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Table
              columns={columns}
              dataSource={exteriorCategories}
              rowKey="id"
              pagination={false}
              size="middle"
            />
          </Card>

          <Divider />

          <Card size="small" style={{ background: '#f5f5f5' }}>
            <Text strong>💡 Tips:</Text>
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              <li>Rates are automatically applied when contractors build quotes</li>
              <li>You can override rates for individual quotes if needed</li>
              <li>Consider local market rates and your crew's experience level</li>
              <li>Hourly rates (Drywall Repair, Prep Work) should include labor only</li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

export default LaborRatesPage;
