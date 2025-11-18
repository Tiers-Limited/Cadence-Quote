import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag, Popconfirm, Tabs, Upload } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { Option } = Select;
const { TextArea } = Input;

const GlobalProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [brandSubmitting, setBrandSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [brandDeleting, setBrandDeleting] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [brandModalVisible, setBrandModalVisible] = useState(false);
  const [bulkUploadModalVisible, setBulkUploadModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingBrand, setEditingBrand] = useState(null);
  const [showCustomBrand, setShowCustomBrand] = useState(false);
  const [activeTab, setActiveTab] = useState('products');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [brandSearchText, setBrandSearchText] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [brandPagination, setBrandPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [form] = Form.useForm();
  const [brandForm] = Form.useForm();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchBrands();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [pagination.current, selectedBrandFilter, selectedCategoryFilter, searchText]);

  useEffect(() => {
    fetchBrands();
  }, [brandPagination.current, brandSearchText]);

  // Debounced search for products
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.current === 1) {
        fetchProducts();
      } else {
        setPagination(prev => ({ ...prev, current: 1 }));
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchText]);

  // Debounced search for brands
  useEffect(() => {
    const timer = setTimeout(() => {
      if (brandPagination.current === 1) {
        fetchBrands();
      } else {
        setBrandPagination(prev => ({ ...prev, current: 1 }));
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [brandSearchText]);

  const fetchBrands = async () => {
    try {
      setBrandsLoading(true);
      const params = {
        includeProducts: 'false', // Don't load products for performance
        sortBy: 'name',
        sortOrder: 'ASC',
      };

      // Only add search if there's text (for dropdown loading)
      if (brandSearchText) {
        params.search = brandSearchText;
      }

      // Add pagination only when viewing brands tab
      if (activeTab === 'brands') {
        params.page = brandPagination.current;
        params.limit = brandPagination.pageSize;
      }

      const response = await apiService.getAdminBrands(params);
      
      if (response.pagination) {
        setBrands(response.data || []);
        setBrandPagination(prev => ({
          ...prev,
          total: response.pagination.total,
        }));
      } else {
        // No pagination - all brands returned (for dropdown)
        setBrands(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
      message.error('Failed to fetch brands');
    } finally {
      setBrandsLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      };

      if (selectedBrandFilter && selectedBrandFilter !== 'all') {
        params.brandId = selectedBrandFilter;
      }

      if (selectedCategoryFilter) {
        params.category = selectedCategoryFilter;
      }

      if (searchText) {
        params.search = searchText;
      }

      const response = await apiService.getGlobalProducts(params);
      setProducts(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0,
      }));
    } catch (error) {
      console.error('Error fetching products:', error);
      message.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  // Product handlers
  const showModal = (product = null) => {
    // Check if brands exist
    if (!product && brands.length === 0) {
      message.warning('Please add at least one brand before creating products');
      setActiveTab('brands');
      return;
    }

    // Check if a brand is selected for filtering
    if (!product && !selectedBrandFilter) {
      message.warning('Please select a brand from the filter dropdown before adding a product');
      return;
    }

    setEditingProduct(product);
    if (product) {
      form.setFieldsValue({
        brandId: product.brandId || 'other',
        customBrand: product.customBrand || '',
        name: product.name,
        category: product.category,
        tier: product.tier,
        sheenOptions: product.sheenOptions ? product.sheenOptions.split(',').map(s => s.trim()) : [],
        notes: product.notes || '',
      });
      setShowCustomBrand(product.brandId === null || product.brandId === 'other');
    } else {
      form.resetFields();
      // Pre-select the filtered brand
      if (selectedBrandFilter && selectedBrandFilter !== 'all') {
        form.setFieldsValue({ brandId: selectedBrandFilter });
        setShowCustomBrand(false);
      } else {
        setShowCustomBrand(false);
      }
    }
    setModalVisible(true);
  };

  const handleBrandChange = (value) => {
    if (value === 'other') {
      setShowCustomBrand(true);
      form.setFieldsValue({ brandId: null });
    } else {
      setShowCustomBrand(false);
      form.setFieldsValue({ customBrand: '' });
    }
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const data = {
        brandId: showCustomBrand ? null : values.brandId,
        customBrand: showCustomBrand ? values.customBrand : null,
        name: values.name,
        category: values.category,
        tier: values.tier,
        sheenOptions: Array.isArray(values.sheenOptions) 
          ? values.sheenOptions.join(', ') 
          : values.sheenOptions || '',
        notes: values.notes || null,
      };

      if (editingProduct) {
        await apiService.updateGlobalProduct(editingProduct.id, data);
        message.success('Product updated successfully');
      } else {
        await apiService.createGlobalProduct(data);
        message.success('Product created successfully');
      }

      setModalVisible(false);
      form.resetFields();
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      message.error(error.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await apiService.deleteGlobalProduct(id);
      message.success('Product deleted successfully');
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      message.error('Failed to delete product');
    } finally {
      setDeleting(null);
    }
  };

  // Brand handlers
  const showBrandModal = (brand = null) => {
    setEditingBrand(brand);
    if (brand) {
      brandForm.setFieldsValue({
        name: brand.name,
        description: brand.description || '',
      });
    } else {
      brandForm.resetFields();
    }
    setBrandModalVisible(true);
  };

  const handleBrandSubmit = async (values) => {
    setBrandSubmitting(true);
    try {
      if (editingBrand) {
        await apiService.updateAdminBrand(editingBrand.id, values);
        message.success('Brand updated successfully');
      } else {
        await apiService.createAdminBrand(values);
        message.success('Brand created successfully');
      }

      setBrandModalVisible(false);
      brandForm.resetFields();
      fetchBrands();
    } catch (error) {
      console.error('Error saving brand:', error);
      message.error(error.message || 'Failed to save brand');
    } finally {
      setBrandSubmitting(false);
    }
  };

  const handleBrandDelete = async (id) => {
    setBrandDeleting(id);
    try {
      await apiService.deleteAdminBrand(id);
      message.success('Brand deleted successfully');
      fetchBrands();
    } catch (error) {
      console.error('Error deleting brand:', error);
      message.error('Failed to delete brand');
    } finally {
      setBrandDeleting(null);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    });
  };

  const handleBrandTableChange = (newPagination) => {
    setBrandPagination({
      ...brandPagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    });
  };

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  const handleBrandSearchChange = (e) => {
    setBrandSearchText(e.target.value);
  };

  const handleFilterChange = (filterType, value) => {
    if (filterType === 'brand') {
      setSelectedBrandFilter(value);
    } else if (filterType === 'category') {
      setSelectedCategoryFilter(value);
    }
    // Reset to page 1 when filters change
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // Bulk upload handlers
  const showBulkUploadModal = () => {
    // Check if brands exist
    if (brands.length === 0) {
      message.warning('Please add at least one brand before uploading products');
      setActiveTab('brands');
      return;
    }

    // Check if a brand is selected for filtering
    if (!selectedBrandFilter || selectedBrandFilter === 'all') {
      message.warning('Please select a specific brand from the filter dropdown before bulk uploading products');
      return;
    }

    setBulkUploadModalVisible(true);
  };

  const handleBulkUpload = async (file) => {
    console.log("Uploading file:", file);
    if (!file) return false;

    if (!selectedBrandFilter || selectedBrandFilter === 'all') {
      message.error('Please select a specific brand from the filter dropdown');
      return false;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('brandId', selectedBrandFilter);

    try {
      const response = await apiService.postFile('/admin/products/bulk-upload', formData);
      
      if (response.success) {
        message.success(response.message);
        setBulkUploadModalVisible(false);
       
        fetchProducts();
      }
    } catch (error) {
      message.error('Failed to upload products');
      console.error('Bulk upload error:', error);
    } finally {
      setUploading(false);
    }
    
    return false; // Prevent default upload behavior
  };
  const downloadTemplate = () => {
    const selectedBrandName = selectedBrandFilter && selectedBrandFilter !== 'all' 
      ? brands.find(b => b.id === selectedBrandFilter)?.name || 'Selected Brand'
      : 'Selected Brand';
    const template = `Product Name,Category,Tier,Sheen Options,Notes\nPremium Interior Paint,Interior,Best,"Flat, Eggshell, Satin",High quality paint\nEconomy Exterior Paint,Exterior,Good,"Satin, Semi-Gloss",\n\nNote: All products will be added to the brand: ${selectedBrandName}`;
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `product_template_${selectedBrandName.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const uploadProps = {
    beforeUpload: handleBulkUpload,
    showUploadList: true,
    accept: '.csv,.xlsx,.xls',
    maxCount: 1,
  };

  const productColumns = [
    {
      title: 'Product Name',
      dataIndex: 'name',
      key: 'name',
      width: isMobile ? 150 : undefined,
      ellipsis: true,
    },
    {
      title: 'Brand',
      key: 'brand',
      width: isMobile ? 100 : undefined,
      render: (_, record) => {
        if (record.customBrand) {
          return <Tag color="orange">{record.customBrand}</Tag>;
        }
        return record.brand?.name || '-';
      },
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: isMobile ? 80 : undefined,
      render: (category) => (
        <Tag color={category === 'Interior' ? 'blue' : 'green'}>{category}</Tag>
      ),
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      width: isMobile ? 70 : undefined,
      render: (tier) => {
        const colors = { Good: 'default', Better: 'blue', Best: 'gold' };
        return tier ? <Tag color={colors[tier]}>{tier}</Tag> : '-';
      },
    },
    ...(!isMobile ? [{
      title: 'Sheen Options',
      dataIndex: 'sheenOptions',
      key: 'sheenOptions',
      width: 250,
      render: (sheenOptions) => (
        <div>
          {sheenOptions
            ? sheenOptions.split(',').map((sheen, index) => (
                <Tag key={index} color='green' className='mb-1'>
                  {sheen.trim()}
                </Tag>
              ))
            : '-'}
        </div>
      ),
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    }] : []),
    {
      title: 'Actions',
      key: 'actions',
      fixed: isMobile ? undefined : 'right',
      width: isMobile ? 100 : 120,
      render: (_, record) => (
        <Space size="small" direction={isMobile ? 'vertical' : 'horizontal'}>
          <Button
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
            size="small"
            block={isMobile}
            disabled={deleting !== null || submitting}
          >
            {isMobile && 'Edit'}
          </Button>
          <Popconfirm
            title="Delete product"
            description="Are you sure you want to delete this product?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
            disabled={deleting !== null || submitting}
          >
            <Button 
              icon={<DeleteOutlined />} 
              danger 
              size="small" 
              loading={deleting === record.id}
              disabled={deleting !== null || submitting}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const brandColumns = [
    {
      title: 'Brand Name',
      dataIndex: 'name',
      key: 'name',
      width: isMobile ? 150 : undefined,
    },
    ...(!isMobile ? [{
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    }] : []),
    ...(!isMobile ? [{
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    }] : []),
    {
      title: 'Actions',
      key: 'actions',
      fixed: isMobile ? undefined : 'right',
      width: isMobile ? 100 : 120,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => showBrandModal(record)}
            size="small"
            disabled={brandDeleting !== null || brandSubmitting}
          />
          <Popconfirm
            title="Delete brand"
            description="Are you sure? This may affect existing products."
            onConfirm={() => handleBrandDelete(record.id)}
            okText="Yes"
            cancelText="No"
            disabled={brandDeleting !== null || brandSubmitting}
          >
            <Button 
              icon={<DeleteOutlined />} 
              danger 
              size="small" 
              loading={brandDeleting === record.id}
              disabled={brandDeleting !== null || brandSubmitting}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Filter products based on selected brand
  const filteredProducts = products;

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Global Products & Brands</h1>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'products',
            label: 'Products',
            children: (
              <>
                <div className="mb-4 space-y-3">
                  {/* Search Bar */}
                  <Input
                    placeholder="Search products by name or notes..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={handleSearchChange}
                    allowClear
                    className="w-full sm:w-96"
                  />

                  {/* Filters and Actions */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 justify-between items-stretch sm:items-center">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Select
                        placeholder="Filter by Brand"
                        className="w-full sm:w-[200px]"
                        value={selectedBrandFilter}
                        onChange={(value) => handleFilterChange('brand', value)}
                        allowClear
                        onClear={() => handleFilterChange('brand', null)}
                      >
                        <Option value="all">All Brands</Option>
                        {brands.map((brand) => (
                          <Option key={brand.id} value={brand.id}>
                            {brand.name}
                          </Option>
                        ))}
                        {/* <Option value="custom">Custom Brands</Option> */}
                      </Select>
                      <Select
                        placeholder="Filter by Category"
                        className="w-full sm:w-[200px]"
                        value={selectedCategoryFilter}
                        onChange={(value) => handleFilterChange('category', value)}
                        allowClear
                        onClear={() => handleFilterChange('category', null)}
                      >
                        <Option value="Interior">Interior</Option>
                        <Option value="Exterior">Exterior</Option>
                      </Select>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => showModal()}
                        block={isMobile}
                      >
                        Add Product
                      </Button>
                      <Button
                        icon={<UploadOutlined />}
                        onClick={showBulkUploadModal}
                        block={isMobile}
                      >
                        Bulk Upload
                      </Button>
                    </div>
                  </div>
                </div>

                <Table
                  columns={productColumns}
                  dataSource={filteredProducts}
                  loading={loading}
                  rowKey="id"
                  scroll={{ x: isMobile ? 700 : 'max-content' }}
                  pagination={{
                    ...pagination,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} products`,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    simple: isMobile,
                  }}
                  onChange={handleTableChange}
                />
              </>
            ),
          },
          {
            key: 'brands',
            label: 'Brands',
            children: (
              <>
                <div className="mb-4 space-y-3">
                  {/* Search Bar */}
                  <Input
                    placeholder="Search brands by name or description..."
                    prefix={<SearchOutlined />}
                    value={brandSearchText}
                    onChange={handleBrandSearchChange}
                    allowClear
                    className="w-full sm:w-96"
                  />

                  <div className="flex justify-between items-center">
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => showBrandModal()}
                      block={isMobile}
                    >
                      Add Brand
                    </Button>
                  </div>
                </div>

                <Table
                  columns={brandColumns}
                  dataSource={brands}
                  loading={brandsLoading}
                  rowKey="id"
                  scroll={{ x: isMobile ? 500 : 'max-content' }}
                  pagination={{
                    ...brandPagination,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} brands`,
                    pageSizeOptions: ['10', '20', '50'],
                    simple: isMobile,
                  }}
                  onChange={handleBrandTableChange}
                />
              </>
            ),
          },
        ]}
      />

      {/* Product Modal */}
      <Modal
        title={editingProduct ? 'Edit Global Product' : 'Add Global Product'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setShowCustomBrand(false);
        }}
        footer={null}
        width={isMobile ? '100%' : 600}
        style={isMobile ? { top: 0, maxWidth: '100%', paddingBottom: 0 } : {}}
        bodyStyle={isMobile ? { maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' } : {}}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="brandId"
            label="Brand"
            rules={[{ required: !showCustomBrand, message: 'Please select a brand' }]}
          >
            <Select
              placeholder="Select a brand"
              onChange={handleBrandChange}
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {brands.map((brand) => (
                <Option key={brand.id} value={brand.id}>
                  {brand.name}
                </Option>
              ))}
              <Option value="other">Other Brand (Custom)</Option>
            </Select>
          </Form.Item>

          {showCustomBrand && (
            <Form.Item
              name="customBrand"
              label="Custom Brand Name"
              rules={[{ required: true, message: 'Please enter custom brand name' }]}
            >
              <Input placeholder="Enter custom brand name" />
            </Form.Item>
          )}

          <Form.Item
            name="name"
            label="Product Name"
            rules={[{ required: true, message: 'Please enter product name' }]}
          >
            <Input placeholder="e.g., Premium Interior Paint" />
          </Form.Item>

          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Please select category' }]}
          >
            <Select placeholder="Select category">
              <Option value="Interior">Interior</Option>
              <Option value="Exterior">Exterior</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="tier"
            label="Tier (Optional)"
          >
            <Select placeholder="Select tier" allowClear>
              <Option value="Good">Good</Option>
              <Option value="Better">Better</Option>
              <Option value="Best">Best</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="sheenOptions"
            label="Available Sheen Options"
            rules={[{ required: true, message: 'Please select sheen options' }]}
          >
            <Select
              mode="multiple"
              placeholder="Select available sheens"
              options={[
                { label: 'Flat', value: 'Flat' },
                { label: 'Matte', value: 'Matte' },
                { label: 'Eggshell', value: 'Eggshell' },
                { label: 'Satin', value: 'Satin' },
                { label: 'Semi-Gloss', value: 'Semi-Gloss' },
                { label: 'Gloss', value: 'Gloss' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="notes"
            label="Notes"
          >
            <TextArea rows={3} placeholder="Additional notes about this product" />
          </Form.Item>

          <Form.Item className="mb-0">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 w-full sm:justify-end">
              <Button 
                onClick={() => {
                  setModalVisible(false);
                  form.resetFields();
                  setShowCustomBrand(false);
                }}
                block={isMobile}
                className="order-2 sm:order-1"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                block={isMobile}
                className="order-1 sm:order-2 sm:ml-2"
                loading={submitting}
                disabled={submitting}
              >
                {editingProduct ? 'Update' : 'Create'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Brand Modal */}
      <Modal
        title={editingBrand ? 'Edit Brand' : 'Add Brand'}
        open={brandModalVisible}
        onCancel={() => {
          setBrandModalVisible(false);
          brandForm.resetFields();
        }}
        footer={null}
        width={isMobile ? '100%' : 500}
        style={isMobile ? { top: 0, maxWidth: '100%', paddingBottom: 0 } : {}}
        bodyStyle={isMobile ? { maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' } : {}}
      >
        <Form
          form={brandForm}
          layout="vertical"
          onFinish={handleBrandSubmit}
        >
          <Form.Item
            name="name"
            label="Brand Name"
            rules={[{ required: true, message: 'Please enter brand name' }]}
          >
            <Input placeholder="e.g., Sherwin Williams" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea rows={3} placeholder="Optional description" />
          </Form.Item>

          <Form.Item className="mb-0">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 w-full sm:justify-end">
              <Button 
                onClick={() => {
                  setBrandModalVisible(false);
                  brandForm.resetFields();
                }}
                block={isMobile}
                className="order-2 sm:order-1"
                disabled={brandSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                block={isMobile}
                className="order-1 sm:order-2 sm:ml-2"
                loading={brandSubmitting}
                disabled={brandSubmitting}
              >
                {editingBrand ? 'Update' : 'Create'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal
        title="Bulk Upload Products"
        open={bulkUploadModalVisible}
        onCancel={() => {
          setBulkUploadModalVisible(false);
        }}
        footer={[
          <Button key="template" icon={<DownloadOutlined />} onClick={downloadTemplate}>
            {!isMobile && 'Download '}Template
          </Button>,
          <Button key="cancel" onClick={() => {
            setBulkUploadModalVisible(false);
          }}>
            Cancel
          </Button>,
        ]}
        width={isMobile ? '100%' : 600}
        style={isMobile ? { top: 0, maxWidth: '100%', paddingBottom: 0 } : {}}
        bodyStyle={isMobile ? { maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' } : {}}
      >
        <div className="mb-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-2 sm:p-3 mb-3">
            <p className="text-xs sm:text-sm font-semibold text-blue-800">
              Selected Brand: {brands.find(b => b.id === selectedBrandFilter)?.name || 'None'}
            </p>
            <p className="text-[10px] sm:text-xs text-blue-600 mt-1">
              All products in the CSV will be added to this brand.
            </p>
          </div>
          <p className="mb-2 text-sm sm:text-base">Upload a CSV or Excel file with the following columns:</p>
          <ul className="list-disc list-inside text-xs sm:text-sm text-gray-600">
            <li>Product Name (required)</li>
            <li>Category (required - Interior/Exterior)</li>
            <li>Tier (optional - Good/Better/Best)</li>
            <li>Sheen Options (optional - comma-separated, e.g., "Flat, Eggshell, Satin")</li>
            <li>Notes (optional)</li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">Supported formats: .csv, .xlsx, .xls</p>
        </div>

        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />}>Select File to Upload</Button>
        </Upload>
      </Modal>
    </div>
  );
};

export default GlobalProductsPage;
