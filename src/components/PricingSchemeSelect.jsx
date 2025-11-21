import React from 'react';
import { Select } from 'antd';

const pricingSchemes = [
  { value: 'squareFootTurnkey', label: 'Square-Foot (Turnkey)', description: 'All-inclusive price per sq ft' },
  { value: 'squareFootSeparated', label: 'Square-Foot (Labor + Paint)', description: 'Separate labor and material costs' },
  { value: 'hourlyRate', label: 'Hourly (Time & Materials)', description: 'Hourly rate plus materials' },
  { value: 'unitPricing', label: 'Unit / Assembly Pricing', description: 'Per door, window, cabinet, etc.' },
  { value: 'roomFlat', label: 'Room / Area Flat Rate', description: 'Fixed price per room' }
];

export const PricingSchemeSelect = ({ value, onValueChange, className, size, helperText }) => {
  return (
    <div className={className}>
      <Select
        value={value}
        onChange={onValueChange}
        size={size || 'middle'}
        style={{ width: '100%' }}
        options={pricingSchemes.map(scheme => ({
          value: scheme.value,
          label: scheme.label
        }))}
      />
      {helperText && (
        <p className="text-xs text-gray-500 mt-1">{helperText}</p>
      )}
    </div>
  );
};
