import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  Divider,
  Alert,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const PricingSchemeManager = () => {
  const { user } = useAuth();
  const [schemes, setSchemes] = useState([]);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'rate_based_sqft',
    description: '',
    isDefault: false,
    isActive: true,
    pricingRules: {
      // Common fields
      includeMaterials: true,
      coverage: 350,
      applicationMethod: 'roll',
      coats: 2,
      costPerGallon: 40,
      
      // Model-specific (will be shown/hidden based on type)
      // Turnkey
      turnkeyRate: 3.50,
      interiorRate: 3.25,
      exteriorRate: 3.75,
      
      // Rate-based
      laborRates: {
        walls: 0.55,
        ceilings: 0.65,
        trim: 2.50,
        doors: 45,
        cabinets: 65,
      },
      
      // Production-based
      billableLaborRate: 50,
      crewSize: 2,
      productionRates: {
        walls: 300,
        ceilings: 250,
        trim: 75,
      },
      
      // Flat rate unit
      unitPrices: {
        door: 85,
        window: 75,
        room_small: 350,
        room_medium: 500,
        room_large: 750,
        cabinet_unit: 65,
      },
      
      // GBB Overrides (optional)
      gbbRates: {
        good: null,
        better: null,
        best: null,
      },
      gbbHourlyRates: {
        good: null,
        better: null,
        best: null,
      },
      gbbUnitPrices: {},
      gbbProductionRates: {},
    },
  });

  useEffect(() => {
    fetchSchemes();
  }, []);

  const fetchSchemes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/v1/pricing-schemes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSchemes(response.data.data || []);
    } catch (err) {
      setError('Failed to load pricing schemes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSchemeSelect = (scheme) => {
    setSelectedScheme(scheme);
    setFormData({
      ...scheme,
      pricingRules: {
        ...formData.pricingRules,
        ...(scheme.pricingRules || {}),
      },
    });
  };

  const handleCreateNew = () => {
    setSelectedScheme(null);
    setFormData({
      name: '',
      type: 'rate_based_sqft',
      description: '',
      isDefault: false,
      isActive: true,
      pricingRules: {
        includeMaterials: true,
        coverage: 350,
        applicationMethod: 'roll',
        coats: 2,
        costPerGallon: 40,
        turnkeyRate: 3.50,
        interiorRate: 3.25,
        exteriorRate: 3.75,
        laborRates: {
          walls: 0.55,
          ceilings: 0.65,
          trim: 2.50,
          doors: 45,
          cabinets: 65,
        },
        billableLaborRate: 50,
        crewSize: 2,
        productionRates: {
          walls: 300,
          ceilings: 250,
          trim: 75,
        },
        unitPrices: {
          door: 85,
          window: 75,
          room_small: 350,
          room_medium: 500,
          room_large: 750,
          cabinet_unit: 65,
        },
        gbbRates: { good: null, better: null, best: null },
        gbbHourlyRates: { good: null, better: null, best: null },
        gbbUnitPrices: {},
        gbbProductionRates: {},
      },
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const token = localStorage.getItem('token');
      const url = selectedScheme
        ? `${API_BASE_URL}/api/v1/pricing-schemes/${selectedScheme.id}`
        : `${API_BASE_URL}/api/v1/pricing-schemes`;
      
      const method = selectedScheme ? 'put' : 'post';
      
      const response = await axios[method](url, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setSuccess(`Pricing scheme ${selectedScheme ? 'updated' : 'created'} successfully`);
      fetchSchemes();
      
      if (!selectedScheme) {
        setSelectedScheme(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save pricing scheme');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (schemeId) => {
    if (!window.confirm('Are you sure you want to delete this pricing scheme?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/v1/pricing-schemes/${schemeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setSuccess('Pricing scheme deleted successfully');
      fetchSchemes();
      setSelectedScheme(null);
      handleCreateNew();
    } catch (err) {
      setError('Failed to delete pricing scheme');
      console.error(err);
    }
  };

  const updatePricingRule = (path, value) => {
    setFormData(prev => {
      const newRules = { ...prev.pricingRules };
      const keys = path.split('.');
      let current = newRules;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      
      return { ...prev, pricingRules: newRules };
    });
  };

  const updateGbbRate = (category, tier, value) => {
    updatePricingRule(`gbbRates.${tier}`, value);
  };

  const renderCommonFields = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <SettingsIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Common Settings (All Models)
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.pricingRules.includeMaterials}
                  onChange={(e) => updatePricingRule('includeMaterials', e.target.checked)}
                />
              }
              label="Include Materials (Default: ON)"
            />
            <Typography variant="caption" display="block" color="text.secondary">
              Toggle OFF only if customer supplies materials
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Paint Coverage (sq ft/gallon)"
              value={formData.pricingRules.coverage}
              onChange={(e) => updatePricingRule('coverage', parseFloat(e.target.value))}
              InputProps={{
                endAdornment: <InputAdornment position="end">sq ft</InputAdornment>,
              }}
              helperText="Default: 350 (roll), 300 (spray). Range: 250-450"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Application Method</InputLabel>
              <Select
                value={formData.pricingRules.applicationMethod}
                onChange={(e) => updatePricingRule('applicationMethod', e.target.value)}
                label="Application Method"
              >
                <MenuItem value="roll">Roll (350 sq ft/gal)</MenuItem>
                <MenuItem value="spray">Spray (300 sq ft/gal)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Number of Coats"
              value={formData.pricingRules.coats}
              onChange={(e) => updatePricingRule('coats', parseInt(e.target.value))}
              inputProps={{ min: 1, max: 4 }}
              helperText="Default: 2"
            />
          </Grid>
          
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Cost Per Gallon"
              value={formData.pricingRules.costPerGallon}
              onChange={(e) => updatePricingRule('costPerGallon', parseFloat(e.target.value))}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              helperText="Material cost"
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderTurnkeyFields = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Turnkey Pricing (Whole-Home)
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          All-in-one pricing per square foot of home. Includes labor & materials by default.
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="Base Turnkey Rate"
              value={formData.pricingRules.turnkeyRate}
              onChange={(e) => updatePricingRule('turnkeyRate', parseFloat(e.target.value))}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                endAdornment: <InputAdornment position="end">/sq ft</InputAdornment>,
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="Interior Rate (Optional)"
              value={formData.pricingRules.interiorRate || ''}
              onChange={(e) => updatePricingRule('interiorRate', parseFloat(e.target.value) || null)}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                endAdornment: <InputAdornment position="end">/sq ft</InputAdornment>,
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="Exterior Rate (Optional)"
              value={formData.pricingRules.exteriorRate || ''}
              onChange={(e) => updatePricingRule('exteriorRate', parseFloat(e.target.value) || null)}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                endAdornment: <InputAdornment position="end">/sq ft</InputAdornment>,
              }}
            />
          </Grid>
        </Grid>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="subtitle1" gutterBottom>
          GBB Tier Adjustments (Optional)
        </Typography>
        <Grid container spacing={2}>
          {['good', 'better', 'best'].map((tier) => (
            <Grid item xs={12} md={4} key={tier}>
              <TextField
                fullWidth
                type="number"
                label={`${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier Rate`}
                value={formData.pricingRules.gbbRates?.[tier] || ''}
                onChange={(e) => updateGbbRate('turnkey', tier, parseFloat(e.target.value) || null)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  endAdornment: <InputAdornment position="end">/sq ft</InputAdornment>,
                }}
                helperText="Leave blank to use base rate"
              />
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );

  const renderRateBasedFields = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Rate-Based Square Foot Pricing
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Labor rate per square foot for each surface type. Materials calculated separately.
        </Typography>
        
        <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
          Labor Rates ($/sq ft or $/unit)
        </Typography>
        
        <Grid container spacing={2}>
          {Object.entries(formData.pricingRules.laborRates || {}).map(([surface, rate]) => (
            <Grid item xs={12} md={4} key={surface}>
              <TextField
                fullWidth
                type="number"
                label={surface.charAt(0).toUpperCase() + surface.slice(1).replace('_', ' ')}
                value={rate}
                onChange={(e) => updatePricingRule(`laborRates.${surface}`, parseFloat(e.target.value))}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      {surface === 'trim' ? '/lf' : surface === 'doors' || surface === 'cabinets' ? '/unit' : '/sq ft'}
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          ))}
        </Grid>
        
        <Button
          startIcon={<AddIcon />}
          onClick={() => {
            const newSurface = prompt('Enter surface name (e.g., "deck", "fence"):');
            if (newSurface) {
              updatePricingRule(`laborRates.${newSurface.toLowerCase()}`, 0.75);
            }
          }}
          sx={{ mt: 2 }}
        >
          Add Custom Surface
        </Button>
      </CardContent>
    </Card>
  );

  const renderProductionBasedFields = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Production-Based Pricing (Time & Materials)
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Calculate labor based on hourly rates and production rates (sq ft/hour).
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="Billable Labor Rate"
              value={formData.pricingRules.billableLaborRate}
              onChange={(e) => updatePricingRule('billableLaborRate', parseFloat(e.target.value))}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                endAdornment: <InputAdornment position="end">/hr</InputAdornment>,
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="Crew Size"
              value={formData.pricingRules.crewSize}
              onChange={(e) => updatePricingRule('crewSize', parseInt(e.target.value))}
              inputProps={{ min: 1, max: 10 }}
              helperText="Number of painters"
            />
          </Grid>
        </Grid>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="subtitle1" gutterBottom>
          Production Rates (sq ft/hour or lf/hour)
        </Typography>
        
        <Grid container spacing={2}>
          {Object.entries(formData.pricingRules.productionRates || {}).map(([surface, rate]) => (
            <Grid item xs={12} md={4} key={surface}>
              <TextField
                fullWidth
                type="number"
                label={surface.charAt(0).toUpperCase() + surface.slice(1)}
                value={rate}
                onChange={(e) => updatePricingRule(`productionRates.${surface}`, parseFloat(e.target.value))}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {surface === 'trim' ? 'lf/hr' : 'sq ft/hr'}
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          ))}
        </Grid>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="subtitle1" gutterBottom>
          GBB Hourly Rate Adjustments (Optional)
        </Typography>
        <Grid container spacing={2}>
          {['good', 'better', 'best'].map((tier) => (
            <Grid item xs={12} md={4} key={tier}>
              <TextField
                fullWidth
                type="number"
                label={`${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier Hourly Rate`}
                value={formData.pricingRules.gbbHourlyRates?.[tier] || ''}
                onChange={(e) => updatePricingRule(`gbbHourlyRates.${tier}`, parseFloat(e.target.value) || null)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  endAdornment: <InputAdornment position="end">/hr</InputAdornment>,
                }}
                helperText="Leave blank to use base rate"
              />
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );

  const renderFlatRateFields = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Flat Rate Unit Pricing
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Fixed price per unit (door, window, room, etc.). Materials included in price.
        </Typography>
        
        <Grid container spacing={2}>
          {Object.entries(formData.pricingRules.unitPrices || {}).map(([unit, price]) => (
            <Grid item xs={12} md={4} key={unit}>
              <TextField
                fullWidth
                type="number"
                label={unit.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                value={price}
                onChange={(e) => updatePricingRule(`unitPrices.${unit}`, parseFloat(e.target.value))}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  endAdornment: <InputAdornment position="end">/unit</InputAdornment>,
                }}
              />
            </Grid>
          ))}
        </Grid>
        
        <Button
          startIcon={<AddIcon />}
          onClick={() => {
            const newUnit = prompt('Enter unit name (e.g., "garage_door", "fence_panel"):');
            if (newUnit) {
              updatePricingRule(`unitPrices.${newUnit.toLowerCase()}`, 100);
            }
          }}
          sx={{ mt: 2 }}
        >
          Add Custom Unit
        </Button>
      </CardContent>
    </Card>
  );

  const renderModelSpecificFields = () => {
    switch (formData.type) {
      case 'turnkey':
      case 'sqft_turnkey':
        return renderTurnkeyFields();
      
      case 'rate_based_sqft':
      case 'sqft_labor_paint':
        return renderRateBasedFields();
      
      case 'production_based':
      case 'hourly_time_materials':
        return renderProductionBasedFields();
      
      case 'flat_rate_unit':
      case 'unit_pricing':
      case 'room_flat_rate':
        return renderFlatRateFields();
      
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Pricing Scheme Manager</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateNew}
        >
          Create New Scheme
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Grid container spacing={3}>
        {/* Sidebar - List of Schemes */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Your Pricing Schemes
            </Typography>
            {schemes.map((scheme) => (
              <Card
                key={scheme.id}
                sx={{
                  mb: 1,
                  cursor: 'pointer',
                  border: selectedScheme?.id === scheme.id ? '2px solid' : '1px solid',
                  borderColor: selectedScheme?.id === scheme.id ? 'primary.main' : 'divider',
                }}
                onClick={() => handleSchemeSelect(scheme)}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <Box>
                      <Typography variant="subtitle2">{scheme.name}</Typography>
                      <Chip
                        label={scheme.type.replace('_', ' ')}
                        size="small"
                        sx={{ mt: 0.5 }}
                      />
                      {scheme.isDefault && (
                        <Chip label="Default" color="primary" size="small" sx={{ mt: 0.5, ml: 0.5 }} />
                      )}
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(scheme.id);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Paper>
        </Grid>

        {/* Main Form */}
        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 3 }}>
            {/* Basic Info */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="Scheme Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Grid>
              
              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Pricing Model Type</InputLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    label="Pricing Model Type"
                  >
                    <MenuItem value="turnkey">Turnkey (Whole-Home)</MenuItem>
                    <MenuItem value="rate_based_sqft">Rate-Based ($/sq ft)</MenuItem>
                    <MenuItem value="production_based">Production-Based (Time)</MenuItem>
                    <MenuItem value="flat_rate_unit">Flat Rate (Unit)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isDefault}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    />
                  }
                  label="Set as Default Scheme"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                  }
                  label="Active"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Common Fields */}
            {renderCommonFields()}

            {/* Model-Specific Fields */}
            {renderModelSpecificFields()}

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
              <Button
                variant="outlined"
                onClick={handleCreateNew}
              >
                Reset Form
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving || !formData.name}
              >
                {saving ? 'Saving...' : selectedScheme ? 'Update Scheme' : 'Create Scheme'}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PricingSchemeManager;
