import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Select, Space, message, Spin, Tag, InputNumber
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined
} from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const BrandProductManager = () => {
  const [products, setProducts] = useState([]);
  const [globalProducts, setGlobalProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedGlobalProduct, setSelectedGlobalProduct] = useState(null);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchBrands();
    fetchProducts();
    fetchGlobalProducts();
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
    setLoading(true);
    try {
      const response = await apiService.get('/products');
      if (response.success) {
        setProducts(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch products');
      console.error('Fetch products error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalProducts = async () => {
    try {
      const response = await apiService.getGlobalProducts();
      if (response.success || response.data) {
        setGlobalProducts(response.data || []);
      }
    } catch (error) {
      message.error('Failed to fetch global products');
      console.error('Fetch global products error:', error);
    }
  };

  const showModal = (product = null) => {
    // Check if brands exist
    if (!product && brands.length === 0) {
      message.warning('Please add at least one brand before creating products');
      return;
    }

    // Check if a brand is selected for filtering
    if (!product && !selectedBrandFilter) {
      message.warning('Please select a brand from the filter dropdown before adding a product');
      return;
    }

    setEditingProduct(product);
    if (product) {
      // Find the global product to get sheen options
      const globalProd = globalProducts.find(gp => gp.id === product.globalProductId);
      setSelectedGlobalProduct(globalProd);
      
      const sheenOpts = globalProd?.sheenOptions ? globalProd.sheenOptions.split(',').map(s => s.trim()) : [];
      
      // Build sheen pricing object
      const sheenPricing = {};
      sheenOpts.forEach(sheen => {
        const sheenKey = sheen.toLowerCase().replace(/[^a-z]/g, '');
        sheenPricing[`${sheenKey}_price`] = product[`${sheenKey}_price`] || 0;
        sheenPricing[`${sheenKey}_coverage`] = product[`${sheenKey}_coverage`] || 400;
      });
      
      form.setFieldsValue({
        globalProductId: product.globalProductId,
        isActive: product.isActive ?? true,
        ...sheenPricing
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        isActive: true,
      });
      setSelectedGlobalProduct(null);
    }
    setModalVisible(true);
  };

  const handleGlobalProductChange = (globalProductId) => {
    const globalProd = globalProducts.find(gp => gp.id === globalProductId);
    setSelectedGlobalProduct(globalProd);
    
    // Filter global products by selected brand
    if (selectedBrandFilter && globalProd && globalProd.brandId !== selectedBrandFilter) {
      message.warning('This product belongs to a different brand. Please select a product from the filtered brand.');
      return;
    }
    
    // Reset sheen pricing fields when product changes
    const sheenOpts = globalProd?.sheenOptions ? globalProd.sheenOptions.split(',').map(s => s.trim()) : [];
    const resetFields = {};
    sheenOpts.forEach(sheen => {
      const sheenKey = sheen.toLowerCase().replace(/[^a-z]/g, '');
      resetFields[`${sheenKey}_price`] = undefined;
      resetFields[`${sheenKey}_coverage`] = undefined;
    });
    form.setFieldsValue(resetFields);
  };

  const handleSubmit = async (values) => {
    try {
      if (!selectedGlobalProduct) {
        message.error('Please select a product');
        return;
      }

      // Build sheen pricing data
      const sheenOpts = selectedGlobalProduct.sheenOptions.split(',').map(s => s.trim());
      const sheenPricing = {};
      
      sheenOpts.forEach(sheen => {
        const sheenKey = sheen.toLowerCase().replace(/[^a-z]/g, '');
        sheenPricing[`${sheenKey}_price`] = Number(values[`${sheenKey}_price`] || 0);
        sheenPricing[`${sheenKey}_coverage`] = Number(values[`${sheenKey}_coverage`] || 400);
      });

      const payload = {
        globalProductId: values.globalProductId,
        brandId: selectedGlobalProduct.brandId,
        customBrand: selectedGlobalProduct.customBrand,
        line: selectedGlobalProduct.line || '',
        name: selectedGlobalProduct.name,
        category: selectedGlobalProduct.category,
        tier: selectedGlobalProduct.tier,
        sheenOptions: selectedGlobalProduct.sheenOptions,
        sheen: sheenOpts[0].toLowerCase(), // Default to first sheen
        isActive: values.isActive ?? true,
        ...sheenPricing
      };

      if (editingProduct) {
        await apiService.put(`/products/${editingProduct.id}`, payload);
        message.success('Product updated successfully');
      } else {
        await apiService.post('/products', payload);
        message.success('Product added successfully');
      }
      
      setModalVisible(false);
      setSelectedGlobalProduct(null);
      form.resetFields();
      fetchProducts();
    } catch (error) {
      message.error('Failed to save product');
      console.error('Save product error:', error);
    }
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: 'Delete Product',
      content: 'Are you sure you want to delete this product?',
      onOk: async () => {
        try {
          await apiService.delete(`/products/${id}`);
          message.success('Product deleted successfully');
          fetchProducts();
        } catch (error) {
          message.error('Failed to delete product');
          console.error('Delete product error:', error);
        }
      }
    });
  };

  const productColumns = [
    {
      title: 'Brand',
      key: 'brand',
      width: 150,
      render: (_, record) => {
        const globalProd = globalProducts.find(gp => gp.id === record.globalProductId);
        if (globalProd) {
          return globalProd.brand?.name || globalProd.customBrand || 'N/A';
        }
        return record.brand || 'N/A';
      },
    },
    {
      title: 'Product Name',
      dataIndex: 'name',
      key: 'name',
      width: 250,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category) => (
        <Tag color={category === 'Interior' ? 'blue' : 'green'}>
          {category}
        </Tag>
      ),
    },
    {
      title: 'Sheen Pricing',
      dataIndex: 'sheenOptions',
      key: 'sheenPricing',
      width: 300,
      render: (sheenOptions, record) => {
        if (!sheenOptions) return '-';
        
        const sheens = sheenOptions.split(',').map(s => s.trim());
        return (
          <div>
            {sheens.map((sheen) => {
              const sheenKey = sheen.toLowerCase().replace(/[^a-z]/g, '');
              const price = record[`${sheenKey}_price`];
              const coverage = record[`${sheenKey}_coverage`];
              
              return (
                <div key={sheen} className='mb-1'>
                  <Tag color='green'>{sheen}</Tag>
                  {price !== undefined && (
                    <span className='text-xs'>
                      ${Number(price).toFixed(2)}/gal • {coverage} sq ft/gal
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          >
            Edit
          </Button>
          <Button
            size="small"
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  // Filter products based on selected brand and category
  const filteredProducts = products.filter(p => {
    const globalProd = globalProducts.find(gp => gp.id === p.globalProductId);
    
    // Filter by brand
    const brandMatch = !selectedBrandFilter
      ? true
      : globalProd?.brandId === selectedBrandFilter || p.brandId === selectedBrandFilter;
    
    // Filter by category
    const categoryMatch = !selectedCategoryFilter
      ? true
      : p.category === selectedCategoryFilter || globalProd?.category === selectedCategoryFilter;
    
    return brandMatch && categoryMatch;
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

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h2 className="text-2xl font-semibold">Product Catalog</h2>
        <Space>
          <Select
            placeholder="Filter by Brand"
            style={{ width: 200 }}
            value={selectedBrandFilter}
            onChange={setSelectedBrandFilter}
            allowClear
            onClear={() => setSelectedBrandFilter(null)}
          >
            {brands.map((brand) => (
              <Select.Option key={brand.id} value={brand.id}>
                {brand.name}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="Filter by Category"
            style={{ width: 200 }}
            value={selectedCategoryFilter}
            onChange={setSelectedCategoryFilter}
            allowClear
            onClear={() => setSelectedCategoryFilter(null)}
          >
            <Select.Option value="Interior">Interior</Select.Option>
            <Select.Option value="Exterior">Exterior</Select.Option>
          </Select>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => showModal()}
          >
            Add Product
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        <Table
          columns={productColumns}
          dataSource={filteredProducts}
          rowKey="id"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20 }}
        />
      </Spin>

      {/* Add/Edit Product Modal */}
      <Modal
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedGlobalProduct(null);
          form.resetFields();
        }}
        footer={null}
        width={700}
      >
        <Form form={form} layout='vertical' onFinish={handleSubmit}>
          <Form.Item
            name='globalProductId'
            label='Select Product'
            rules={[{ required: true, message: 'Please select a product' }]}
          >
            <Select
              placeholder='Select a product from global catalog'
              showSearch
              onChange={handleGlobalProductChange}
              disabled={editingProduct !== null}
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {filteredGlobalProducts.map(gp => (
                <Select.Option key={gp.id} value={gp.id}>
                  {gp.brand?.name || gp.customBrand || 'Unknown Brand'} - {gp.name} ({gp.category})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {selectedGlobalProduct && (
            <>
              <div className="mb-4 p-4 bg-blue-50 rounded">
                <h4 className="font-semibold mb-2">Product Details:</h4>
                <p><strong>Brand:</strong> {selectedGlobalProduct.brand?.name || selectedGlobalProduct.customBrand}</p>
                <p><strong>Category:</strong> {selectedGlobalProduct.category}</p>
                <p><strong>Tier:</strong> {selectedGlobalProduct.tier || 'N/A'}</p>
                <p><strong>Available Sheens:</strong> {selectedGlobalProduct.sheenOptions}</p>
              </div>

              <h4 className="font-semibold mb-3">Pricing & Coverage by Sheen:</h4>
              
              {selectedGlobalProduct.sheenOptions.split(',').map((sheen) => {
                const sheenTrim = sheen.trim();
                const sheenKey = sheenTrim.toLowerCase().replace(/[^a-z]/g, '');
                
                return (
                  <div key={sheenKey} className="mb-4 p-3 border rounded">
                    <h5 className="font-medium mb-2">{sheenTrim}</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <Form.Item
                        name={`${sheenKey}_price`}
                        label='Price per Gallon'
                        rules={[{ required: true, message: `Please enter price for ${sheenTrim}` }]}
                      >
                        <InputNumber
                          prefix='$'
                          min={0}
                          precision={2}
                          style={{ width: '100%' }}
                          placeholder={`Price for ${sheenTrim}`}
                        />
                      </Form.Item>

                      <Form.Item
                        name={`${sheenKey}_coverage`}
                        label='Coverage (sq ft/gallon)'
                        rules={[{ required: true, message: `Please enter coverage for ${sheenTrim}` }]}
                      >
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          placeholder={`Coverage for ${sheenTrim}`}
                        />
                      </Form.Item>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          <Form.Item className='mb-0'>
            <Space className='w-full justify-end'>
              <Button onClick={() => {
                setModalVisible(false);
                setSelectedGlobalProduct(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
              <Button type='primary' htmlType='submit' disabled={!selectedGlobalProduct}>
                {editingProduct ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BrandProductManager;
