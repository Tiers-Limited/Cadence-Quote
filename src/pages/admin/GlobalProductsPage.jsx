import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag, Popconfirm, Tabs, Upload } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { Option } = Select;
const { TextArea } = Input;

const GlobalProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [brandModalVisible, setBrandModalVisible] = useState(false);
  const [bulkUploadModalVisible, setBulkUploadModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingBrand, setEditingBrand] = useState(null);
  const [showCustomBrand, setShowCustomBrand] = useState(false);
  const [activeTab, setActiveTab] = useState('products');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null);
  const [form] = Form.useForm();
  const [brandForm] = Form.useForm();

  useEffect(() => {
    fetchBrands();
    fetchProducts();
  }, []);

  const fetchBrands = async () => {
    try {
      const response = await apiService.getAdminBrands();
      setBrands(response.data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
      message.error('Failed to fetch brands');
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await apiService.getGlobalProducts();
      setProducts(response.data || []);
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
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.deleteGlobalProduct(id);
      message.success('Product deleted successfully');
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      message.error('Failed to delete product');
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
    }
  };

  const handleBrandDelete = async (id) => {
    try {
      await apiService.deleteAdminBrand(id);
      message.success('Brand deleted successfully');
      fetchBrands();
    } catch (error) {
      console.error('Error deleting brand:', error);
      message.error('Failed to delete brand');
    }
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
    }
    
    return false; // Prevent default upload behavior
  };
  const downloadTemplate = () => {
    const selectedBrandName = selectedBrandFilter && selectedBrandFilter !== 'all' 
      ? brands.find(b => b.id === selectedBrandFilter)?.name || 'Selected Brand'
      : 'Selected Brand';
    const template = `Product Name,Category,Tier,Sheen Options,Notes\nPremium Interior Paint,Interior,Best,"Flat, Eggshell, Satin",High quality paint\nEconomy Exterior Paint,Exterior,Good,"Satin, Semi-Gloss",""\n\nNote: All products will be added to the brand: ${selectedBrandName}`;
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
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Brand',
      key: 'brand',
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
      filters: [
        { text: 'Interior', value: 'Interior' },
        { text: 'Exterior', value: 'Exterior' },
      ],
      onFilter: (value, record) => record.category === value,
      render: (category) => (
        <Tag color={category === 'Interior' ? 'blue' : 'green'}>{category}</Tag>
      ),
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      filters: [
        { text: 'Good', value: 'Good' },
        { text: 'Better', value: 'Better' },
        { text: 'Best', value: 'Best' },
      ],
      onFilter: (value, record) => record.tier === value,
      render: (tier) => {
        const colors = { Good: 'default', Better: 'blue', Best: 'gold' };
        return tier ? <Tag color={colors[tier]}>{tier}</Tag> : '-';
      },
    },
    {
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
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
            size="small"
          />
          <Popconfirm
            title="Delete product"
            description="Are you sure you want to delete this product?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<DeleteOutlined />} danger size="small" />
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
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Products Count',
      key: 'productsCount',
      render: (_, record) => {
        const count = products.filter(p => p.brandId === record.id).length;
        return <Tag color="blue">{count}</Tag>;
      },
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => showBrandModal(record)}
            size="small"
          />
          <Popconfirm
            title="Delete brand"
            description="Are you sure? This may affect existing products."
            onConfirm={() => handleBrandDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Filter products based on selected brand
  const filteredProducts = products.filter(p => {
    // Filter by brand
    const brandMatch = !selectedBrandFilter || selectedBrandFilter === 'all'
      ? true
      : selectedBrandFilter === 'custom'
        ? p.customBrand
        : p.brandId === selectedBrandFilter;
    
    // Filter by category
    const categoryMatch = !selectedCategoryFilter
      ? true
      : p.category === selectedCategoryFilter;
    
    return brandMatch && categoryMatch;
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Global Products & Brands Management</h1>
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
                <div className="flex justify-between items-center mb-4">
                  <Space>
                    <Select
                      placeholder="Filter by Brand"
                      style={{ width: 200 }}
                      value={selectedBrandFilter}
                      onChange={setSelectedBrandFilter}
                      allowClear
                      onClear={() => setSelectedBrandFilter(null)}
                    >
                      <Option value="all">All Brands</Option>
                      {brands.map((brand) => (
                        <Option key={brand.id} value={brand.id}>
                          {brand.name}
                        </Option>
                      ))}
                      <Option value="custom">Custom Brands</Option>
                    </Select>
                    <Select
                      placeholder="Filter by Category"
                      style={{ width: 200 }}
                      value={selectedCategoryFilter}
                      onChange={setSelectedCategoryFilter}
                      allowClear
                      onClear={() => setSelectedCategoryFilter(null)}
                    >
                      <Option value="Interior">Interior</Option>
                      <Option value="Exterior">Exterior</Option>
                    </Select>
                  </Space>
                  <Space>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => showModal()}
                    >
                      Add Product
                    </Button>
                    <Button
                      icon={<UploadOutlined />}
                      onClick={showBulkUploadModal}
                    >
                      Bulk Upload
                    </Button>
                  </Space>
                </div>

                <Table
                  columns={productColumns}
                  dataSource={filteredProducts}
                  loading={loading}
                  rowKey="id"
                  scroll={{ x: 'max-content' }}
                  pagination={{ pageSize: 20 }}
                />
              </>
            ),
          },
          {
            key: 'brands',
            label: 'Brands',
            children: (
              <>
                <div className="flex justify-between items-center mb-4">
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => showBrandModal()}
                  >
                    Add Brand
                  </Button>
                </div>

                <Table
                  columns={brandColumns}
                  dataSource={brands}
                  loading={loading}
                  rowKey="id"
                  scroll={{ x: 'max-content' }}
                  pagination={{ pageSize: 20 }}
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
        width={600}
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
            <Space className="w-full justify-end">
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
                setShowCustomBrand(false);
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                {editingProduct ? 'Update' : 'Create'}
              </Button>
            </Space>
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
        width={500}
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
            <Space className="w-full justify-end">
              <Button onClick={() => {
                setBrandModalVisible(false);
                brandForm.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                {editingBrand ? 'Update' : 'Create'}
              </Button>
            </Space>
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
            Download Template
          </Button>,
          <Button key="cancel" onClick={() => {
            setBulkUploadModalVisible(false);
          }}>
            Cancel
          </Button>,
        ]}
        width={600}
      >
        <div className="mb-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
            <p className="text-sm font-semibold text-blue-800">
              Selected Brand: {brands.find(b => b.id === selectedBrandFilter)?.name || 'None'}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              All products in the CSV will be added to this brand.
            </p>
          </div>
          <p className="mb-2">Upload a CSV or Excel file with the following columns:</p>
          <ul className="list-disc list-inside text-sm text-gray-600">
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
