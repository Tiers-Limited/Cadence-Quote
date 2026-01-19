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
const { Panel } = Collapse;

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
  
  // Pagination states for global products in modal dropdown
  const [modalBrandFilter, setModalBrandFilter] = useState(null);
  const [modalCategoryFilter, setModalCategoryFilter] = useState(null);
  const [modalSearchText, setModalSearchText] = useState('');
  const [productsPagination, setProductsPagination] = useState({ page: 1, limit: 20, hasMore: true, total: 0 });
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
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
  const [pricingSchemes, setPricingSchemes] = useState([]);

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
        taxRate: laborDefaults.defaultTaxRate || 0,
        laborHourRate: laborDefaults.defaultLaborHourRate || 50,
        crewSize: laborDefaults.crewSize || 2,
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
        productionInteriorWalls: laborDefaults.productionInteriorWalls || 300,
        productionInteriorCeilings: laborDefaults.productionInteriorCeilings || 0,
        productionInteriorTrim: laborDefaults.productionInteriorTrim || 0,
        productionExteriorWalls: laborDefaults.productionExteriorWalls || 0,
        productionExteriorTrim: laborDefaults.productionExteriorTrim || 0,
        productionSoffitFascia: laborDefaults.productionSoffitFascia || 0,
        productionGutters: laborDefaults.productionGutters || 0,
        productionDoors: laborDefaults.productionDoors || 0,
        productionCabinets: laborDefaults.productionCabinets || 0,
        // Material Settings
        includeMaterials: laborDefaults.includeMaterials !== undefined ? laborDefaults.includeMaterials : true,
        coverage: laborDefaults.coverage || 350,
        applicationMethod: laborDefaults.applicationMethod || 'roll',
        coats: laborDefaults.coats || 2,
        // Flat Rate Unit Prices
        flatRateUnitPrices: {
          door: laborDefaults.flatRateUnitPrices?.door || 85,
          window: laborDefaults.flatRateUnitPrices?.window || 75,
          room_small: laborDefaults.flatRateUnitPrices?.room_small || 350,
          room_medium: laborDefaults.flatRateUnitPrices?.room_medium || 450,
          room_large: laborDefaults.flatRateUnitPrices?.room_large || 600,
          cabinet: laborDefaults.flatRateUnitPrices?.cabinet || 125,
          walls: laborDefaults.flatRateUnitPrices?.walls || 2.5,
          ceilings: laborDefaults.flatRateUnitPrices?.ceilings || 2.0,
          interior_trim: laborDefaults.flatRateUnitPrices?.interior_trim || 1.5,
          siding: laborDefaults.flatRateUnitPrices?.siding || 3.0,
          exterior_trim: laborDefaults.flatRateUnitPrices?.exterior_trim || 1.8,
          soffit_fascia: laborDefaults.flatRateUnitPrices?.soffit_fascia || 2.0,
          gutters: laborDefaults.flatRateUnitPrices?.gutters || 4.0,
          deck: laborDefaults.flatRateUnitPrices?.deck || 2.5,
        },
      });
    }
  }, [laborDefaults, markupForm]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [brandsRes, configsRes, defaultsRes, schemesRes] = await Promise.all([
        apiService.getAdminBrands(),
        apiService.getProductConfigs(),
        apiService.getProductConfigDefaults(),
        apiService.getPricingSchemes(),
      ]);

      setBrands(brandsRes.data || []);
      setConfigs(configsRes?.data || []);
      setLaborDefaults(defaultsRes.data || null);
      setPricingSchemes(schemesRes.data || []);
    } catch (error) {
      message.error('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch global products with pagination and brand filter
  const fetchGlobalProducts = async (page = 1, brandId = null, category = null, search = '', append = false) => {
    try {
      if (page === 1) {
        setLoadingMoreProducts(true);
      }
      
      const params = {
        page,
        limit: 20,
      };
      
      if (brandId) {
        params.brandId = brandId;
      }
      
      if (category) {
        params.category = category;
      }
      
      if (search && search.trim()) {
        params.search = search.trim();
      }
      
      const response = await apiService.getGlobalProducts(params);
      
      if (response.success) {
        const newProducts = response.data || [];
        const pagination = response.pagination || {};
        
        setGlobalProducts(prev => append ? [...prev, ...newProducts] : newProducts);
        setProductsPagination({
          page: pagination.page || page,
          limit: pagination.limit || 20,
          hasMore: pagination.hasMore || false,
          total: pagination.total || 0
        });
      }
    } catch (error) {
      message.error('Failed to load products: ' + error.message);
    } finally {
      setLoadingMoreProducts(false);
    }
  };

  // Load more products when scrolling
  const handleProductsScroll = (e) => {
    const { target } = e;
    const threshold = 50; // pixels from bottom
    
    if (target.scrollTop + target.offsetHeight >= target.scrollHeight - threshold) {
      if (productsPagination.hasMore && !loadingMoreProducts) {
        fetchGlobalProducts(productsPagination.page + 1, modalBrandFilter, modalCategoryFilter, modalSearchText, true);
      }
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
        
        // Create a map of laborCategoryId to rate for easier lookup
        const ratesMap = {};
        if (ratesResponse.success && Array.isArray(ratesResponse.data)) {
          ratesResponse.data.forEach((rateRecord) => {
            ratesMap[rateRecord.laborCategoryId] = parseFloat(rateRecord.rate) || 0;
          });
        }
        
        cats.forEach((cat) => {
          ratesObj[cat.id] = ratesMap[cat.id] || 0;
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

    setEditingConfig(null);
    setSelectedGlobalProduct(null);
    setModalBrandFilter(null);
    setModalCategoryFilter(null);
    setModalSearchText('');
    form.resetFields();
    
    // Don't load products initially - wait for user to select filters
    setGlobalProducts([]);
    setProductsPagination({ page: 1, limit: 20, hasMore: true, total: 0 });
    
    setModalVisible(true);
  };

  // Handler for modal filter changes
  const handleModalFilterChange = () => {
    // Fetch products with the new filters
    fetchGlobalProducts(1, modalBrandFilter, modalCategoryFilter, modalSearchText, false);
  };

  const handleEdit = (record) => {
    setEditingConfig(record);
    setSelectedGlobalProduct(record.globalProduct);
    
    // Load products for the product's brand and category
    const brandId = record.globalProduct?.brandId;
    const category = record.globalProduct?.category;
    if (brandId) {
      setModalBrandFilter(brandId);
      setModalCategoryFilter(category || null);
      setModalSearchText('');
      fetchGlobalProducts(1, brandId, category, '', false);
    }
    
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
        defaultTaxRate: values.taxRate,
        defaultLaborHourRate: values.laborHourRate,
        crewSize: values.crewSize,
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
        productionGutters: values.productionGutters,
        productionDoors: values.productionDoors,
        productionCabinets: values.productionCabinets,
        // Material Settings
        includeMaterials: values.includeMaterials,
        coverage: values.coverage,
        applicationMethod: values.applicationMethod,
        coats: values.coats,
        // Flat Rate Unit Prices
        flatRateUnitPrices: {
          door: values.flatRateUnitPrices?.door || 85,
          window: values.flatRateUnitPrices?.window || 75,
          room_small: values.flatRateUnitPrices?.room_small || 350,
          room_medium: values.flatRateUnitPrices?.room_medium || 450,
          room_large: values.flatRateUnitPrices?.room_large || 600,
          cabinet: values.flatRateUnitPrices?.cabinet || 125,
          walls: values.flatRateUnitPrices?.walls || 2.5,
          ceilings: values.flatRateUnitPrices?.ceilings || 2.0,
          interior_trim: values.flatRateUnitPrices?.interior_trim || 1.5,
          siding: values.flatRateUnitPrices?.siding || 3.0,
          exterior_trim: values.flatRateUnitPrices?.exterior_trim || 1.8,
          soffit_fascia: values.flatRateUnitPrices?.soffit_fascia || 2.0,
          gutters: values.flatRateUnitPrices?.gutters || 4.0,
          deck: values.flatRateUnitPrices?.deck || 2.5,
        },
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

  // Helper function to get pricing scheme-specific labor categories
  const getLaborCategoriesForScheme = (scheme, jobType) => {
    if (!scheme) return [];
    
    const schemeType = scheme.type;
    
    // Flat rate doesn't use rate-based labor categories
    if (schemeType === 'flat_rate_unit') {
      return [];
    }
    
    // Filter labor categories by job type
    return laborCategories.filter(cat => cat.categoryType === jobType);
  };

  // Render labor rates grouped by pricing scheme
  const renderLaborRatesByScheme = () => {
    if (pricingSchemes.length === 0) {
      return <div className="text-center py-4 text-gray-500">No pricing schemes available</div>;
    }

    return pricingSchemes.map(scheme => {
      const isRateBased = scheme.type === 'rate_based_sqft' || scheme.type === 'sqft_labor_paint';
      const isProductionBased = scheme.type === 'production_based';
      const isFlatRate = scheme.type === 'flat_rate_unit';
      const isTurnkey = scheme.type === 'turnkey';

      return (
        <Collapse 
          key={scheme.id}
          expandIconPosition="start"
          className="mb-3"
          style={{ borderLeft: scheme.isDefault ? '3px solid #1890ff' : 'none' }}
        >
          <Panel 
            header={
              <div className="flex items-center gap-2">
                <span className="font-semibold">{scheme.name}</span>
                {scheme.isDefault && <Tag color="blue">Default</Tag>}
                <Tag color={isFlatRate ? 'purple' : isRateBased ? 'green' : isProductionBased ? 'orange' : 'cyan'}>
                  {isFlatRate ? 'Flat Unit' : isRateBased ? 'Rate-Based' : isProductionBased ? 'Production' : 'Turnkey'}
                </Tag>
              </div>
            } 
            key={scheme.id}
          >
            <div className="text-sm text-gray-600 mb-4">{scheme.description}</div>

            {/* Rate-Based Labor Rates */}
            {isRateBased && (
              <div>
                <h4 className="font-medium mb-3">Rate-Based Labor Rates ($/unit)</h4>
                {laborLoading ? (
                  <div className="text-center py-4">Loading labor rates...</div>
                ) : (
                  <>
                    <div className="mb-4">
                      <div className="font-medium mb-2">Interior Categories</div>
                      <Table
                        columns={laborColumns}
                        dataSource={getLaborCategoriesForScheme(scheme, 'interior')}
                        rowKey="id"
                        pagination={false}
                        size="small"
                      />
                    </div>
                    <div>
                      <div className="font-medium mb-2">Exterior Categories</div>
                      <Table
                        columns={laborColumns}
                        dataSource={getLaborCategoriesForScheme(scheme, 'exterior')}
                        rowKey="id"
                        pagination={false}
                        size="small"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Production-Based Rates */}
            {isProductionBased && (
              <div>
                
                 <div className="mb-6">
                    <h4 className="font-medium mb-3">Production-Based Pricing Settings</h4>
                    <Form.Item name="laborHourRate" label="Hourly Labor Rate" rules={[{ required: true }]} tooltip="Standard labor rate per hour per painter"> 
                      <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/hr" style={{ width: 200 }} />
                    </Form.Item>
                    <Form.Item name="crewSize" label="Default Crew Size" rules={[{ required: true }]} tooltip="Default number of painters in a crew"> 
                      <InputNumber min={1} max={10} precision={0} addonAfter="painters" style={{ width: 200 }} />
                    </Form.Item>
                  </div>
                <div className="mb-4">
                  <div className="font-medium mb-2">Interior</div>
                  <Form.Item name="productionInteriorWalls" label="Walls" tooltip="Square feet per hour"> 
                    <InputNumber min={0} precision={2} addonAfter="sq ft / hour" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name="productionInteriorCeilings" label="Ceilings" tooltip="Square feet per hour"> 
                    <InputNumber min={0} precision={2} addonAfter="sq ft / hour" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name="productionInteriorTrim" label="Trim" tooltip="Linear feet per hour"> 
                    <InputNumber min={0} precision={2} addonAfter="linear ft / hour" style={{ width: 200 }} />
                  </Form.Item>
                </div>
                <div>
                  <div className="font-medium mb-2">Exterior</div>
                  <Form.Item name="productionExteriorWalls" label="Siding" tooltip="Square feet per hour"> 
                    <InputNumber min={0} precision={2} addonAfter="sq ft / hour" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name="productionExteriorTrim" label="Trim" tooltip="Linear feet per hour"> 
                    <InputNumber min={0} precision={2} addonAfter="linear ft / hour" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name="productionSoffitFascia" label="Soffit & Fascia" tooltip="Linear feet per hour"> 
                    <InputNumber min={0} precision={2} addonAfter="linear ft / hour" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name="productionGutters" label="Gutters" tooltip="Linear feet per hour"> 
                    <InputNumber min={0} precision={2} addonAfter="linear ft / hour" style={{ width: 200 }} />
                  </Form.Item>
                </div>
              </div>
            )}

            {/* Flat Rate Unit Pricing */}
            {isFlatRate && (
              <div>
                <Alert
                  message="Fixed prices per unit - materials included"
                  type="info"
                  showIcon
                  className="mb-4"
                />
                <div className="mb-4">
                  <div className="font-medium mb-2">Interior Units</div>
                  <Form.Item name={['flatRateUnitPrices', 'walls']} label="Walls" tooltip="Price per unit for walls"> 
                    <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ unit" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name={['flatRateUnitPrices', 'ceilings']} label="Ceilings" tooltip="Price per unit for ceilings"> 
                    <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ unit" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name={['flatRateUnitPrices', 'door']} label="Doors" tooltip="Fixed price per door"> 
                    <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ unit" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name={['flatRateUnitPrices', 'window']} label="Windows" tooltip="Fixed price per window"> 
                    <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ unit" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name={['flatRateUnitPrices', 'cabinet']} label="Cabinets" tooltip="Fixed price per cabinet unit"> 
                    <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ unit" style={{ width: 200 }} />
                  </Form.Item>
                </div>
                <div>
                  <div className="font-medium mb-2">Exterior Units</div>
                  <Form.Item name={['flatRateUnitPrices', 'siding']} label="Siding" tooltip="Price per unit for siding"> 
                    <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ unit" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name={['flatRateUnitPrices', 'exterior_trim']} label="Trim" tooltip="Price per unit for exterior trim"> 
                    <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ unit" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name={['flatRateUnitPrices', 'deck']} label="Decks" tooltip="Price per unit for decks"> 
                    <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ unit" style={{ width: 200 }} />
                  </Form.Item>
                </div>
              </div>
            )}

            {/* Turnkey Rates */}
            {isTurnkey && (
              <div>
                <h4 className="font-medium mb-3">Turnkey Rates ($/sq ft all-inclusive)</h4>
                <Form.Item name="turnkeyInteriorRate" label="Interior Rate" tooltip="All-in price per sq ft"> 
                  <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ sq ft" style={{ width: 200 }} />
                </Form.Item>
                <Form.Item name="turnkeyExteriorRate" label="Exterior Rate" tooltip="All-in price per sq ft"> 
                  <InputNumber min={0} precision={2} addonBefore="$" addonAfter="/ sq ft" style={{ width: 200 }} />
                </Form.Item>
              </div>
            )}
          </Panel>
        </Collapse>
      );
    });
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
        {/* Labor and Pricing Tab - Grouped by Pricing Scheme */}
        <TabPane tab="Labor and Pricing" key="labor">
          <Card>
           
            <Form form={markupForm} layout={isMobile ? 'vertical' : 'horizontal'} labelCol={{ span: 12 }} wrapperCol={{ span: 12 }}>
              
              {/* Global Settings (applied to all schemes) */}
              <Collapse 
                defaultActiveKeys={['global-settings']}
                expandIconPosition="start"
                className="mb-4"
              >
                <Panel header={<span className="font-semibold text-base">📋 Global Settings</span>} key="global-settings">
                  <Alert
                    message="These settings apply to all pricing schemes"
                    type="warning"
                    showIcon
                    className="mb-4"
                  />
                  
               
                 

                  {/* Material Settings */}
                  <div className="mb-6">
                    <h4 className="font-medium mb-3">Material Settings</h4>
                    <Form.Item name="includeMaterials" label="Include Materials" valuePropName="checked" tooltip="Default setting for including materials">
                      <Switch checkedChildren="Included" unCheckedChildren="Excluded" />
                    </Form.Item>
                    <Form.Item name="coverage" label="Paint Coverage" rules={[{ required: true }]} tooltip="Default square feet covered per gallon"> 
                      <InputNumber min={250} max={450} precision={0} addonAfter="sq ft/gal" style={{ width: 200 }} />
                    </Form.Item>
                    <Form.Item name="applicationMethod" label="Application Method" rules={[{ required: true }]} tooltip="Default paint application method">
                      <Select style={{ width: 200 }}>
                        <Option value="roll">Roll (350 sq ft/gal)</Option>
                        <Option value="spray">Spray (300 sq ft/gal)</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item name="coats" label="Number of Coats" rules={[{ required: true }]} tooltip="Default number of paint coats"> 
                      <InputNumber min={1} max={4} precision={0} addonAfter="coats" style={{ width: 200 }} />
                    </Form.Item>
                  </div>
                </Panel>
              </Collapse>

              {/* Labor Rates Grouped by Pricing Scheme */}
              <div className="mb-4">
               
                {renderLaborRatesByScheme()}
              </div>

              {/* Action Button */}
              <Form.Item wrapperCol={{ span: 24 }} className="mt-4">
                <div className="flex flex-col sm:flex-row gap-2 items-center justify-end">
                  {laborHasChanges && (
                    <span className="text-sm text-orange-600">⚠️ Unsaved labor rate changes</span>
                  )}
                  <Button 
                    type="primary" 
                    onClick={() => {
                      handleSaveMarkupAndTax();
                      if (laborHasChanges) saveLaborRates();
                    }} 
                    loading={savingSettings || laborSaving} 
                    block={isMobile}
                  >
                    Save All Labor & Pricing Settings
                  </Button>
                </div>
              </Form.Item>
            </Form>
          </Card>
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

        {/* Markup Rules Tab - Simplified */}
        <TabPane tab="Markup Rules" key="markup">
          <Card>
            <Form form={markupForm} layout={isMobile ? 'vertical' : 'horizontal'} labelCol={{ span: 12 }} wrapperCol={{ span: 12 }}>
              
              {/* Markup Percentages */}
              <Collapse 
                defaultActiveKeys={['markup-percentages']}
                expandIconPosition="start"
                className="mb-4"
              >
                <Panel header={<span className="font-semibold text-base">Markup Percentages</span>} key="markup-percentages">
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
                </Panel>
                
              </Collapse>

              {/* Tax & Quote Settings */}
              <Collapse 
                defaultActiveKeys={['tax-settings']}
                expandIconPosition="start"
                className="mb-4"
              >
                <Panel header={<span className="font-semibold text-base">Tax & Quote Settings</span>} key="tax-settings">
                  <Form.Item name="taxRate" label="Tax Rate" rules={[{ required: true }]}> 
                    <InputNumber min={0} max={100} precision={2} addonAfter="%" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name="depositPercentage" label="Deposit Required" rules={[{ required: true }]}> 
                    <InputNumber min={0} max={100} precision={2} addonAfter="%" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item name="quoteValidityDays" label="Quote Validity" rules={[{ required: true }]}> 
                    <InputNumber min={1} max={365} precision={0} addonAfter="days" style={{ width: 200 }} />
                  </Form.Item>
                </Panel>
              </Collapse>

              {/* Action Buttons */}
              <Form.Item wrapperCol={{ span: 24 }}>
                <Space>
                  <Button onClick={() => markupForm.resetFields()}>Reset</Button>
                  <Button type="primary" onClick={handleSaveMarkupAndTax} loading={savingSettings}>Save Markup Settings</Button>
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
          setModalBrandFilter(null);
          setModalCategoryFilter(null);
          setModalSearchText('');
          setGlobalProducts([]);
          setProductsPagination({ page: 1, limit: 20, hasMore: true, total: 0 });
          form.resetFields();
        }}
        footer={null}
        width={isMobile ? '100%' : 800}
        style={isMobile ? { top: 0, maxWidth: '100%', paddingBottom: 0 } : {}}
        bodyStyle={isMobile ? { maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' } : {}}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {/* Filter Controls in Modal */}
          {!editingConfig && (
            <Card size="small" className="mb-4" style={{ backgroundColor: '#f5f5f5' }}>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Brand</label>
                  <Select
                    placeholder="Select brand (optional)"
                    className="w-full"
                    value={modalBrandFilter}
                    onChange={(value) => {
                      setModalBrandFilter(value);
                      // Auto-fetch when brand changes
                      setTimeout(() => fetchGlobalProducts(1, value, modalCategoryFilter, modalSearchText, false), 100);
                    }}
                    allowClear
                    onClear={() => {
                      setModalBrandFilter(null);
                      fetchGlobalProducts(1, null, modalCategoryFilter, modalSearchText, false);
                    }}
                  >
                    {brands.map((brand) => (
                      <Option key={brand.id} value={brand.id}>
                        {brand.name}
                      </Option>
                    ))}
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Category (optional)</label>
                  <Select
                    placeholder="Select category (optional)"
                    className="w-full"
                    value={modalCategoryFilter}
                    onChange={(value) => {
                      setModalCategoryFilter(value);
                      // Auto-fetch when category changes
                      setTimeout(() => fetchGlobalProducts(1, modalBrandFilter, value, modalSearchText, false), 100);
                    }}
                    allowClear
                    onClear={() => {
                      setModalCategoryFilter(null);
                      fetchGlobalProducts(1, modalBrandFilter, null, modalSearchText, false);
                    }}
                  >
                    <Option value="Interior">Interior</Option>
                    <Option value="Exterior">Exterior</Option>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Search Product Name</label>
                  <Input
                    placeholder="Search products by name..."
                    prefix={<SearchOutlined />}
                    value={modalSearchText}
                    onChange={(e) => setModalSearchText(e.target.value)}
                    onPressEnter={handleModalFilterChange}
                    allowClear
                    onClear={() => {
                      setModalSearchText('');
                      fetchGlobalProducts(1, modalBrandFilter, modalCategoryFilter, '', false);
                    }}
                  />
                </div>
                
                <Button 
                  type="primary" 
                  icon={<SearchOutlined />}
                  onClick={handleModalFilterChange}
                  block
                  size="small"
                >
                  Search Products
                </Button>
              </div>
            </Card>
          )}
          
          {/* Global Product Selection */}
          <Form.Item
            name="globalProductId"
            label="Select Product"
            rules={[{ required: true, message: 'Please select a product' }]}
            extra={loadingMoreProducts ? 'Loading more products...' : (productsPagination.hasMore ? `Scroll down to load more (${globalProducts.length}/${productsPagination.total})` : globalProducts.length > 0 ? `Showing all ${globalProducts.length} products` : 'Use filters above to load products')}
          >
            <Select
              placeholder="Select a product from global catalog"
              onChange={handleGlobalProductChange}
              showSearch
              optionFilterProp="children"
              disabled={!!editingConfig}
              loading={loadingMoreProducts && globalProducts.length === 0}
              onPopupScroll={handleProductsScroll}
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {globalProducts.map((product) => (
                <Option key={product.id} value={product.id}>
                  {product.brand?.name || product.customBrand} - {product.name} ({product.category})
                </Option>
              ))}
              {loadingMoreProducts && globalProducts.length > 0 && (
                <Option disabled key="loading" value="loading">
                  <div style={{ textAlign: 'center', padding: '8px' }}>Loading more...</div>
                </Option>
              )}
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
                  setModalBrandFilter(null);
                  setModalCategoryFilter(null);
                  setModalSearchText('');
                  setGlobalProducts([]);
                  setProductsPagination({ page: 1, limit: 20, hasMore: true, total: 0 });
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
