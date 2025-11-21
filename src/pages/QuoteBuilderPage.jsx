import { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Input, 
  Form, 
  Select, 
  Checkbox, 
  Badge, 
  Progress, 
  Radio, 
  Switch, 
  Tabs, 
  message,
  Steps,
  InputNumber,
  Space,
  Tooltip,
  Tag,
  Divider
} from 'antd';
import {
  UserOutlined,
  HomeOutlined,
  UnorderedListOutlined,
  BgColorsOutlined,
  FileTextOutlined,
  DownloadOutlined,
  DollarOutlined,
  CalculatorOutlined,
  InfoCircleOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  PercentageOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  LeftOutlined,
  RightOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  StarOutlined,
  
  PlusOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { PricingSchemeSelect } from '../components/PricingSchemeSelect';
import { RoomSelector } from '../components/RoomSelector';
import { SurfaceAreaInput } from '../components/SurfaceAreaInput';

const { TextArea } = Input;
const { Option} = Select;
const { TabPane } = Tabs;

const steps = [
  { id: 1, title: 'Customer Info', icon: UserOutlined },
  { id: 2, title: 'Job Type', icon: HomeOutlined },
  { id: 3, title: 'Areas', icon: UnorderedListOutlined },
  { id: 4, title: 'Products', icon: BgColorsOutlined },
  { id: 5, title: 'Summary', icon: FileTextOutlined }
];

// Mock data
const paintBrands = ['Sherwin-Williams', 'Benjamin Moore', 'Behr'];
const sheenOptions = ['Flat', 'Matte', 'Eggshell', 'Satin', 'Semi-Gloss', 'Gloss'];

const mockColors = {
  'Sherwin-Williams': [
    { code: 'SW 7008', name: 'Alabaster' },
    { code: 'SW 7006', name: 'Extra White' },
    { code: 'SW 6244', name: 'Naval' },
    { code: 'SW 7029', name: 'Agreeable Gray' },
    { code: 'SW 9003', name: 'Pure White' }
  ],
  'Benjamin Moore': [
    { code: 'BM OC-17', name: 'White Dove' },
    { code: 'BM 2126-70', name: 'Cloud White' },
    { code: 'BM HC-172', name: 'Revere Pewter' },
    { code: 'BM OC-65', name: 'Chantilly Lace' }
  ],
  'Behr': [
    { code: 'BEHR 75', name: 'Polar Bear' },
    { code: 'BEHR 1050', name: 'Cottage White' },
    { code: 'BEHR N220-1', name: 'Campfire Ash' }
  ]
};

// Mock product library - Good/Better/Best tiers
const mockProducts = {
  wall: {
    good: [
      { id: 'promar-200', name: 'ProMar 200', brand: 'Sherwin-Williams', price: 29.95, description: 'Zero VOC, professional finish' },
      { id: 'promar-400', name: 'ProMar 400', brand: 'Sherwin-Williams', price: 25.50, description: 'Economical, contractor grade' },
      { id: 'ben-interior', name: 'ben® Interior', brand: 'Benjamin Moore', price: 32.00, description: 'Entry-level interior line' }
    ],
    better: [
      { id: 'cashmere', name: 'Cashmere Interior', brand: 'Sherwin-Williams', price: 34.99, description: 'Luxury smooth finish' },
      { id: 'superpaint', name: 'SuperPaint', brand: 'Sherwin-Williams', price: 32.75, description: 'Durable, scrubbable' },
      { id: 'regal-select', name: 'Regal Select', brand: 'Benjamin Moore', price: 44.00, description: 'Premium, long-lasting finish' }
    ],
    best: [
      { id: 'duration', name: 'Duration Home', brand: 'Sherwin-Williams', price: 41.95, description: 'Premium stain resistance' },
      { id: 'emerald', name: 'Emerald Interior', brand: 'Sherwin-Williams', price: 55.00, description: 'Top-tier coverage & durability' },
      { id: 'aura', name: 'Aura Interior', brand: 'Benjamin Moore', price: 65.00, description: 'Best-in-class interior performance' }
    ]
  },
  ceiling: {
    default: { id: 'ceiling-default', name: 'ProMar 200 Ceiling', brand: 'Sherwin-Williams', price: 25.50, description: 'Standard ceiling paint' },
    upgrade: { id: 'ceiling-upgrade', name: 'Benjamin Moore Ceiling', brand: 'Benjamin Moore', price: 35.00, description: 'Premium ceiling coverage' }
  },
  trim: {
    default: { id: 'trim-default', name: 'ProClassic Interior', brand: 'Sherwin-Williams', price: 38.95, description: 'Durable trim paint' },
    upgrade: { id: 'trim-upgrade', name: 'Advance Interior', brand: 'Benjamin Moore', price: 55.00, description: 'Alkyd-like performance' }
  },
  cabinets: {
    good: [
      { id: 'proclassic-acrylic', name: 'ProClassic Acrylic', brand: 'Sherwin-Williams', price: 38.95, description: 'Smooth cabinet finish' },
      { id: 'advance-base', name: 'ADVANCE Base', brand: 'Benjamin Moore', price: 42.00, description: 'Durable cabinet coating' }
    ],
    better: [
      { id: 'proclassic-alkyd', name: 'ProClassic Alkyd', brand: 'Sherwin-Williams', price: 45.95, description: 'Premium cabinet paint' },
      { id: 'advance-premium', name: 'ADVANCE Premium', brand: 'Benjamin Moore', price: 55.00, description: 'Alkyd-like performance' }
    ],
    best: [
      { id: 'emerald-urethane', name: 'Emerald Urethane', brand: 'Sherwin-Williams', price: 62.95, description: 'Maximum durability for cabinets' },
      { id: 'insl-x', name: 'INSL-X Cabinet Coat', brand: 'Benjamin Moore', price: 58.00, description: 'Professional cabinet finish' }
    ]
  },
  custom: {
    good: [
      { id: 'multi-surface-good', name: 'Multi-Surface Paint', brand: 'Sherwin-Williams', price: 32.95, description: 'Versatile coating' }
    ],
    better: [
      { id: 'multi-surface-better', name: 'Premium Multi-Surface', brand: 'Sherwin-Williams', price: 42.95, description: 'Enhanced adhesion' }
    ],
    best: [
      { id: 'multi-surface-best', name: 'Industrial Multi-Surface', brand: 'Sherwin-Williams', price: 58.95, description: 'Maximum performance' }
    ]
  }
};

const commonRooms = {
  interior: ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining Room', 'Hallway', 'Office'],
  exterior: ['Front Exterior', 'Back Exterior', 'Garage', 'Deck', 'Fence', 'Trim']
};

// Phone formatting utilities
const formatPhoneNumber = (value) => {
  const digits = value.replaceAll(/\D/g, '');
  const cleanDigits = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
  
  if (cleanDigits.length >= 6) {
    return `(${cleanDigits.slice(0, 3)}) ${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6, 10)}`;
  } else if (cleanDigits.length >= 3) {
    return `(${cleanDigits.slice(0, 3)}) ${cleanDigits.slice(3)}`;
  }
  return cleanDigits;
};

const isValidPhone = (phone) => {
  const digits = phone.replaceAll(/\D/g, '');
  return digits.length === 10;
};

const isValidZip = (zip) => {
  return /^\d{5}$/.test(zip);
};

const mockZipLookup = (zip) => {
  const mockData = {
    '28217': { tier: 'High-Cost', markupPercent: 8.0 },
    '62701': { tier: 'Standard', markupPercent: 5.0 },
    '90210': { tier: 'Premium', markupPercent: 12.0 },
    '10001': { tier: 'High-Cost', markupPercent: 10.0 }
  };
  return mockData[zip] || null;
};

const getDefaultSurfaces = (areaName) => {
  const isKitchen = areaName.toLowerCase().includes('kitchen');
  const isBathroom = areaName.toLowerCase().includes('bathroom');
  
  const defaultSurfaces = [
    { type: 'Walls', selected: false, unit: 'sq ft' },
    { type: 'Ceiling', selected: false, unit: 'sq ft' },
    { type: 'Trim', selected: false, unit: 'linear ft' }
  ];
  
  if (isKitchen || isBathroom) {
    defaultSurfaces.push({ type: 'Cabinets', selected: false, unit: 'sq ft' });
  }
  
  return defaultSurfaces;
};

function QuoteBuilderPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [formData, setFormData] = useState({
    // Customer Info
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    propertyAddress: '',
    zip: '',
    
    // Job Type
    jobType: '',
    
    // Pricing Scheme
    pricingScheme: 'squareFootTurnkey',
    
    // ZIP Market Data
    applyZipMarkup: true,
    zipMarket: null,
    
    // Areas with integrated surfaces, dimensions, and colors
    areas: [],
    
    // Good/Better/Best Product Selections (stored as dynamic keys)
    // Format: `${areaId}-${surfaceCategory}-${tier}` = productId
    
    // Additional
    notes: ''
  });

  const [phoneError, setPhoneError] = useState('');
  const [zipError, setZipError] = useState('');

  const progress = ((currentStep + 1) / steps.length) * 100;

  // Auto-populate product defaults for new areas/surfaces
  useEffect(() => {
    if (currentStep !== 3) return; // Only run on Products step (index 3)

    const updates = {};
    let hasUpdates = false;

    formData.areas.forEach(area => {
      area.surfaces.forEach(surface => {
        if (surface.selected) {
          let surfaceCategory = '';
          let defaultProducts = {};
          
          // Determine surface category and default products
          const type = surface.type.toLowerCase();
          const isCustom = surface.customSurface && surface.customSurface.trim() !== '';
          
          if (type.includes('wall')) {
            surfaceCategory = 'Walls';
            defaultProducts = {
              good: mockProducts.wall.good[0]?.id,
              better: mockProducts.wall.better[0]?.id,
              best: mockProducts.wall.best[0]?.id
            };
          } else if (type.includes('ceiling')) {
            surfaceCategory = 'Ceiling';
            defaultProducts = {
              good: mockProducts.ceiling.default?.id,
              better: mockProducts.ceiling.upgrade?.id
            };
          } else if (type.includes('cabinet')) {
            surfaceCategory = 'Cabinets';
            defaultProducts = {
              good: mockProducts.cabinets.good[0]?.id,
              better: mockProducts.cabinets.better[0]?.id,
              best: mockProducts.cabinets.best[0]?.id
            };
          } else if (type.includes('trim') || type.includes('door') || type.includes('window')) {
            surfaceCategory = 'Trim';
            defaultProducts = {
              good: mockProducts.trim.default?.id,
              better: mockProducts.trim.upgrade?.id
            };
          } else if (isCustom) {
            surfaceCategory = 'Custom';
            defaultProducts = {
              good: mockProducts.custom.good[0]?.id,
              better: mockProducts.custom.better[0]?.id,
              best: mockProducts.custom.best[0]?.id
            };
          }

          // Set defaults if not already set
          Object.entries(defaultProducts).forEach(([tier, productId]) => {
            if (productId) {
              const key = `${area.id}-${surfaceCategory}-${tier}`;
              if (!formData[key]) {
                updates[key] = productId;
                hasUpdates = true;
              }
            }
          });
        }
      });
    });

    if (hasUpdates) {
      setFormData({ ...formData, ...updates });
    }
  }, [currentStep, formData.areas]);

  const handleNext = () => {
    form.validateFields().then(() => {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }).catch(() => {
      message.error('Please fill in all required fields');
    });
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handlePhoneChange = (value) => {
    const formatted = formatPhoneNumber(value);
    setFormData({ ...formData, customerPhone: formatted });
    
    if (value && !isValidPhone(formatted)) {
      setPhoneError('Enter a valid 10-digit number');
    } else {
      setPhoneError('');
    }
  };

  const handleZipChange = (value) => {
    const digits = value.replaceAll(/\D/g, '').slice(0, 5);
    setFormData({ ...formData, zip: digits });
    
    if (digits.length === 5) {
      if (isValidZip(digits)) {
        const marketData = mockZipLookup(digits);
        setFormData(prev => ({ ...prev, zipMarket: marketData }));
        setZipError('');
      } else {
        setZipError('Enter a valid 5-digit ZIP');
        setFormData(prev => ({ ...prev, zipMarket: null }));
      }
    } else {
      setZipError('');
      setFormData(prev => ({ ...prev, zipMarket: null }));
    }
  };

  // Room management functions for RoomSelector
  const handleRoomAdd = (roomName) => {
    const newArea = {
      id: `area-${Date.now()}`,
      name: roomName,
      surfaces: getDefaultSurfaces(roomName).map(surface => ({
        ...surface,
        dimensions: { unit: surface.unit },
        sheen: 'Eggshell'
      }))
    };
    setFormData({ ...formData, areas: [...formData.areas, newArea] });
  };

  const handleRoomRemove = (roomId) => {
    const newAreas = formData.areas.filter(area => area.id !== roomId);
    setFormData({ ...formData, areas: newAreas });
  };

  const handleRoomEdit = (roomId) => {
    const roomElement = document.getElementById(`room-details-${roomId}`);
    if (roomElement) {
      roomElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSurfaceToggle = (areaId, surfaceType) => {
    const newAreas = formData.areas.map(area => {
      if (area.id === areaId) {
        return {
          ...area,
          surfaces: area.surfaces.map(surface => 
            surface.type === surfaceType 
              ? { ...surface, selected: !surface.selected }
              : surface
          )
        };
      }
      return area;
    });
    setFormData({ ...formData, areas: newAreas });
  };

  const handleCustomSurfaceAdd = (areaId, customSurface) => {
    const newAreas = formData.areas.map(area => {
      if (area.id === areaId) {
        return {
          ...area,
          surfaces: [...area.surfaces, {
            type: 'Custom',
            customSurface,
            selected: true,
            unit: 'sq ft',
            dimensions: { unit: 'sq ft' },
            sheen: 'Eggshell'
          }]
        };
      }
      return area;
    });
    setFormData({ ...formData, areas: newAreas });
  };

  const handleDimensionsChange = (areaId, surfaceType, newDimensions) => {
    const newAreas = formData.areas.map(area => {
      if (area.id === areaId) {
        return {
          ...area,
          surfaces: area.surfaces.map(surface => 
            surface.type === surfaceType 
              ? { ...surface, dimensions: newDimensions }
              : surface
          )
        };
      }
      return area;
    });
    setFormData({ ...formData, areas: newAreas });
  };

  const handleColorChange = (areaId, surfaceType, colorData) => {
    const newAreas = formData.areas.map(area => {
      if (area.id === areaId) {
        return {
          ...area,
          surfaces: area.surfaces.map(surface => 
            surface.type === surfaceType 
              ? { ...surface, color: colorData }
              : surface
          )
        };
      }
      return area;
    });
    setFormData({ ...formData, areas: newAreas });
  };

  const handleSheenChange = (areaId, surfaceType, sheen) => {
    const newAreas = formData.areas.map(area => {
      if (area.id === areaId) {
        return {
          ...area,
          surfaces: area.surfaces.map(surface => 
            surface.type === surfaceType 
              ? { ...surface, sheen }
              : surface
          )
        };
      }
      return area;
    });
    setFormData({ ...formData, areas: newAreas });
  };

  const handlePricingSchemeChange = (newScheme) => {
    setFormData({ ...formData, pricingScheme: newScheme });
  };

  const calculatePaintableArea = (dimensions, surfaceType = '') => {
    if (dimensions.directArea) return dimensions.directArea;
    
    const { length = 0, width = 0, height = 0 } = dimensions;
    
    switch (surfaceType.toLowerCase()) {
      case 'walls':
        if (length && width && height) {
          return 2 * (length + width) * height;
        }
        return 0;
      case 'ceiling':
      case 'floor':
        if (length && width) {
          return length * width;
        }
        return 0;
      case 'trim':
        if (length && width) {
          return 2 * (length + width);
        }
        return 0;
      case 'cabinets':
        if (length && width) {
          return length * width;
        }
        return 0;
      default:
        if (length && width) {
          return length * width;
        }
        return 0;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Customer Info
        return (
          <div className="space-y-6">
            <Form.Item
              label="Customer Name"
              name="customerName"
              rules={[{ required: true, message: 'Please enter customer name' }]}
            >
              <Input
                size="large"
                placeholder="Enter customer name"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              />
            </Form.Item>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                label="Phone Number"
                name="customerPhone"
                rules={[{ required: true, message: 'Please enter phone number' }]}
              >
                <Input
                  size="large"
                  prefix={<PhoneOutlined />}
                  placeholder="(704) 965-9450"
                  value={formData.customerPhone}
                  onChange={handlePhoneChange}
                />
              </Form.Item>

              <Form.Item
                label="Email Address"
                name="customerEmail"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter valid email' }
                ]}
              >
                <Input
                  size="large"
                  type="email"
                  placeholder="customer@email.com"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                />
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Form.Item
                  label="Property Address"
                  name="propertyAddress"
                  rules={[{ required: true, message: 'Please enter address' }]}
                >
                  <TextArea
                    rows={3}
                    placeholder="Enter complete property address"
                    value={formData.propertyAddress}
                    onChange={(e) => setFormData({ ...formData, propertyAddress: e.target.value })}
                  />
                </Form.Item>
              </div>

              <Form.Item
                label="ZIP Code"
                name="zip"
                rules={[{ required: true, message: 'Please enter ZIP' }]}
              >
                <Input
                  size="large"
                  prefix={<EnvironmentOutlined />}
                  suffix={formData.zipMarket && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  placeholder="e.g., 28217"
                  maxLength={5}
                  value={formData.zip}
                  onChange={handleZipChange}
                />
              </Form.Item>
            </div>

            {formData.zip.length === 5 && (
              <Card className={formData.zipMarket ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-gray-300'}>
                <div className="flex items-start gap-3">
                  <PercentageOutlined className="text-2xl text-blue-500" />
                  <div className="flex-1">
                    {formData.zipMarket ? (
                      <>
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium">Market Tier: {formData.zipMarket.tier}</h4>
                          <Badge count="Applies on Products step" style={{ backgroundColor: '#108ee9' }} />
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          Material markup: {formData.zipMarket.markupPercent}%
                        </p>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={formData.applyZipMarkup}
                            onChange={(checked) => setFormData({ ...formData, applyZipMarkup: checked })}
                          />
                          <span className="text-sm">Apply ZIP material markup</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <h4 className="font-medium mb-1">Market Tier: Not configured</h4>
                        <p className="text-sm text-gray-500">No markup rules found for ZIP {formData.zip}</p>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium mb-1">Pricing Scheme</h4>
                  <p className="text-sm text-gray-500">
                    This determines how the job will be priced
                  </p>
                </div>
                <Select
                  value={formData.pricingScheme}
                  onChange={(value) => setFormData({ ...formData, pricingScheme: value })}
                  className="w-64"
                >
                  <Option value="squareFootTurnkey">Square-Foot (Turnkey)</Option>
                  <Option value="squareFootSeparated">Square-Foot (Labor + Paint)</Option>
                  <Option value="hourlyRate">Hourly (Time & Materials)</Option>
                  <Option value="unitPricing">Unit / Assembly Pricing</Option>
                  <Option value="roomFlatRate">Room / Area Flat Rate</Option>
                </Select>
              </div>
            </Card>
          </div>
        );

      case 1: // Job Type
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium mb-4">Select Job Type</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                className={`cursor-pointer transition-all ${
                  formData.jobType === 'interior' ? 'border-2 border-blue-500 bg-blue-50' : 'hover:shadow-md'
                }`}
                onClick={() => setFormData({ ...formData, jobType: 'interior' })}
              >
                <div className="text-center p-6">
                  <HomeOutlined className="text-4xl text-blue-500 mb-3" />
                  <h3 className="font-medium text-lg">Interior Painting</h3>
                  <p className="text-sm text-gray-500 mt-2">Indoor walls, ceilings, trim</p>
                </div>
              </Card>
              
              <Card
                className={`cursor-pointer transition-all ${
                  formData.jobType === 'exterior' ? 'border-2 border-blue-500 bg-blue-50' : 'hover:shadow-md'
                }`}
                onClick={() => setFormData({ ...formData, jobType: 'exterior' })}
              >
                <div className="text-center p-6">
                  <HomeOutlined className="text-4xl text-blue-500 mb-3" />
                  <h3 className="font-medium text-lg">Exterior Painting</h3>
                  <p className="text-sm text-gray-500 mt-2">Siding, trim, doors, windows</p>
                </div>
              </Card>
            </div>
          </div>
        );

      case 2: // Areas
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Select Areas & Surfaces</h3>
                <p className="text-sm text-gray-500">Choose areas to paint, then specify surfaces, dimensions, and colors</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Pricing Scheme:</span>
                <PricingSchemeSelect
                  value={formData.pricingScheme}
                  onValueChange={handlePricingSchemeChange}
                  size="small"
                  className="w-48"
                  helperText=""
                />
              </div>
            </div>

            {!formData.jobType ? (
              <Card>
                <div className="text-center p-8">
                  <HomeOutlined className="text-5xl text-gray-400 mb-3" />
                  <h3 className="font-medium mb-2">Select Job Type First</h3>
                  <p className="text-sm text-gray-500">Please go back to Step 2 and choose Interior or Exterior painting</p>
                  <Button type="primary" className="mt-4" onClick={() => setCurrentStep(1)}>
                    Go to Job Type
                  </Button>
                </div>
              </Card>
            ) : (
              <>
                <RoomSelector
                  jobType={formData.jobType}
                  selectedRooms={formData.areas.map(area => ({
                    id: area.id,
                    name: area.name,
                    type: formData.jobType
                  }))}
                  onRoomAdd={handleRoomAdd}
                  onRoomRemove={handleRoomRemove}
                  onRoomEdit={handleRoomEdit}
                />

                {formData.areas.length > 0 && (
                  <Card className="bg-gray-50">
                    <div className="text-sm font-medium mb-2">Current Surfaces Summary</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {formData.areas.flatMap(area =>
                        area.surfaces
                          .filter(surface => surface.selected)
                          .map(surface => {
                            const totalArea = calculatePaintableArea(surface.dimensions || {}, surface.type);
                            const unit = surface.type.toLowerCase() === 'trim' ? 'LF' : 'sq ft';
                            return (
                              <div
                                key={`${area.name}-${surface.type}-${surface.customSurface || ''}`}
                                className="flex justify-between items-center p-2 bg-white rounded text-sm"
                              >
                                <span className="font-medium">
                                  {area.name} - {surface.type === 'Custom' ? surface.customSurface : surface.type}
                                </span>
                                <Badge count={totalArea > 0 ? `${totalArea.toFixed(1)} ${unit}` : 'No area'} />
                              </div>
                            );
                          })
                      )}
                    </div>
                  </Card>
                )}

                {formData.areas.length > 0 && (
                  <div className="space-y-6">
                    {formData.areas.map((area) => (
                      <Card
                        key={area.id}
                        id={`room-details-${area.id}`}
                        className="border-2 border-blue-200"
                        title={
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-medium">{area.name}</span>
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => handleRoomRemove(area.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        }
                      >
                        <div className="space-y-6">
                          <div>
                            <h4 className="font-medium mb-3">Surfaces to Paint</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                              {area.surfaces.filter(s => s.type !== 'Custom').map((surface) => (
                                <Checkbox
                                  key={surface.type}
                                  checked={surface.selected}
                                  onChange={() => handleSurfaceToggle(area.id, surface.type)}
                                >
                                  {surface.type}
                                </Checkbox>
                              ))}
                            </div>

                            <div className="flex gap-2">
                              <Input
                                placeholder="Custom surface (e.g., Bookshelf, Mantel)"
                                id={`custom-input-${area.id}`}
                                onPressEnter={(e) => {
                                  if (e.currentTarget.value.trim()) {
                                    handleCustomSurfaceAdd(area.id, e.currentTarget.value.trim());
                                    e.currentTarget.value = '';
                                  }
                                }}
                              />
                              <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => {
                                  const input = document.getElementById(`custom-input-${area.id}`);
                                  if (input?.value.trim()) {
                                    handleCustomSurfaceAdd(area.id, input.value.trim());
                                    input.value = '';
                                  }
                                }}
                              >
                                Add
                              </Button>
                            </div>
                          </div>

                          {area.surfaces.filter(s => s.selected).map((surface) => (
                            <Card
                              key={`${surface.type}-${surface.customSurface || ''}`}
                              className="bg-blue-50"
                              size="small"
                            >
                              <div className="mb-3 flex items-center justify-between">
                                <h4 className="font-medium">
                                  {surface.type === 'Custom' ? surface.customSurface : surface.type}
                                </h4>
                                <Badge count={surface.dimensions?.unit || 'sq ft'} />
                              </div>

                              <div className="space-y-4">
                                <div>
                                  <div className="text-sm font-medium mb-2">Dimensions</div>
                                  <SurfaceAreaInput
                                    surfaceType={surface.type === 'Custom' ? surface.customSurface || 'Custom' : surface.type}
                                    dimensions={surface.dimensions || { unit: 'sq ft' }}
                                    onDimensionsChange={(newDimensions) => {
                                      handleDimensionsChange(area.id, surface.type, newDimensions);
                                    }}
                                  />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <div className="text-sm font-medium mb-2">Paint Color</div>
                                    <div className="space-y-2">
                                      <Select
                                        placeholder="Select brand"
                                        value={surface.color?.brand || undefined}
                                        onChange={(brand) => {
                                          handleColorChange(area.id, surface.type, {
                                            ...surface.color,
                                            brand,
                                            code: '',
                                            name: '',
                                            custom: false
                                          });
                                        }}
                                        className="w-full"
                                      >
                                        {paintBrands.map(brand => (
                                          <Option key={brand} value={brand}>{brand}</Option>
                                        ))}
                                        <Option value="custom">Custom Color</Option>
                                      </Select>

                                      {surface.color?.brand && surface.color.brand !== 'custom' && (
                                        <Select
                                          placeholder="Select color"
                                          value={surface.color?.code || undefined}
                                          onChange={(code) => {
                                            const colorData = mockColors[surface.color.brand]?.find(c => c.code === code);
                                            handleColorChange(area.id, surface.type, {
                                              ...surface.color,
                                              code,
                                              name: colorData?.name || ''
                                            });
                                          }}
                                          className="w-full"
                                        >
                                          {(mockColors[surface.color.brand] || []).map(color => (
                                            <Option key={color.code} value={color.code}>
                                              {color.name} ({color.code})
                                            </Option>
                                          ))}
                                        </Select>
                                      )}

                                      {surface.color?.brand === 'custom' && (
                                        <Input
                                          placeholder="Enter custom color details"
                                          value={surface.color?.customNote || ''}
                                          onChange={(e) => handleColorChange(area.id, surface.type, {
                                            ...surface.color,
                                            custom: true,
                                            customNote: e.target.value
                                          })}
                                        />
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-sm font-medium mb-2">Paint Sheen</div>
                                    <Select
                                      value={surface.sheen || 'Eggshell'}
                                      onChange={(sheen) => handleSheenChange(area.id, surface.type, sheen)}
                                      className="w-full"
                                    >
                                      {sheenOptions.map(sheen => (
                                        <Option key={sheen} value={sheen}>{sheen}</Option>
                                      ))}
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 3: // Products - Good/Better/Best Selection
        // Helper functions for product management
        const getAreaSurfaceKey = (areaId, surfaceType, tier) => `${areaId}-${surfaceType}-${tier}`;
        
        const getSelectedProduct = (areaId, surfaceType, tier) => {
          const key = getAreaSurfaceKey(areaId, surfaceType, tier);
          return formData[key];
        };
        
        const setSelectedProduct = (areaId, surfaceType, tier, productId) => {
          const key = getAreaSurfaceKey(areaId, surfaceType, tier);
          setFormData({ ...formData, [key]: productId });
        };
        
        const applyToAllSurfaces = (surfaceType, tier, productId) => {
          const updates = {};
          formData.areas.forEach(area => {
            const hasThisSurfaceType = area.surfaces.some(s =>
              s.selected && s.type.toLowerCase().includes(surfaceType.toLowerCase())
            );
            if (hasThisSurfaceType) {
              const key = getAreaSurfaceKey(area.id, surfaceType, tier);
              updates[key] = productId;
            }
          });
          setFormData({ ...formData, ...updates });
        };
        
        // Get unique surface types
        const getAllSurfaceTypes = () => {
          const surfaceTypes = new Set();
          formData.areas.forEach(area => {
            area.surfaces.forEach(surface => {
              if (surface.selected) {
                const type = surface.type.toLowerCase();
                const isCustom = surface.customSurface && surface.customSurface.trim() !== '';
                
                if (type.includes('wall')) surfaceTypes.add('Walls');
                else if (type.includes('ceiling')) surfaceTypes.add('Ceiling');
                else if (type.includes('cabinet')) surfaceTypes.add('Cabinets');
                else if (type.includes('trim') || type.includes('door') || type.includes('window')) surfaceTypes.add('Trim');
                else if (isCustom) surfaceTypes.add('Custom');
              }
            });
          });
          return Array.from(surfaceTypes);
        };
        
        const surfaceTypes = getAllSurfaceTypes();
        
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Select Product Quality Tier</h3>
                <p className="text-sm text-gray-500">Choose products for each tier that will appear on the customer proposal</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Pricing Scheme:</span>
                <PricingSchemeSelect
                  value={formData.pricingScheme}
                  onValueChange={handlePricingSchemeChange}
                  size="small"
                  className="w-48"
                  helperText=""
                />
              </div>
            </div>

            {formData.areas.length === 0 ? (
              <Card>
                <div className="text-center p-8">
                  <BgColorsOutlined className="text-5xl text-gray-400 mb-3" />
                  <h3 className="font-medium mb-2">No Areas Selected</h3>
                  <p className="text-sm text-gray-500">Go back to Areas & Surfaces to select areas first</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Blanket Controls */}
                {surfaceTypes.length > 0 && (
                  <Card className="border-2 border-blue-300 bg-blue-50">
                    <div className="mb-4">
                      <h4 className="font-medium text-lg flex items-center gap-2">
                        <BgColorsOutlined /> Quick Apply to All
                      </h4>
                      <p className="text-sm text-gray-500">Apply product selections to all areas with the same surface type</p>
                    </div>
                    <div className="space-y-4">
                      {surfaceTypes.map(surfaceType => {
                        const products = surfaceType === 'Walls' ? mockProducts.wall :
                                       surfaceType === 'Ceiling' ? { good: [mockProducts.ceiling.default], better: [mockProducts.ceiling.upgrade], best: [] } :
                                       surfaceType === 'Cabinets' ? mockProducts.cabinets :
                                       surfaceType === 'Custom' ? mockProducts.custom :
                                       { good: [mockProducts.trim.default], better: [mockProducts.trim.upgrade], best: [] };
                        
                        return (
                          <div key={surfaceType} className="space-y-3 bg-white p-4 rounded">
                            <h4 className="font-medium">{surfaceType}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {['good', 'better', 'best'].map((tier) => {
                                if ((surfaceType !== 'Walls' && surfaceType !== 'Cabinets' && surfaceType !== 'Custom') && tier === 'best') return null;
                                const tierProducts = products[tier] || [];
                                
                                return (
                                  <div key={tier} className="space-y-2">
                                    <div className="text-sm font-medium capitalize">{tier}</div>
                                    <Select
                                      placeholder="Select product"
                                      className="w-full"
                                      onChange={(value) => {
                                        if (value === 'deselect') {
                                          applyToAllSurfaces(surfaceType, tier, null);
                                        } else {
                                          applyToAllSurfaces(surfaceType, tier, value);
                                        }
                                      }}
                                      allowClear
                                    >
                                      {tierProducts.map((product) => (
                                        <Option key={product.id} value={product.id}>
                                          {product.name} - ${product.price}/gal
                                        </Option>
                                      ))}
                                    </Select>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* Area by Area Selection */}
                <div className="space-y-6">
                  <h3 className="font-medium text-lg">Area by Area Product Selection</h3>
                  {formData.areas.map((area) => {
                    const selectedSurfaces = area.surfaces.filter(s => s.selected);
                    if (selectedSurfaces.length === 0) return null;

                    const surfacesByCategory = {
                      Walls: selectedSurfaces.filter(s => s.type.toLowerCase().includes('wall')),
                      Ceiling: selectedSurfaces.filter(s => s.type.toLowerCase().includes('ceiling')),
                      Cabinets: selectedSurfaces.filter(s => s.type.toLowerCase().includes('cabinet')),
                      Trim: selectedSurfaces.filter(s =>
                        s.type.toLowerCase().includes('trim') ||
                        s.type.toLowerCase().includes('door') ||
                        s.type.toLowerCase().includes('window')
                      ),
                      Custom: selectedSurfaces.filter(s => s.customSurface && s.customSurface.trim() !== '')
                    };

                    return (
                      <Card key={area.id} title={<span className="text-lg font-medium">{area.name}</span>}>
                        <div className="space-y-6">
                          {Object.entries(surfacesByCategory).map(([category, surfaces]) => {
                            if (surfaces.length === 0) return null;

                            const products = category === 'Walls' ? mockProducts.wall :
                                           category === 'Ceiling' ? { good: [mockProducts.ceiling.default], better: [mockProducts.ceiling.upgrade], best: [] } :
                                           category === 'Cabinets' ? mockProducts.cabinets :
                                           category === 'Custom' ? mockProducts.custom :
                                           { good: [mockProducts.trim.default], better: [mockProducts.trim.upgrade], best: [] };

                            return (
                              <div key={category} className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium">{category}</h4>
                                  <Badge count={surfaces.map(s => s.type).join(', ')} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {['good', 'better', 'best'].map((tier) => {
                                    if ((category !== 'Walls' && category !== 'Cabinets' && category !== 'Custom') && tier === 'best') return null;
                                    const tierProducts = products[tier] || [];
                                    const selectedProductId = getSelectedProduct(area.id, category, tier);
                                    const selectedProduct = tierProducts.find(p => p.id === selectedProductId);

                                    return (
                                      <Card key={tier} size="small" className="bg-gray-50">
                                        <div className="mb-3 text-sm font-medium capitalize flex items-center justify-between">
                                          {tier}
                                          <Badge count={tier === 'good' ? 'Budget' : tier === 'better' ? 'Premium' : 'Top-tier'} style={{ fontSize: '10px' }} />
                                        </div>

                                        {selectedProduct ? (
                                          <div className="p-3 bg-blue-100 rounded mb-3">
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="text-xs font-medium">Selected</div>
                                              <Button
                                                size="small"
                                                type="text"
                                                onClick={() => setSelectedProduct(area.id, category, tier, null)}
                                              >
                                                Clear
                                              </Button>
                                            </div>
                                            <div className="text-sm font-medium">{selectedProduct.name}</div>
                                            <div className="text-xs text-gray-600">{selectedProduct.brand}</div>
                                            <div className="text-blue-600 font-bold">${selectedProduct.price}/gal</div>
                                          </div>
                                        ) : (
                                          <div className="p-3 bg-gray-100 rounded mb-3 text-center">
                                            <div className="text-sm text-gray-500">No product selected</div>
                                          </div>
                                        )}

                                        <div className="space-y-1">
                                          <div className="text-xs font-medium mb-2">Available Products</div>
                                          {tierProducts.map((product) => (
                                            <button
                                              key={product.id}
                                              onClick={() => setSelectedProduct(area.id, category, tier, product.id)}
                                              className={`w-full p-2 text-left rounded border transition-all ${
                                                selectedProductId === product.id
                                                  ? 'border-blue-500 bg-blue-50'
                                                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between">
                                                <div>
                                                  <div className="text-sm font-medium">{product.name}</div>
                                                  <div className="text-xs text-gray-500">{product.brand}</div>
                                                </div>
                                                <div className="text-sm font-bold text-blue-600">
                                                  ${product.price}/gal
                                                </div>
                                              </div>
                                            </button>
                                          ))}
                                        </div>
                                      </Card>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 4: // Summary
        const totalSelectedSurfaces = formData.areas.reduce((total, area) =>
          total + area.surfaces.filter(s => s.selected).length, 0
        );

        // Calculate costs
        const allProducts = {
          ...mockProducts.wall.good.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}),
          ...mockProducts.wall.better.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}),
          ...mockProducts.wall.best.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}),
          ...mockProducts.cabinets.good.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}),
          ...mockProducts.cabinets.better.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}),
          ...mockProducts.cabinets.best.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}),
          ...mockProducts.custom.good.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}),
          ...mockProducts.custom.better.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}),
          ...mockProducts.custom.best.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}),
          [mockProducts.ceiling.default.id]: mockProducts.ceiling.default,
          [mockProducts.ceiling.upgrade.id]: mockProducts.ceiling.upgrade,
          [mockProducts.trim.default.id]: mockProducts.trim.default,
          [mockProducts.trim.upgrade.id]: mockProducts.trim.upgrade
        };

        const laborRates = {
          interior: {
            'Walls': { rate: 3.5, unit: 'sq ft' },
            'Ceiling': { rate: 2.5, unit: 'sq ft' },
            'Trim': { rate: 12, unit: 'linear ft' },
            'Cabinets': { rate: 8, unit: 'sq ft' }
          },
          exterior: {
            'Walls': { rate: 4.5, unit: 'sq ft' },
            'Trim': { rate: 14, unit: 'linear ft' },
            'Deck': { rate: 3.25, unit: 'sq ft' }
          }
        };

        const jobTypeRates = formData.jobType === 'interior' ? laborRates.interior : laborRates.exterior;

        let totalLaborCost = 0;
        let totalMaterialCost = 0;

        formData.areas.forEach(area => {
          area.surfaces.filter(s => s.selected).forEach(surface => {
            const surfaceArea = calculatePaintableArea(surface.dimensions || {}, surface.type);
            
            // Labor cost calculation
            const surfaceRate = jobTypeRates[surface.type] || { rate: 3, unit: 'sq ft' };
            totalLaborCost += surfaceArea * surfaceRate.rate;

            // Material cost - using average of all selected tier products
            const surfaceCategory = surface.type.toLowerCase().includes('wall') ? 'Walls' :
                                   surface.type.toLowerCase().includes('ceiling') ? 'Ceiling' :
                                   surface.type.toLowerCase().includes('cabinet') ? 'Cabinets' :
                                   surface.type.toLowerCase().includes('trim') ? 'Trim' : 'Custom';
            
            let avgPrice = 0;
            let productCount = 0;
            ['good', 'better', 'best'].forEach(tier => {
              const productId = formData[`${area.id}-${surfaceCategory}-${tier}`];
              if (productId && allProducts[productId]) {
                avgPrice += allProducts[productId].price;
                productCount++;
              }
            });

            if (productCount > 0) {
              avgPrice = avgPrice / productCount;
              const gallonsNeeded = surfaceArea / 375; // 375 sq ft coverage per gallon
              totalMaterialCost += gallonsNeeded * avgPrice;
            }
          });
        });

        const zipMarkup = formData.applyZipMarkup && formData.zipMarket ?
          totalMaterialCost * (formData.zipMarket.markupPercent / 100) : 0;
        const totalEstimate = totalLaborCost + totalMaterialCost + zipMarkup;

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Quote Summary</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Pricing Scheme:</span>
                <PricingSchemeSelect
                  value={formData.pricingScheme}
                  onValueChange={handlePricingSchemeChange}
                  className="w-56"
                  helperText="Totals update automatically"
                />
              </div>
            </div>

            <Card title={<><UserOutlined /> Customer Information</>}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Name</span>
                  <p className="font-medium">{formData.customerName}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Phone</span>
                  <p className="font-medium">{formData.customerPhone}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Email</span>
                  <p className="font-medium">{formData.customerEmail}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">ZIP Code</span>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{formData.zip}</p>
                    {formData.zipMarket && (
                      <Badge count={formData.zipMarket.tier} style={{ backgroundColor: '#108ee9' }} />
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <span className="text-sm text-gray-500">Property Address</span>
                <p className="font-medium">{formData.propertyAddress}</p>
              </div>
            </Card>

            <Card title={<><HomeOutlined /> Job Details</>}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Job Type</span>
                  <p className="font-medium capitalize">{formData.jobType}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Pricing Scheme</span>
                  <p className="font-medium">
                    {formData.pricingScheme === 'squareFootTurnkey' ? 'Square-Foot (Turnkey)' :
                     formData.pricingScheme === 'squareFootSeparated' ? 'Square-Foot (Labor + Paint)' :
                     formData.pricingScheme === 'hourlyRate' ? 'Hourly (Time & Materials)' :
                     formData.pricingScheme === 'unitPricing' ? 'Unit / Assembly Pricing' :
                     'Room / Area Flat Rate'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Total Surfaces</span>
                  <p className="font-medium">{totalSelectedSurfaces} surfaces</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">ZIP Markup</span>
                  <p className="font-medium">
                    {formData.applyZipMarkup && formData.zipMarket ?
                      `${formData.zipMarket.markupPercent}% Applied` :
                      'Not Applied'}
                  </p>
                </div>
              </div>
            </Card>

            <Card title={<><UnorderedListOutlined /> Areas & Surfaces</>}>
              <div className="space-y-4">
                {formData.areas.map((area) => (
                  <div key={area.id} className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-medium text-lg mb-2">{area.name}</h4>
                    <div className="space-y-2">
                      {area.surfaces.filter(s => s.selected).map((surface) => {
                        const totalArea = calculatePaintableArea(surface.dimensions || {}, surface.type);
                        const unit = surface.type.toLowerCase() === 'trim' ? 'LF' : 'sq ft';
                        return (
                          <div key={`${surface.type}-${surface.customSurface || ''}`} className="bg-gray-50 p-3 rounded">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm">
                                  {surface.type === 'Custom' ? surface.customSurface : surface.type}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {totalArea > 0 ? `${totalArea.toFixed(1)} ${unit}` : 'No dimensions'}
                                </p>
                                {surface.color && (
                                  <p className="text-xs text-gray-600">
                                    Color: {surface.color.custom ? surface.color.customNote :
                                      `${surface.color.brand} ${surface.color.name || ''} ${surface.color.code || ''}`
                                    } • {surface.sheen}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title={<><CalculatorOutlined /> Estimate Breakdown</>} className="bg-blue-50">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Labor Cost (varies by surface type)</span>
                  <span className="font-medium text-lg">${totalLaborCost.toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Material Cost (paint & supplies)</span>
                  <span className="font-medium text-lg">${totalMaterialCost.toFixed(0)}</span>
                </div>
                {zipMarkup > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">ZIP Markup ({formData.zipMarket?.markupPercent}%)</span>
                    <span className="font-medium text-lg">${zipMarkup.toFixed(0)}</span>
                  </div>
                )}
                <div className="border-t-2 border-gray-300 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-xl text-gray-900">Total Estimate</span>
                    <span className="font-bold text-2xl text-blue-600">${totalEstimate.toFixed(0)}</span>
                  </div>
                  <p className="text-xs text-gray-500 text-right mt-1">
                    Based on {totalSelectedSurfaces} surfaces and selected paint products
                  </p>
                </div>
              </div>
            </Card>

            <Form.Item label="Additional Notes">
              <TextArea
                rows={3}
                placeholder="Any additional notes or special requirements..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Form.Item>

            <div className="flex gap-3">
              <Button type="primary" icon={<DownloadOutlined />} size="large">
                Generate Proposal PDF
              </Button>
              <Button size="large">Save Draft</Button>
              <Button type="primary" danger size="large">
                Send to Client
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl md:text-3xl font-bold">Create New Quote</h2>
            <span className="text-sm text-gray-500">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          
          <Progress percent={progress} showInfo={false} className="mb-6" />
          
          {/* Step Indicators */}
          <Steps current={currentStep} className="hidden md:flex">
            {steps.map((step) => (
              <Steps.Step
                key={step.id}
                title={step.title}
                icon={<step.icon />}
              />
            ))}
          </Steps>
        </div>

        {/* Step Content */}
        <Card>
          <div className="mb-6">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              {(() => {
                const StepIcon = steps[currentStep].icon;
                return <StepIcon className="text-blue-500" />;
              })()}
              {steps[currentStep].title}
            </h3>
          </div>

          <Form form={form} layout="vertical">
            {renderStepContent()}
          </Form>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t mt-6">
            <Button
              size="large"
              icon={<LeftOutlined />}
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button
                type="primary"
                size="large"
                icon={<RightOutlined />}
                iconPosition="end"
                onClick={handleNext}
              >
                Next
              </Button>
            ) : (
              <Button type="primary" size="large">
                Complete Quote
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default QuoteBuilderPage;
