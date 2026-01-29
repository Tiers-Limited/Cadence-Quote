import React from 'react';
import { Card, Input, InputNumber } from 'antd';

const { TextArea } = Input;

/**
 * Turnkey Tier Configuration Component
 * 
 * Allows configuration of base rates and descriptions for each tier
 * in turnkey pricing.
 */
const TurnkeyTierConfig = ({ config, onChange, disabled }) => {
  const tiers = [
    { key: 'good', label: 'Good Tier', color: '#e3f2fd' },
    { key: 'better', label: 'Better Tier', color: '#e8f5e9' },
    { key: 'best', label: 'Best Tier', color: '#f3e5f5' }
  ];

  const handleChange = (tier, field, value) => {
    const newConfig = { ...config };
    if (!newConfig[tier]) newConfig[tier] = {};
    newConfig[tier] = {
      ...newConfig[tier],
      [field]: value
    };
    onChange(newConfig);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {tiers.map(({ key, label, color }) => (
        <Card 
          key={key} 
          title={label}
          headStyle={{ backgroundColor: color }}
          style={{ opacity: disabled ? 0.5 : 1 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                Base Rate ($/sqft)
              </label>
              <InputNumber
                style={{ width: '100%' }}
                step={0.01}
                min={0}
                value={config?.[key]?.baseRate || 0}
                onChange={(value) => handleChange(key, 'baseRate', value || 0)}
                disabled={disabled}
                placeholder="e.g., 3.50"
                prefix="$"
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Price per square foot for turnkey pricing
              </p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                Description
              </label>
              <TextArea
                value={config?.[key]?.description || ''}
                onChange={(e) => handleChange(key, 'description', e.target.value)}
                disabled={disabled}
                placeholder={`Describe what's included in the ${key} tier...`}
                rows={3}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                This description will be shown to customers when selecting tiers
              </p>
            </div>
          </div>
        </Card>
      ))}

      {disabled && (
        <p style={{ fontSize: '14px', color: '#666', textAlign: 'center', padding: '16px 0' }}>
          Enable turnkey pricing above to configure tier settings
        </p>
      )}
    </div>
  );
};

export default TurnkeyTierConfig;
