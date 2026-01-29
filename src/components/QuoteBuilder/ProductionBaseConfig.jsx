// src/components/QuoteBuilder/ProductionBaseConfig.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Tabs, Table, InputNumber, Button, message, Space, Typography, Divider, Alert } from 'antd';
import { SaveOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { TabPane } = Tabs;
const { Title, Text } = Typography;

// Default production rates (sqft/hour or units/hour)
const DEFAULT_PRODUCTION_RATES = {
  // Interior surfaces
  interiorWalls: { label: 'Interior Walls', unit: 'sqft/hour', defaultRate: 300 },
  interiorCeilings: { label: 'Interior Ceilings', unit: 'sqft/hour', defaultRate: 250 },
  interiorTrim: { label: 'Interior Trim', unit: 'linear ft/hour', defaultRate: 150 },
  
  // Exterior surfaces
  exteriorWalls: { label: 'Exterior Walls', unit: 'sqft/hour', defaultRate: 250 },
  exteriorTrim: { label: 'Exterior Trim', unit: 'linear ft/hour', defaultRate: 120 },
  soffitFascia: { label: 'Soffit & Fascia', unit: 'linear ft/hour', defaultRate: 100 },
  
  // Unit-based items
  doors: { label: 'Doors', unit: 'units/hour', defaultRate: 2 },
  cabinets: { label: 'Cabinets', unit: 'units/hour', defaultRate: 1.5 }
};

// Default painter data structure
const DEFAULT_PAINTERS = [
  { id: 1, name: 'Painter 1', billableRate: 50 },
  { id: 2, name: 'Painter 2', billableRate: 50 },
  { id: 3, name: 'Painter 3', billableRate: 50 }
];

const ProductionBaseConfig = ({ settings, onUpdate, onSave }) => {
  const [productionRates, setProductionRates] = useState({});
  const [billableLaborRates, setBillableLaborRates] = useState({});
  const [painters, setPainters] = useState(DEFAULT_PAINTERS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize data from settings
  useEffect(() => {
    if (settings) {
      // Initialize production rates
      const rates = settings.productionRates || {};
      const initialRates = {};
      Object.entries(DEFAULT_PRODUCTION_RATES).forEach(([key, config]) => {
        initialRates[key] = rates[key] || config.defaultRate;
      });
      setProductionRates(initialRates);

      // Initialize billable labor rates
      const laborRates = settings.billableLaborRates || {};
      setBillableLaborRates(laborRates);

      // Initialize painters from billable rates or use defaults
      if (Object.keys(laborRates).length > 0) {
        const paintersFromRates = Object.entries(laborRates).map(([id, rate]) => ({
          id: parseInt(id) || id,
          name: `Painter ${id}`,
          billableRate: rate
        }));
        setPainters(paintersFromRates);
      } else {
        setPainters(DEFAULT_PAINTERS);
      }
    }
  }, [settings]);

  // Debounced update function with performance monitoring
  const debouncedUpdate = useCallback(
    debounce((updatedData) => {
      const startTime = performance.now();
      
      if (onUpdate) {
        onUpdate(updatedData);
      }
      setHasChanges(true);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Log performance for monitoring (requirement: calculations complete within 500ms)
      if (duration > 500) {
        console.warn(`Production rate update took ${duration.toFixed(2)}ms - exceeds 500ms target`);
      } else {
        console.log(`Production rate update completed in ${duration.toFixed(2)}ms`);
      }
    }, 200), // Reduced from 300ms to 200ms for faster response
    [onUpdate]
  );

  const handleProductionRateChange = (key, value) => {
    const startTime = performance.now();
    
    const newRates = {
      ...productionRates,
      [key]: value || 0
    };
    setProductionRates(newRates);
    
    const updateData = {
      productionRates: newRates,
      billableLaborRates
    };
    
    // Trigger immediate recalculation for real-time feedback
    debouncedUpdate(updateData);
    
    // Also trigger quote recalculation if callback provided
    if (onUpdate) {
      // Add performance tracking
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (duration > 500) {
        console.warn(`Production rate change processing took ${duration.toFixed(2)}ms - exceeds 500ms target`);
      }
    }
  };

  const handleLaborRateChange = (painterId, rate) => {
    const startTime = performance.now();
    
    const newRates = {
      ...billableLaborRates,
      [painterId]: rate || 0
    };
    setBillableLaborRates(newRates);

    // Update painters array
    const updatedPainters = painters.map(painter => 
      painter.id === painterId 
        ? { ...painter, billableRate: rate || 0 }
        : painter
    );
    setPainters(updatedPainters);

    const updateData = {
      productionRates,
      billableLaborRates: newRates
    };
    
    // Trigger immediate recalculation for real-time feedback
    debouncedUpdate(updateData);
    
    // Performance tracking
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (duration > 500) {
      console.warn(`Labor rate change processing took ${duration.toFixed(2)}ms - exceeds 500ms target`);
    }
  };

  const addPainter = () => {
    const newId = Math.max(...painters.map(p => p.id), 0) + 1;
    const newPainter = {
      id: newId,
      name: `Painter ${newId}`,
      billableRate: 50
    };
    
    const updatedPainters = [...painters, newPainter];
    setPainters(updatedPainters);
    
    const newRates = {
      ...billableLaborRates,
      [newId]: 50
    };
    setBillableLaborRates(newRates);

    debouncedUpdate({
      productionRates,
      billableLaborRates: newRates
    });
  };

  const removePainter = (painterId) => {
    if (painters.length <= 1) {
      message.warning('At least one painter must be configured');
      return;
    }

    const updatedPainters = painters.filter(p => p.id !== painterId);
    setPainters(updatedPainters);

    const newRates = { ...billableLaborRates };
    delete newRates[painterId];
    setBillableLaborRates(newRates);

    debouncedUpdate({
      productionRates,
      billableLaborRates: newRates
    });
  };

  const handleSave = async () => {
    if (!hasChanges) {
      message.info('No changes to save');
      return;
    }

    setSaving(true);
    const saveStartTime = performance.now();
    
    try {
      const updateData = {
        productionRates,
        billableLaborRates,
        crewSize: painters.length // Update default crew size
      };

      if (onSave) {
        await onSave(updateData);
      } else {
        // Default save to settings API
        await apiService.put('/settings', updateData);
      }

      // Trigger recalculation of all affected quotes
      try {
        const recalcResponse = await apiService.post('/quotes/recalculate-production-based', {
          productionRates,
          billableLaborRates
        });
        
        if (recalcResponse.success) {
          const affectedQuotes = recalcResponse.data?.affectedQuotes || 0;
          if (affectedQuotes > 0) {
            message.success(`Production base configuration saved and ${affectedQuotes} quotes updated`);
          } else {
            message.success('Production base configuration saved successfully');
          }
        }
      } catch (recalcError) {
        console.warn('Failed to recalculate affected quotes:', recalcError);
        message.success('Production base configuration saved (quote recalculation will happen on next access)');
      }

      setHasChanges(false);
      
      // Performance monitoring
      const saveEndTime = performance.now();
      const saveDuration = saveEndTime - saveStartTime;
      
      if (saveDuration > 500) {
        console.warn(`Production base save took ${saveDuration.toFixed(2)}ms - exceeds 500ms target`);
      } else {
        console.log(`Production base save completed in ${saveDuration.toFixed(2)}ms`);
      }
      
    } catch (error) {
      console.error('Error saving production base config:', error);
      message.error('Failed to save production base configuration');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    const defaultRates = {};
    Object.entries(DEFAULT_PRODUCTION_RATES).forEach(([key, config]) => {
      defaultRates[key] = config.defaultRate;
    });
    
    setProductionRates(defaultRates);
    setPainters(DEFAULT_PAINTERS);
    
    const defaultLaborRates = {};
    DEFAULT_PAINTERS.forEach(painter => {
      defaultLaborRates[painter.id] = painter.billableRate;
    });
    setBillableLaborRates(defaultLaborRates);

    debouncedUpdate({
      productionRates: defaultRates,
      billableLaborRates: defaultLaborRates
    });
  };

  // Production rates table columns
  const productionRateColumns = [
    {
      title: 'Surface Type',
      dataIndex: 'label',
      key: 'label',
      width: '40%'
    },
    {
      title: 'Production Rate',
      key: 'rate',
      width: '35%',
      render: (_, record) => (
        <InputNumber
          value={productionRates[record.key]}
          onChange={(value) => handleProductionRateChange(record.key, value)}
          min={0}
          max={1000}
          precision={1}
          style={{ width: '100%' }}
          placeholder="Enter rate"
        />
      )
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: '25%'
    }
  ];

  // Labor rates table columns
  const laborRateColumns = [
    {
      title: 'Painter',
      dataIndex: 'name',
      key: 'name',
      width: '40%'
    },
    {
      title: 'Billable Rate ($/hour)',
      key: 'rate',
      width: '35%',
      render: (_, record) => (
        <InputNumber
          value={record.billableRate}
          onChange={(value) => handleLaborRateChange(record.id, value)}
          min={0}
          max={200}
          precision={2}
          style={{ width: '100%' }}
          placeholder="Enter rate"
          formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => value.replace(/\$\s?|(,*)/g, '')}
        />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '25%',
      render: (_, record) => (
        <Button
          type="link"
          danger
          onClick={() => removePainter(record.id)}
          disabled={painters.length <= 1}
        >
          Remove
        </Button>
      )
    }
  ];

  // Prepare data for tables
  const productionRateData = Object.entries(DEFAULT_PRODUCTION_RATES).map(([key, config]) => ({
    key,
    ...config
  }));

  return (
    <Card 
      title="Production Base Configuration"
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={resetToDefaults}
            disabled={saving}
          >
            Reset to Defaults
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!hasChanges}
          >
            Save Changes
          </Button>
        </Space>
      }
    >
      <Alert
        message="Production Base Configuration"
        description="Configure production rates and labor costs for accurate time-based pricing calculations. Production rates determine how much work can be completed per hour, while billable rates set the cost per painter."
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        className="mb-4"
      />

      <Tabs defaultActiveKey="production" type="card">
        <TabPane tab="Production Rates" key="production">
          <div className="mb-4">
            <Title level={4}>Surface Production Rates</Title>
            <Text type="secondary">
              Set how much area each surface type can be painted per hour. These rates are used to calculate labor time for production-based pricing.
            </Text>
          </div>
          
          <Table
            dataSource={productionRateData}
            columns={productionRateColumns}
            pagination={false}
            size="middle"
            bordered
          />
          
          <Divider />
          
          <div className="text-sm text-gray-600">
            <Text strong>Tips:</Text>
            <ul className="mt-2 ml-4">
              <li>Higher production rates mean faster work and lower labor costs</li>
              <li>Consider surface complexity, prep work, and application method</li>
              <li>Rates are per painter - total crew productivity scales automatically</li>
            </ul>
          </div>
        </TabPane>

        <TabPane tab="Labor Rates" key="labor">
          <div className="mb-4">
            <Title level={4}>Individual Painter Rates</Title>
            <Text type="secondary">
              Configure billable hourly rates for each painter. Different painters can have different rates based on experience and skill level.
            </Text>
          </div>
          
          <Table
            dataSource={painters}
            columns={laborRateColumns}
            pagination={false}
            size="middle"
            bordered
          />
          
          <div className="mt-4">
            <Button
              type="dashed"
              onClick={addPainter}
              style={{ width: '100%' }}
            >
              + Add Painter
            </Button>
          </div>
          
          <Divider />
          
          <div className="text-sm text-gray-600">
            <Text strong>Current Crew Configuration:</Text>
            <ul className="mt-2 ml-4">
              <li>Total Painters: {painters.length}</li>
              <li>Average Rate: ${(painters.reduce((sum, p) => sum + p.billableRate, 0) / painters.length).toFixed(2)}/hour</li>
              <li>Total Crew Cost: ${painters.reduce((sum, p) => sum + p.billableRate, 0).toFixed(2)}/hour</li>
            </ul>
          </div>
        </TabPane>
      </Tabs>

      {hasChanges && (
        <Alert
          message="Unsaved Changes"
          description="You have unsaved changes to your production base configuration. Click 'Save Changes' to apply them."
          type="warning"
          showIcon
          className="mt-4"
        />
      )}
    </Card>
  );
};

// Simple debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default ProductionBaseConfig;