import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  InputNumber,
  message,
  Tag,
  Space,
  Popconfirm,
  Alert,
  Tabs,
  Card,
  Input,
  Divider,
  Collapse,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import apiService from '../services/apiService';

const { Option } = Select;
const { TabPane } = Tabs;

const ContractorProductConfigManager = () => {
  const [configs, setConfigs] = useState([]);
  const [brands, setBrands] = useState([]);
  const [globalProducts, setGlobalProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [laborDefaults, setLaborDefaults] = useState(null);
  const [selectedGlobalProduct, setSelectedGlobalProduct] = useState(null);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activeTab, setActiveTab] = useState('labor');
  const [form] = Form.useForm();
  const [laborForm] = Form.useForm();
  const [markupForm] = Form.useForm();
  const [laborModalVisible, setLaborModalVisible] = useState(false);
  const [editingLaborRate, setEditingLaborRate] = useState(null);
  const [laborRateType, setLaborRateType] = useState('interior');
  const [savingSettings, setSavingSettings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [savingLaborRate, setSavingLaborRate] = useState(false);
  const [deletingLaborRate, setDeletingLaborRate] = useState(null);

  // Pricing Engine: Labor pricing states
  const [laborLoading, setLaborLoading] = useState(true);
  const [laborInitializing, setLaborInitializing] = useState(false);
  const [laborSaving, setLaborSaving] = useState(false);
  const [laborCategories, setLaborCategories] = useState([]);
  const [laborRates, setLaborRates] = useState({});
  const [laborSearchText, setLaborSearchText] = useState('');
  const [laborHasChanges, setLaborHasChanges] = useState(false);

  // Responsive detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetchAllData();
  }, []);

  // Populate markup form when laborDefaults loads
  useEffect(() => {
    if (laborDefaults) {
      markupForm.setFieldsValue({
        defaultMarkup: laborDefaults.defaultMarkup || 15,
        taxRate: laborDefaults.defaultTaxRate || 0,
        laborHourRate: laborDefaults.defaultLaborHourRate || 0,
        laborMarkupPercent: laborDefaults.laborMarkupPercent || 0,
        materialMarkupPercent: laborDefaults.materialMarkupPercent || 0,
        overheadPercent: laborDefaults.overheadPercent || 0,
        netProfitPercent: laborDefaults.netProfitPercent || 0,
        depositPercentage: laborDefaults.depositPercentage || 50,
        quoteValidityDays: laborDefaults.quoteValidityDays || 30,
        turnkeyInteriorRate: laborDefaults.turnkeyInteriorRate || 0,
        turnkeyExteriorRate: laborDefaults.turnkeyExteriorRate || 0,
        prepRepairHourlyRate: laborDefaults.prepRepairHourlyRate || 0,
        finishCabinetHourlyRate: laborDefaults.finishCabinetHourlyRate || 0,
        productionInteriorWalls: laborDefaults.productionInteriorWalls || 0,
        productionInteriorCeilings: laborDefaults.productionInteriorCeilings || 0,
        productionInteriorTrim: laborDefaults.productionInteriorTrim || 0,
        productionExteriorWalls: laborDefaults.productionExteriorWalls || 0,
        productionExteriorTrim: laborDefaults.productionExteriorTrim || 0,
        productionSoffitFascia: laborDefaults.productionSoffitFascia || 0,
        productionDoors: laborDefaults.productionDoors || 0,
        productionCabinets: laborDefaults.productionCabinets || 0,
      });
    }
  }, [laborDefaults, markupForm]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [brandsRes, productsRes, configsRes, defaultsRes] = await Promise.all([
        apiService.getAdminBrands(),
        apiService.getGlobalProducts(),
        apiService.getProductConfigs(),
        apiService.getProductConfigDefaults(),
      ]);

      setBrands(brandsRes.data || []);
      setGlobalProducts(productsRes.data || []);
      setConfigs(configsRes?.data || []);
      setLaborDefaults(defaultsRes.data || null);
    } catch (error) {
      message.error('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Load labor categories + rates for Pricing Engine
  useEffect(() => {
    (async () => {
      await fetchLaborData();
    })();
  }, []);

  const fetchLaborData = async () => {
    try {
      setLaborLoading(true);
      const [categoriesResponse, ratesResponse] = await Promise.all([
        apiService.get('/labor-categories'),
        apiService.get('/labor-categories/rates'),
      ]);

      if (categoriesResponse.success) {
        const cats = categoriesResponse.data || [];
        setLaborCategories(cats);
        const ratesObj = {};
        cats.forEach((cat) => {
          const existingRate = ratesResponse.data?.find(
            (r) => r.laborCategoryId === cat.id
          );
          ratesObj[cat.id] = existingRate ? parseFloat(existingRate.rate) : 0;
        });
        setLaborRates(ratesObj);
      }
    } catch (error) {
      message.error('Failed to load labor categories: ' + error.message);
    } finally {
      setLaborLoading(false);
    }
  };

  const initializeLaborCategories = async () => {
    try {
      setLaborInitializing(true);
      const response = await apiService.post('/labor-categories/initialize');
      if (response.success) {
        message.success('Labor categories initialized successfully');
        await fetchLaborData();
      }
    } catch (error) {
      message.error('Failed to initialize categories: ' + error.message);
    } finally {
      setLaborInitializing(false);
    }
  };

  const handleLaborRateChange = (categoryId, value) => {
    setLaborRates({ ...laborRates, [categoryId]: value });
    setLaborHasChanges(true);
  };

  const saveLaborRates = async () => {
    try {
      setLaborSaving(true);
      const ratesArray = Object.entries(laborRates).map(([categoryId, rate]) => ({
        categoryId: parseInt(categoryId),
        rate: parseFloat(rate) || 0,
      }));
      const response = await apiService.post('/labor-categories/rates/bulk', {
        rates: ratesArray,
      });
      if (response.success) {
        message.success('Labor rates saved successfully');
        setLaborHasChanges(false);
        await fetchLaborData();
      }
    } catch (error) {
      message.error('Failed to save labor rates: ' + error.message);
    } finally {
      setLaborSaving(false);
    }
  };

  const getUnitLabel = (unit) => {
    const labels = {
      sqft: 'per sq ft',
      linear_foot: 'per linear foot',
      unit: 'per unit',
      hour: 'per hour',
    };
    return labels[unit] || `per ${unit}`;
  };

  const laborColumns = [
    {
      title: 'Labor Category',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: isMobile ? 200 : '40%',
      render: (text, record) => (
        <div>
          <span style={{ fontWeight: 600 }}>{text}</span>
          <br />
          <span style={{ color: '#888', fontSize: 12 }}>{record.description}</span>
        </div>
      ),
    },
    {
      title: 'Measurement Unit',
      dataIndex: 'measurementUnit',
      key: 'measurementUnit',
      width: isMobile ? 120 : '20%',
      render: (unit) => getUnitLabel(unit),
    },
    {
      title: 'Labor Rate',
      key: 'rate',
      width: isMobile ? 180 : '25%',
      render: (_, record) => (
        <InputNumber
          style={{ width: isMobile ? '100%' : 150 }}
          min={0}
          step={0.25}
          precision={2}
          value={laborRates[record.id] || 0}
          onChange={(value) => handleLaborRateChange(record.id, value)}
          prefix="$"
          addonAfter={getUnitLabel(record.measurementUnit).replace('per ', '')}
        />
      ),
    },
  ];

  const fetchConfigs = async (brandId = null) => {
    setLoading(true);
    try {
      const params = brandId ? { brandId } : {};
      const response = await apiService.getProductConfigs(params);
      setConfigs(response?.data || []);
    } catch (error) {
      message.error('Failed to fetch configurations: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    // Check if brands exist
    if (brands.length === 0) {
      message.warning('Please add at least one brand before creating product configurations');
      return;
    }

    // Check if a brand is selected for filtering
    if (!selectedBrandFilter) {
      message.warning('Please select a brand from the filter dropdown before adding a configuration');
      return;
    }

    setEditingConfig(null);
    setSelectedGlobalProduct(null);
    form.resetFields();
    
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingConfig(record);
    setSelectedGlobalProduct(record.globalProduct);
    
    // Parse sheens into form-friendly format
    const sheensFormData = {};
    if (record.sheens && Array.isArray(record.sheens)) {
      for (const sheen of record.sheens) {
        sheensFormData[sheen.sheen] = {
          price: sheen.price,
          coverage: sheen.coverage,
        };
      }
    }
    
    form.setFieldsValue({
      globalProductId: record.globalProductId,
      sheens: sheensFormData,
    });
    
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await apiService.deleteProductConfig(id);
      message.success('Configuration deleted successfully');
      fetchConfigs();
    } catch (error) {
      message.error('Failed to delete configuration: ' + error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      
      // Transform sheens object back to array format
      const sheensArray = [];
      const selectedProduct = globalProducts.find(p => p.id === values.globalProductId);
      
      if (selectedProduct && selectedProduct.sheenOptions) {
        const sheenOptions = selectedProduct.sheenOptions.split(',').map(s => s.trim());
        for (const sheen of sheenOptions) {
          if (values.sheens && values.sheens[sheen]) {
            sheensArray.push({
              sheen,
              price: values.sheens[sheen].price,
              coverage: values.sheens[sheen].coverage,
            });
          }
        }
      }
      
      const payload = {
        globalProductId: values.globalProductId,
        sheens: sheensArray,
        laborRates: laborDefaults?.laborRates || { interior: [], exterior: [] },
        defaultMarkup: laborDefaults?.defaultMarkup || 15,
        productMarkups: {},
        taxRate: laborDefaults?.defaultTaxRate || 0,
      };
      
      if (editingConfig) {
        await apiService.updateProductConfig(editingConfig.id, payload);
        message.success('Configuration updated successfully');
      } else {
        await apiService.createProductConfig(payload);
        message.success('Configuration created successfully');
      }
      
      setModalVisible(false);
      form.resetFields();
      fetchConfigs();
    } catch (error) {
      if (error.response?.status === 409) {
        message.error('A configuration for this product already exists');
      } else if (error.errorFields) {
        message.error('Please fill in all required fields');
      } else {
        message.error('Failed to save configuration: ' + error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLaborRate = (type) => {
    setLaborRateType(type);
    setEditingLaborRate(null);
    laborForm.resetFields();
    laborForm.setFieldsValue({
      category: '',
      rate: 0,
      unit: 'sqft',
      description: '',
    });
    setLaborModalVisible(true);
  };

  const handleEditLaborRate = (rate, type, index) => {
    setLaborRateType(type);
    setEditingLaborRate({ ...rate, index, type });
    laborForm.setFieldsValue(rate);
    setLaborModalVisible(true);
  };

  const handleDeleteLaborRate = async (type, index) => {
    setDeletingLaborRate(`${type}-${index}`);
    try {
      const updatedLaborRates = { ...laborDefaults.laborRates };
      updatedLaborRates[type] = updatedLaborRates[type].filter((_, i) => i !== index);
      
      // Update via API (you'll need to create this endpoint)
      const response = await apiService.updateProductConfigDefaults({
        laborRates: updatedLaborRates,
      });
      
      if (response.success) {
        setLaborDefaults(prev => ({
          ...prev,
          laborRates: updatedLaborRates,
        }));
        message.success('Labor rate deleted successfully');
      }
    } catch (error) {
      message.error('Failed to delete labor rate: ' + error.message);
    } finally {
      setDeletingLaborRate(null);
    }
  };

  const handleLaborRateSubmit = async () => {
    setSavingLaborRate(true);
    try {
      const values = await laborForm.validateFields();
      const updatedLaborRates = { ...laborDefaults.laborRates };
      
      if (editingLaborRate) {
        // Update existing rate
        updatedLaborRates[laborRateType][editingLaborRate.index] = values;
      } else {
        // Add new rate
        if (!updatedLaborRates[laborRateType]) {
          updatedLaborRates[laborRateType] = [];
        }
        updatedLaborRates[laborRateType].push(values);
      }
      
      // Update via API
      const response = await apiService.updateProductConfigDefaults({
        laborRates: updatedLaborRates,
      });
      
      if (response.success) {
        setLaborDefaults(prev => ({
          ...prev,
          laborRates: updatedLaborRates,
        }));
        message.success(editingLaborRate ? 'Labor rate updated successfully' : 'Labor rate added successfully');
        setLaborModalVisible(false);
      }
    } catch (error) {
      if (error.errorFields) {
        message.error('Please fill in all required fields');
      } else {
        message.error('Failed to save labor rate: ' + error.message);
      }
    } finally {
      setSavingLaborRate(false);
    }
  };

  const handleSaveMarkupAndTax = async () => {
    try {
      setSavingSettings(true);
      const values = await markupForm.validateFields();
      
      const response = await apiService.updateProductConfigDefaults({
        defaultMarkup: values.defaultMarkup,
        defaultTaxRate: values.taxRate,
        defaultLaborHourRate: values.laborHourRate,
        laborMarkupPercent: values.laborMarkupPercent,
        materialMarkupPercent: values.materialMarkupPercent,
        overheadPercent: values.overheadPercent,
        netProfitPercent: values.netProfitPercent,
        depositPercentage: values.depositPercentage,
        quoteValidityDays: values.quoteValidityDays,
        turnkeyInteriorRate: values.turnkeyInteriorRate,
        turnkeyExteriorRate: values.turnkeyExteriorRate,
        prepRepairHourlyRate: values.prepRepairHourlyRate,
        finishCabinetHourlyRate: values.finishCabinetHourlyRate,
        productionInteriorWalls: values.productionInteriorWalls,
        productionInteriorCeilings: values.productionInteriorCeilings,
        productionInteriorTrim: values.productionInteriorTrim,
        productionExteriorWalls: values.productionExteriorWalls,
        productionExteriorTrim: values.productionExteriorTrim,
        productionSoffitFascia: values.productionSoffitFascia,
        productionDoors: values.productionDoors,
        productionCabinets: values.productionCabinets,
      });
      
      if (response.success) {
        setLaborDefaults(prev => ({
          ...prev,
          ...values,
        }));
        message.success('Pricing settings updated successfully');
      }
    } catch (error) {
      if (error.errorFields) {
        message.error('Please fill in all required fields');
      } else {
        message.error('Failed to update settings: ' + error.message);
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleGlobalProductChange = (productId) => {
    const product = globalProducts.find(p => p.id === productId);
    setSelectedGlobalProduct(product);
    
    // Filter global products by selected brand (warn if mismatch)
    if (selectedBrandFilter && product && product.brandId !== selectedBrandFilter) {
      message.warning('This product belongs to a different brand. Please select a product from the filtered brand.');
      return;
    }
    
    // Initialize sheen fields with default coverage
    if (product && product.sheenOptions && laborDefaults) {
      const sheenOptions = product.sheenOptions.split(',').map(s => s.trim());
      const sheensInit = {};
      for (const sheen of sheenOptions) {
        sheensInit[sheen] = {
          price: 0,
          coverage: laborDefaults.defaultCoverage || 350,
        };
      }
      form.setFieldsValue({ sheens: sheensInit });
    }
  };

  // Table columns
  const columns = [
    {
      title: 'Brand',
      key: 'brand',
      width: isMobile ? 100 : 150,
      render: (_, record) => {
        const globalProd = record.globalProduct;
        if (globalProd) {
          return globalProd.brand?.name || globalProd.customBrand || 'N/A';
        }
        return 'N/A';
      },
    },
    {
      title: 'Product Name',
      dataIndex: ['globalProduct', 'name'],
      key: 'productName',
      width: isMobile ? 150 : 250,
      ellipsis: true,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          {isMobile && (
            <div style={{ fontSize: '12px', color: '#888', marginTop: 4 }}>
              {record.globalProduct?.brand?.name || record.globalProduct?.customBrand}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: ['globalProduct', 'category'],
      key: 'category',
      width: isMobile ? 80 : 120,
      render: (category) => (
        <Tag color={category === 'Interior' ? 'blue' : 'green'}>
          {category}
        </Tag>
      ),
      responsive: ['md'],
    },
    {
      title: 'Sheen Pricing',
      dataIndex: 'sheens',
      key: 'sheens',
      width: isMobile ? 200 : 300,
      render: (sheens) => (
        <div style={{ maxWidth: isMobile ? '150px' : '250px' }}>
          {sheens && sheens.length > 0 ? (
            sheens.map((sheen) => (
              <div key={sheen.sheen} className='mb-1'>
                <Tag color='green' className={isMobile ? 'text-xs' : ''}>{sheen.sheen}</Tag>
                <span className={isMobile ? 'text-[10px]' : 'text-xs'}>
                  ${Number(sheen.price).toFixed(2)}/gal{!isMobile && ` • ${sheen.coverage} sq ft/gal`}
                </span>
              </div>
            ))
          ) : (
            <span style={{ color: '#999' }}>No sheens</span>
          )}
        </div>
      ),
      responsive: ['md'],
    },
    {
      title: 'Markup',
      dataIndex: 'defaultMarkup',
      key: 'markup',
      width: isMobile ? 80 : 100,
      render: (markup) => <Tag color="orange">{markup}%</Tag>,
      responsive: ['md'],
    },
    {
      title: 'Tax',
      dataIndex: 'taxRate',
      key: 'tax',
      width: isMobile ? 80 : 100,
      render: (tax) => <Tag color="purple">{tax}%</Tag>,
      responsive: ['lg'],
    },
    {
      title: 'Actions',
      key: 'actions',
      width: isMobile ? 100 : 150,
      fixed: isMobile ? undefined : 'right',
      render: (_, record) => (
        <Space size="small" direction={isMobile ? 'vertical' : 'horizontal'}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            block={isMobile}
            disabled={deletingId === record.id || loading}
          >
            {isMobile ? 'Edit' : ''}
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this configuration?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              icon={<DeleteOutlined />}
              danger
              size="small"
              block={isMobile}
              loading={deletingId === record.id}
              disabled={deletingId === record.id || loading}
            >
              {isMobile ? 'Delete' : ''}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Filter configs based on selected brand, category, and search text
  const filteredConfigs = configs.filter(config => {
    const globalProd = config.globalProduct;
    
    // Filter by brand
    const brandMatch = !selectedBrandFilter
      ? true
      : globalProd?.brandId === selectedBrandFilter || globalProd?.brand?.id === selectedBrandFilter;
    
    // Filter by category
    const categoryMatch = !selectedCategoryFilter
      ? true
      : globalProd?.category === selectedCategoryFilter;
    
    // Filter by search text (product name or brand name)
    const searchMatch = !searchText
      ? true
      : globalProd?.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        globalProd?.brand?.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        globalProd?.customBrand?.toLowerCase().includes(searchText.toLowerCase());
    
    return brandMatch && categoryMatch && searchMatch;
  });

  // Filter global products based on selected brand and category
  const filteredGlobalProducts = globalProducts.filter(gp => {
    // Filter by brand
    const brandMatch = !selectedBrandFilter
      ? true
      : gp.brandId === selectedBrandFilter;
    
    // Filter by category
    const categoryMatch = !selectedCategoryFilter
      ? true
      : gp.category === selectedCategoryFilter;
    
    return brandMatch && categoryMatch;
  });

  // Render sheen fields dynamically based on selected product
  const renderSheenFields = () => {
    if (!selectedGlobalProduct || !selectedGlobalProduct.sheenOptions) {
      return (
        <Alert
          message="Please select a product first"
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
        />
      );
    }

    const sheenOptions = selectedGlobalProduct.sheenOptions.split(',').map(s => s.trim());
    
    return (
      <>
        <h4 className="font-semibold mb-3 text-sm sm:text-base">Pricing & Coverage by Sheen:</h4>
        
        {sheenOptions.map((sheen) => (
          <div key={sheen} className="mb-4 p-2 sm:p-3 border rounded">
            <h5 className="font-medium mb-2 text-sm">{sheen}</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Form.Item
                name={['sheens', sheen, 'price']}
                label="Price per Gallon"
                rules={[
                  { required: true, message: `Please enter price for ${sheen}` },
                  { type: 'number', min: 0, message: 'Must be >= 0' },
                ]}
                className="mb-2 sm:mb-0"
              >
                <InputNumber
                  prefix="$"
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder={`Price for ${sheen}`}
                />
              </Form.Item>

              <Form.Item
                name={['sheens', sheen, 'coverage']}
                label="Coverage (sq ft/gallon)"
                rules={[
                  { required: true, message: `Please enter coverage for ${sheen}` },
                  { type: 'number', min: 1, message: 'Must be > 0' },
                ]}
                className="mb-2 sm:mb-0"
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder={`Coverage for ${sheen}`}
                />
              </Form.Item>
            </div>
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Pricing Engine</h2>
        <p className="text-sm text-gray-500">Manage your labor rates, material costs, markups, and pricing rules</p>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size={isMobile ? 'small' : 'large'}
      >
        {/* Labor Pricing Tab */}
        <TabPane tab="Labor Pricing" key="labor">
          <div className="space-y-6">
            <div className='flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap items-start sm:items-center justify-between'>
              <Input
                placeholder="Search labor categories"
                value={laborSearchText}
                onChange={(e) => setLaborSearchText(e.target.value)}
                allowClear
                className="w-full sm:w-[250px]"
              />
              <Space>
                {laborCategories.length === 0 && (
                  <Button type="dashed" onClick={initializeLaborCategories} loading={laborInitializing}>
                    Initialize Categories
                  </Button>
                )}
                <Button type="primary" onClick={saveLaborRates} loading={laborSaving} disabled={!laborHasChanges}>
                  Update Rates
                </Button>
              </Space>
            </div>

            <Card size="small" className="mt-2">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <span className="font-medium">Labor Hour Rate</span>
                <Form form={markupForm} layout="inline">
                  <Form.Item name="laborHourRate" rules={[{ required: true, message: 'Enter hourly rate' }]}> 
                    <InputNumber prefix="$" min={0} precision={2} style={{ width: 160 }} />
                  </Form.Item>
                  <Button onClick={handleSaveMarkupAndTax} loading={savingSettings}>Save</Button>
                </Form>
              </div>
            </Card>

            <Table
              columns={laborColumns}
              dataSource={laborCategories.filter(c => c.categoryName?.toLowerCase().includes(laborSearchText.toLowerCase()))}
              rowKey="id"
              pagination={false}
              loading={laborLoading}
              size="middle"
            />
          </div>
        </TabPane>
        {/* Products Tab */}
        <TabPane tab="Material Pricing" key="products">
          <div className="space-y-6">
            {/* Filter Controls */}
            <div className='flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap items-start sm:items-center justify-between'>
            <div className='flex flex-col sm:flex-row gap-2 sm:gap-3'>
              <Input
                placeholder="Search products or brands..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                className="w-full sm:w-[250px]"
              />
              <Select
                placeholder="Filter by Brand"
                className="w-full sm:w-[200px]"
                value={selectedBrandFilter}
                onChange={setSelectedBrandFilter}
                allowClear
                onClear={() => setSelectedBrandFilter(null)}
              >
                {brands.map((brand) => (
                  <Option key={brand.id} value={brand.id}>
                    {brand.name}
                  </Option>
                ))}
              </Select>
              <Select
                placeholder="Filter by Category"
                className="w-full sm:w-[200px]"
                value={selectedCategoryFilter}
                onChange={setSelectedCategoryFilter}
                allowClear
                onClear={() => setSelectedCategoryFilter(null)}
              >
                <Option value="Interior">Interior</Option>
                <Option value="Exterior">Exterior</Option>
              </Select>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              className="w-full sm:w-auto"
              loading={loading}
              disabled={loading}
            >
              Add Configuration
            </Button>
          </div>

          <Table
            columns={columns}
            dataSource={filteredConfigs}
            loading={loading}
            rowKey="id"
            scroll={{ x: isMobile ? 700 : 'max-content' }}
            pagination={{
              pageSize: isMobile ? 10 : 20,
              simple: isMobile,
              showSizeChanger: !isMobile,
              showTotal: (total) => `Total ${total} configs`,
            }}
          />
          </div>
        </TabPane>

        {/* Markup Rules Tab */}
        <TabPane tab="Markup Rules" key="markup">
          <Card>
            <Form form={markupForm} layout={isMobile ? 'vertical' : 'horizontal'} labelCol={{ span: 10 }} wrapperCol={{ span: 12 }}>
              
              {/* Markup Percentages */}
              <Divider orientation="left">Markup Percentages</Divider>
              <Form.Item name="laborMarkupPercent" label="Labor Markup" rules={[{ required: true }]}> 
                <InputNumber min={0} max={100} precision={2} addonAfter="%" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="materialMarkupPercent" label="Material Markup" rules={[{ required: true }]}> 
                <InputNumber min={0} max={100} precision={2} addonAfter="%" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="overheadPercent" label="Overhead" rules={[{ required: true }]}> 
                <InputNumber min={0} max={100} precision={2} addonAfter="%" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="netProfitPercent" label="Net Profit" rules={[{ required: true }]}> 
                <InputNumber min={0} max={100} precision={2} addonAfter="%" style={{ width: 200 }} />
              </Form.Item>

              {/* Tax & Quote Settings */}
              <Divider orientation="left">Tax & Quote Settings</Divider>
              <Form.Item name="defaultMarkup" label="Default Markup" rules={[{ required: true }]}> 
                <InputNumber min={0} max={100} precision={2} addonAfter="%" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="taxRate" label="Tax Rate" rules={[{ required: true }]}> 
                <InputNumber min={0} max={100} precision={2} addonAfter="%" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="depositPercentage" label="Deposit Required" rules={[{ required: true }]}> 
                <InputNumber min={0} max={100} precision={2} addonAfter="%" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="quoteValidityDays" label="Quote Validity" rules={[{ required: true }]}> 
                <InputNumber min={1} max={365} precision={0} addonAfter="days" style={{ width: 200 }} />
              </Form.Item>

              {/* Turnkey Square Foot Rates */}
              <Divider orientation="left">Turnkey Square Foot Rates</Divider>
              <Form.Item name="turnkeyInteriorRate" label="Interior Turnkey Rate" tooltip="All-in price per sq ft for interior projects"> 
                <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ sq ft" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="turnkeyExteriorRate" label="Exterior Turnkey Rate" tooltip="All-in price per sq ft for exterior projects"> 
                <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ sq ft" style={{ width: 200 }} />
              </Form.Item>

              {/* Global Hourly Labor Rates */}
              <Divider orientation="left">Global Hourly Labor Rates</Divider>
              <Form.Item name="laborHourRate" label="Base Hourly Rate" tooltip="Standard labor rate per hour"> 
                <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ hour" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="prepRepairHourlyRate" label="Prep/Repair Rate" tooltip="Hourly rate for prep and repair work"> 
                <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ hour" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="finishCabinetHourlyRate" label="Finish/Cabinet Rate" tooltip="Hourly rate for finish and cabinet work"> 
                <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ hour" style={{ width: 200 }} />
              </Form.Item>

              {/* Production Rates - Interior */}
              <Divider orientation="left">Production Rates - Interior</Divider>
              <Form.Item name="productionInteriorWalls" label="Interior Walls" tooltip="How many sq ft of interior walls per hour"> 
                <InputNumber min={0} precision={2} addonAfter="sq ft / hour" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="productionInteriorCeilings" label="Interior Ceilings" tooltip="How many sq ft of ceiling per hour"> 
                <InputNumber min={0} precision={2} addonAfter="sq ft / hour" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="productionInteriorTrim" label="Interior Trim" tooltip="How many linear feet of trim per hour"> 
                <InputNumber min={0} precision={2} addonAfter="linear ft / hour" style={{ width: 200 }} />
              </Form.Item>

              {/* Production Rates - Exterior */}
              <Divider orientation="left">Production Rates - Exterior</Divider>
              <Form.Item name="productionExteriorWalls" label="Exterior Walls" tooltip="How many sq ft of exterior walls per hour"> 
                <InputNumber min={0} precision={2} addonAfter="sq ft / hour" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="productionExteriorTrim" label="Exterior Trim" tooltip="How many linear feet of exterior trim per hour"> 
                <InputNumber min={0} precision={2} addonAfter="linear ft / hour" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="productionSoffitFascia" label="Soffit & Fascia" tooltip="How many linear feet of soffit/fascia per hour"> 
                <InputNumber min={0} precision={2} addonAfter="linear ft / hour" style={{ width: 200 }} />
              </Form.Item>

              {/* Production Rates - Optional */}
              <Divider orientation="left">Production Rates - Optional</Divider>
              <Form.Item name="productionDoors" label="Doors" tooltip="How many doors per hour"> 
                <InputNumber min={0} precision={2} addonAfter="units / hour" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="productionCabinets" label="Cabinets" tooltip="How many cabinet units per hour"> 
                <InputNumber min={0} precision={2} addonAfter="units / hour" style={{ width: 200 }} />
              </Form.Item>

              {/* Action Buttons */}
              <Form.Item wrapperCol={{ span: 12, offset: isMobile ? 0 : 10 }}>
                <Space>
                  <Button onClick={() => markupForm.resetFields()}>Reset</Button>
                  <Button type="primary" onClick={handleSaveMarkupAndTax} loading={savingSettings}>Save All Settings</Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

      </Tabs>

      <Modal
        title={editingConfig ? 'Edit Product Configuration' : 'Add Product Configuration'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedGlobalProduct(null);
          form.resetFields();
        }}
        footer={null}
        width={isMobile ? '100%' : 700}
        style={isMobile ? { top: 0, maxWidth: '100%', paddingBottom: 0 } : {}}
        bodyStyle={isMobile ? { maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' } : {}}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {/* Global Product Selection */}
          <Form.Item
            name="globalProductId"
            label="Select Product"
            rules={[{ required: true, message: 'Please select a product' }]}
          >
            <Select
              placeholder="Select a product from global catalog"
              onChange={handleGlobalProductChange}
              showSearch
              optionFilterProp="children"
              disabled={!!editingConfig}
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {filteredGlobalProducts.map((product) => (
                <Option key={product.id} value={product.id}>
                  {product.brand?.name || product.customBrand} - {product.name} ({product.category})
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* Show product details */}
          {selectedGlobalProduct && (
            <div className="mb-4 p-3 sm:p-4 bg-blue-50 rounded">
              <h4 className="font-semibold mb-2 text-sm sm:text-base">Product Details:</h4>
              <p className="text-xs sm:text-sm"><strong>Brand:</strong> {selectedGlobalProduct.brand?.name || selectedGlobalProduct.customBrand}</p>
              <p className="text-xs sm:text-sm"><strong>Category:</strong> {selectedGlobalProduct.category}</p>
              <p className="text-xs sm:text-sm"><strong>Available Sheens:</strong> {selectedGlobalProduct.sheenOptions}</p>
              {selectedGlobalProduct.description && (
                <p className="text-xs sm:text-sm"><strong>Description:</strong> {selectedGlobalProduct.description}</p>
              )}
            </div>
          )}

          {/* Sheen Pricing */}
          {renderSheenFields()}

          <Form.Item className='mb-0 mt-6'>
            <div className='flex flex-col sm:flex-row gap-2 sm:gap-0 w-full sm:justify-end'>
              <Button
                onClick={() => {
                  setModalVisible(false);
                  setSelectedGlobalProduct(null);
                  form.resetFields();
                }}
                block={isMobile}
                className="order-2 sm:order-1"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type='primary'
                htmlType='submit'
                disabled={!selectedGlobalProduct || submitting}
                loading={submitting}
                block={isMobile}
                className="order-1 sm:order-2 sm:ml-2"
              >
                {editingConfig ? 'Update' : 'Create'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Labor Rate Modal */}
      <Modal
        title={editingLaborRate ? `Edit ${laborRateType} Labor Rate` : `Add ${laborRateType} Labor Rate`}
        open={laborModalVisible}
        onCancel={() => {
          setLaborModalVisible(false);
          laborForm.resetFields();
        }}
        footer={null}
        width={isMobile ? '100%' : 600}
      >
        <Form form={laborForm} layout="vertical" onFinish={handleLaborRateSubmit}>
          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Please enter category name' }]}
            tooltip="e.g., Walls, Ceilings, Trim, Doors, etc."
          >
            <Input placeholder="e.g., Walls, Ceilings, Trim" size="large" />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="rate"
              label="Labor Rate"
              rules={[
                { required: true, message: 'Please enter labor rate' },
                { type: 'number', min: 0, message: 'Must be >= 0' },
              ]}
            >
              <InputNumber
                prefix="$"
                min={0}
                precision={2}
                style={{ width: '100%' }}
                placeholder="0.00"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="unit"
              label="Unit"
              rules={[{ required: true, message: 'Please select unit' }]}
            >
              <Select placeholder="Select unit" size="large">
                <Option value="sqft">per sqft</Option>
                <Option value="hour">per hour</Option>
                <Option value="day">per day</Option>
                <Option value="unit">per unit</Option>
                <Option value="lf">per linear foot</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="description"
            label="Description (Optional)"
          >
            <Input.TextArea
              rows={3}
              placeholder="Add any notes or details about this labor rate..."
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  setLaborModalVisible(false);
                  laborForm.resetFields();
                }}
                disabled={savingLaborRate}
              >
                Cancel
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={savingLaborRate}
                disabled={savingLaborRate}
              >
                {editingLaborRate ? 'Update' : 'Add'} Labor Rate
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ContractorProductConfigManager;
