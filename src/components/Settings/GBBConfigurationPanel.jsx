import React, { useState, useEffect } from 'react';
import { Card, Tabs, Switch, Button, Alert, Spin, message } from 'antd';
import { SaveOutlined, ReloadOutlined, AlertOutlined } from '@ant-design/icons';
import RateBasedTierConfig from './RateBasedTierConfig';
import FlatRateTierConfig from './FlatRateTierConfig';
import ProductionBasedTierConfig from './ProductionBasedTierConfig';
import TurnkeyTierConfig from './TurnkeyTierConfig';
import * as gbbSettingsApi from '../../services/gbbSettingsApi';

const { TabPane } = Tabs;

/**
 * GBB Configuration Panel Component
 * 
 * Allows contractors to configure Good-Better-Best pricing tiers
 * for all pricing schemes.
 */
const GBBConfigurationPanel = ({ onSave, loading: externalLoading }) => {
  const [gbbEnabled, setGbbEnabled] = useState(false);
  const [activeScheme, setActiveScheme] = useState('rateBased');
  const [config, setConfig] = useState({
    rateBased: { enabled: false, good: {}, better: {}, best: {} },
    flatRate: { enabled: false, good: {}, better: {}, best: {} },
    productionBased: { enabled: false, good: {}, better: {}, best: {} },
    turnkey: { enabled: false, good: {}, better: {}, best: {} }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Fetch GBB configuration on mount
  useEffect(() => {
    fetchConfiguration();
  }, []);

  const fetchConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await gbbSettingsApi.fetchGBBConfiguration();
      
      if (data.success) {
        setGbbEnabled(data.data.gbbEnabled || false);
        
        // Merge API response with default structure to ensure all schemes have proper defaults
        const defaultConfig = {
          rateBased: { enabled: false, good: {}, better: {}, best: {} },
          flatRate: { enabled: false, good: {}, better: {}, best: {} },
          productionBased: { enabled: false, good: {}, better: {}, best: {} },
          turnkey: { enabled: false, good: {}, better: {}, best: {} }
        };
        
        const mergedConfig = { ...defaultConfig };
        if (data.data.gbbTiers && typeof data.data.gbbTiers === 'object') {
          Object.keys(data.data.gbbTiers).forEach(scheme => {
            if (mergedConfig[scheme]) {
              mergedConfig[scheme] = {
                ...mergedConfig[scheme],
                ...data.data.gbbTiers[scheme]
              };
            }
          });
        }
        
        setConfig(mergedConfig);
      }
    } catch (err) {
      console.error('Error fetching GBB configuration:', err);
      setError(err.message);
      message.error('Failed to load GBB configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const data = await gbbSettingsApi.updateGBBConfiguration({
        gbbEnabled,
        gbbTiers: config
      });
      
      if (data.success) {
        message.success('Configuration saved successfully!');
        
        if (onSave) {
          onSave(data.data);
        }
      }
    } catch (err) {
      console.error('Error saving GBB configuration:', err);
      setError(err.message);
      message.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (scheme) => {
    try {
      setSaving(true);
      setError(null);

      const data = await gbbSettingsApi.resetGBBConfiguration(scheme);
      
      if (data.success) {
        setConfig(data.data.gbbTiers);
        message.success('Configuration reset to defaults');
      }
    } catch (err) {
      console.error('Error resetting GBB configuration:', err);
      setError(err.message);
      message.error('Failed to reset configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSchemeToggle = (scheme, enabled) => {
    setConfig(prev => ({
      ...prev,
      [scheme]: {
        ...prev[scheme],
        enabled
      }
    }));
  };

  const handleTierConfigChange = (scheme, newConfig) => {
    setConfig(prev => ({
      ...prev,
      [scheme]: newConfig
    }));
  };

  if (loading || externalLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Good-Better-Best Pricing Tiers</h2>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px' }}>
              Configure tier-specific pricing for different quality levels
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Enable GBB Pricing</span>
            <Switch
              checked={gbbEnabled}
              onChange={setGbbEnabled}
            />
          </div>
        </div>

        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            icon={<AlertOutlined />}
            style={{ marginBottom: '16px' }}
            closable
            onClose={() => setError(null)}
          />
        )}

        {!gbbEnabled && (
          <Alert
            message="GBB pricing is currently disabled"
            description="Enable it above to configure tier-specific pricing."
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}

        <Tabs activeKey={activeScheme} onChange={setActiveScheme}>
          <TabPane tab="Rate-Based" key="rateBased">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Switch
                  checked={config.rateBased?.enabled || false}
                  onChange={(enabled) => handleSchemeToggle('rateBased', enabled)}
                  disabled={!gbbEnabled}
                />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Enable for Rate-Based Pricing</span>
              </div>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => handleReset('rateBased')}
                disabled={saving || !gbbEnabled}
              >
                Reset to Defaults
              </Button>
            </div>
            <RateBasedTierConfig
              config={config.rateBased}
              onChange={(newConfig) => handleTierConfigChange('rateBased', newConfig)}
              disabled={!gbbEnabled || !config.rateBased?.enabled}
            />
          </TabPane>

          <TabPane tab="Flat Rate" key="flatRate">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Switch
                  checked={config.flatRate?.enabled || false}
                  onChange={(enabled) => handleSchemeToggle('flatRate', enabled)}
                  disabled={!gbbEnabled}
                />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Enable for Flat Rate Pricing</span>
              </div>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => handleReset('flatRate')}
                disabled={saving || !gbbEnabled}
              >
                Reset to Defaults
              </Button>
            </div>
            <FlatRateTierConfig
              config={config.flatRate}
              onChange={(newConfig) => handleTierConfigChange('flatRate', newConfig)}
              disabled={!gbbEnabled || !config.flatRate?.enabled}
            />
          </TabPane>

          <TabPane tab="Production-Based" key="productionBased">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Switch
                  checked={config.productionBased?.enabled || false}
                  onChange={(enabled) => handleSchemeToggle('productionBased', enabled)}
                  disabled={!gbbEnabled}
                />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Enable for Production-Based Pricing</span>
              </div>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => handleReset('productionBased')}
                disabled={saving || !gbbEnabled}
              >
                Reset to Defaults
              </Button>
            </div>
            <ProductionBasedTierConfig
              config={config.productionBased}
              onChange={(newConfig) => handleTierConfigChange('productionBased', newConfig)}
              disabled={!gbbEnabled || !config.productionBased?.enabled}
            />
          </TabPane>

          <TabPane tab="Turnkey" key="turnkey">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Switch
                  checked={config.turnkey?.enabled || false}
                  onChange={(enabled) => handleSchemeToggle('turnkey', enabled)}
                  disabled={!gbbEnabled}
                />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Enable for Turnkey Pricing</span>
              </div>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => handleReset('turnkey')}
                disabled={saving || !gbbEnabled}
              >
                Reset to Defaults
              </Button>
            </div>
            <TurnkeyTierConfig
              config={config.turnkey}
              onChange={(newConfig) => handleTierConfigChange('turnkey', newConfig)}
              disabled={!gbbEnabled || !config.turnkey?.enabled}
            />
          </TabPane>
        </Tabs>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #f0f0f0' }}>
          <Button
            onClick={fetchConfiguration}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!gbbEnabled}
          >
            Save Configuration
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default GBBConfigurationPanel;
