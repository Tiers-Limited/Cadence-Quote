import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Space,
  Card, message, Upload, Spin, Tag, Tabs
} from 'antd';
import {
  PlusOutlined, UploadOutlined, DeleteOutlined,
  EditOutlined, DollarOutlined, EyeOutlined
} from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { TabPane } = Tabs;

const BrandProductManager = () => {
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [loading, setLoading] = useState(false);
  const [brandModalVisible, setBrandModalVisible] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form] = Form.useForm();
  const [priceForm] = Form.useForm();

  const sheenOptions = ['Flat', 'Matte', 'Eggshell', 'Satin', 'Semi-Gloss', 'Gloss'];

  useEffect(() => {
    fetchBrands();
  }, []);

  useEffect(() => {
    if (selectedBrand) {
      fetchProducts(selectedBrand);
    }
  }, [selectedBrand]);

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/brands');
      if (response.success) {
        setBrands(response.data);
        if (response.data.length > 0 && !selectedBrand) {
          setSelectedBrand(response.data[0].id);
        }
      }
    } catch (error) {
      message.error('Failed to fetch brands');
      console.error('Fetch brands error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (brandId) => {
    setLoading(true);
    try {
      const response = await apiService.get(`/products/by-brand?brandId=${brandId}`);
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

  const seedBrands = async () => {
    setLoading(true);
    try {
      const response = await apiService.post('/brands/seed');
      if (response.success) {
        message.success(response.message);
        fetchBrands();
      }
    } catch (error) {
      message.error('Failed to seed brands');
      console.error('Seed brands error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBrand = async (values) => {
    try {
      const response = await apiService.post('/brands', values);
      if (response.success) {
        message.success('Brand created successfully');
        setBrandModalVisible(false);
        form.resetFields();
        fetchBrands();
      }
    } catch (error) {
      message.error('Failed to create brand');
      console.error('Create brand error:', error);
    }
  };

  const handleDeleteBrand = async (id) => {
    Modal.confirm({
      title: 'Delete Brand',
      content: 'Are you sure you want to delete this brand?',
      onOk: async () => {
        try {
          const response = await apiService.delete(`/brands/${id}`);
          if (response.success) {
            message.success('Brand deleted successfully');
            fetchBrands();
            if (selectedBrand === id) {
              setSelectedBrand(null);
              setProducts([]);
            }
          }
        } catch (error) {
          message.error('Failed to delete brand');
          console.error('Delete brand error:', error);
        }
      }
    });
  };

  const handleCreateProduct = async (values) => {
    try {
      const { name, sheenOptions: sheens, description } = values;
      const response = await apiService.post('/products/with-prices', {
        brandId: selectedBrand,
        name,
        sheenOptions: sheens ? sheens.join(', ') : '',
        description
      });
      if (response.success) {
        message.success('Product created successfully');
        setProductModalVisible(false);
        form.resetFields();
        fetchProducts(selectedBrand);
      }
    } catch (error) {
      message.error('Failed to create product');
      console.error('Create product error:', error);
    }
  };

  const handleUpdatePrices = async (values) => {
    try {
      const prices = [];
      
      // Auto-calculate prices based on Flat price
      const flatPrice = parseFloat(values.flat);
      if (flatPrice && !isNaN(flatPrice)) {
        prices.push({ sheen: 'Flat', price: flatPrice });
        prices.push({ sheen: 'Matte', price: flatPrice }); // Same as Flat
        prices.push({ sheen: 'Satin', price: flatPrice + 2 }); // +$2
        prices.push({ sheen: 'Semi-Gloss', price: flatPrice + 4 }); // +$4
        
        // If Eggshell or Gloss are provided, use those values
        if (values.eggshell) {
          prices.push({ sheen: 'Eggshell', price: parseFloat(values.eggshell) });
        }
        if (values.gloss) {
          prices.push({ sheen: 'Gloss', price: parseFloat(values.gloss) });
        }
      }

      const response = await apiService.put(`/products/${selectedProduct.id}/prices`, {
        prices
      });
      
      if (response.success) {
        message.success('Prices updated successfully');
        setPriceModalVisible(false);
        priceForm.resetFields();
        setSelectedProduct(null);
        fetchProducts(selectedBrand);
      }
    } catch (error) {
      message.error('Failed to update prices');
      console.error('Update prices error:', error);
    }
  };

  const handleBulkUpload = async ( file ) => {
    console.log("Uploading file:", file);   
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('brandId', selectedBrand);

    try {
      const response = await apiService.postFile('/products/bulk-upload', formData);
      
      if (response.success) {
        message.success(response.message);
        setUploadModalVisible(false);
        fetchProducts(selectedBrand);
      }
    } catch (error) {
      message.error('Failed to upload products');
      console.error('Bulk upload error:', error);
    }
    
    return false; // Prevent default upload behavior
  };

  const handleDeleteProduct = async (id) => {
    Modal.confirm({
      title: 'Delete Product',
      content: 'Are you sure you want to delete this product?',
      onOk: async () => {
        try {
          const response = await apiService.delete(`/products/${id}`);
          if (response.success) {
            message.success('Product deleted successfully');
            fetchProducts(selectedBrand);
          }
        } catch (error) {
          message.error('Failed to delete product');
          console.error('Delete product error:', error);
        }
      }
    });
  };

  const showPriceModal = (product) => {
    setSelectedProduct(product);
    
    // Pre-fill existing prices
    const priceValues = {};
    if (product.prices && product.prices.length > 0) {
      product.prices.forEach(p => {
        priceValues[p.sheen.toLowerCase().replace('-', '')] = p.price;
      });
    }
    
    priceForm.setFieldsValue(priceValues);
    setPriceModalVisible(true);
  };

  const showDetailModal = async (product) => {
    setLoading(true);
    try {
      const response = await apiService.get(`/products/${product.id}/with-prices`);
      if (response.success) {
        setSelectedProduct(response.data);
        setDetailModalVisible(true);
      }
    } catch (error) {
      message.error('Failed to fetch product details');
      console.error('Fetch product details error:', error);
    } finally {
      setLoading(false);
    }
  };

  const brandColumns = [
    {
      title: 'Brand Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Products',
      key: 'products',
      width: 100,
      render: (_, record) => (
        <Tag color="blue">{record.products?.length || 0}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDeleteBrand(record.id)}
          />
        </Space>
      ),
    },
  ];

  const productColumns = [
    {
      title: 'Product Name',
      dataIndex: 'name',
      key: 'name',
      width: 250,
    },
    {
      title: 'Sheen Options',
      dataIndex: 'sheenOptions',
      key: 'sheenOptions',
      width: 250,
      render: (sheenOptions) => (
        <div>
          {sheenOptions ? sheenOptions.split(',').map((sheen, index) => (
            <Tag key={index} color="green" className="mb-1">
              {sheen.trim()}
            </Tag>
          )) : '-'}
        </div>
      ),
    },
    {
      title: 'Prices Set',
      key: 'prices',
      width: 100,
      render: (_, record) => (
        <Tag color={record.prices?.length > 0 ? 'green' : 'orange'}>
          {record.prices?.length || 0} sheens
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => showDetailModal(record)}
          >
            View
          </Button>
          <Button
            size="small"
            icon={<DollarOutlined />}
            type="primary"
            onClick={() => showPriceModal(record)}
          >
            Set Prices
          </Button>
          <Button
            size="small"
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDeleteProduct(record.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-semibold">Brand & Product Management</h2>
      </div>

      <Tabs defaultValue="products">
        <TabPane tab="Products" key="products">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div className="flex items-center gap-4">
              <span className="font-medium">Brand:</span>
              <Select
                value={selectedBrand}
                onChange={setSelectedBrand}
                style={{ width: 200 }}
                placeholder="Select a brand"
              >
                {brands.map(brand => (
                  <Select.Option key={brand.id} value={brand.id}>
                    {brand.name}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <Space>
              <Button
                icon={<UploadOutlined />}
                onClick={() => setUploadModalVisible(true)}
                disabled={!selectedBrand}
              >
                Bulk Upload
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setProductModalVisible(true)}
                disabled={!selectedBrand}
              >
                Add Product
              </Button>
            </Space>
          </div>

          <Spin spinning={loading}>
            <Table
              columns={productColumns}
              dataSource={products}
              rowKey="id"
              scroll={{ x: 'max-content' }}
            />
          </Spin>
        </TabPane>

        <TabPane tab="Brands" key="brands">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Manage Brands</h3>
            <Space>
              {/* <Button onClick={seedBrands}>Seed Default Brands</Button> */}
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setBrandModalVisible(true)}
              >
                Add Brand
              </Button>
            </Space>
          </div>

          <Spin spinning={loading}>
            <Table
              columns={brandColumns}
              dataSource={brands}
              rowKey="id"
              scroll={{ x: 'max-content' }}
            />
          </Spin>
        </TabPane>
      </Tabs>

      {/* Add Brand Modal */}
      <Modal
        title="Add New Brand"
        open={brandModalVisible}
        onCancel={() => {
          setBrandModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateBrand}>
          <Form.Item
            name="name"
            label="Brand Name"
            rules={[{ required: true, message: 'Please enter brand name' }]}
          >
            <Input placeholder="e.g., Sherwin-Williams" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Brand description" />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => {
                setBrandModalVisible(false);
                form.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                Create Brand
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Product Modal */}
      <Modal
        title="Add New Product"
        open={productModalVisible}
        onCancel={() => {
          setProductModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateProduct}>
          <Form.Item
            name="name"
            label="Product Name"
            rules={[{ required: true, message: 'Please enter product name' }]}
          >
            <Input placeholder="e.g., ProMar 200" />
          </Form.Item>

          <Form.Item
            name="sheenOptions"
            label="Available Sheen Options"
            rules={[{ required: true, message: 'Please select sheen options' }]}
          >
            <Select
              mode="multiple"
              placeholder="Select available sheens"
              options={sheenOptions.map(s => ({ label: s, value: s }))}
            />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Product description" />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => {
                setProductModalVisible(false);
                form.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                Create Product
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Set Prices Modal */}
      <Modal
        title={`Set Prices - ${selectedProduct?.name}`}
        open={priceModalVisible}
        onCancel={() => {
          setPriceModalVisible(false);
          priceForm.resetFields();
          setSelectedProduct(null);
        }}
        footer={null}
        width={600}
      >
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800">
            <strong>Auto-calculation:</strong> Enter the Flat price and Matte, Satin, and Semi-Gloss will be calculated automatically.
          </p>
          <ul className="text-xs text-blue-700 mt-2 ml-4 list-disc">
            <li>Flat & Matte: Same price</li>
            <li>Satin: Flat + $2</li>
            <li>Semi-Gloss: Flat + $4</li>
          </ul>
        </div>

        <Form form={priceForm} layout="vertical" onFinish={handleUpdatePrices}>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="flat"
              label="Flat"
              rules={[{ required: true, message: 'Enter Flat price' }]}
            >
              <Input
                prefix="$"
                type="number"
                step="0.01"
                placeholder="0.00"
                onChange={(e) => {
                  const flatPrice = parseFloat(e.target.value);
                  if (!isNaN(flatPrice)) {
                    priceForm.setFieldsValue({
                      matte: flatPrice.toFixed(2),
                      satin: (flatPrice + 2).toFixed(2),
                      semigloss: (flatPrice + 4).toFixed(2)
                    });
                  }
                }}
              />
            </Form.Item>

            <Form.Item name="matte" label="Matte">
              <Input prefix="$" type="number" step="0.01" placeholder="0.00" disabled />
            </Form.Item>

            <Form.Item name="eggshell" label="Eggshell (Optional)">
              <Input prefix="$" type="number" step="0.01" placeholder="0.00" />
            </Form.Item>

            <Form.Item name="satin" label="Satin">
              <Input prefix="$" type="number" step="0.01" placeholder="0.00" disabled />
            </Form.Item>

            <Form.Item name="semigloss" label="Semi-Gloss">
              <Input prefix="$" type="number" step="0.01" placeholder="0.00" disabled />
            </Form.Item>

            <Form.Item name="gloss" label="Gloss (Optional)">
              <Input prefix="$" type="number" step="0.01" placeholder="0.00" />
            </Form.Item>
          </div>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => {
                setPriceModalVisible(false);
                priceForm.resetFields();
                setSelectedProduct(null);
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                Save Prices
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal
        title="Bulk Upload Products"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
      >
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-sm mb-2"><strong>File Format:</strong></p>
            <ul className="text-sm list-disc ml-4 space-y-1">
              <li>Excel (.xlsx) or CSV file</li>
              <li>Columns: "Product Name", "Sheen Options / Finish Type"</li>
              <li>Example: ProMar 200, "Flat, Eggshell, Satin"</li>
            </ul>
          </div>

          <Upload
            beforeUpload={handleBulkUpload}
            maxCount={1}
            accept=".xlsx,.xls,.csv"
          >
            <Button icon={<UploadOutlined />} block>
              Select File to Upload
            </Button>
          </Upload>
        </div>
      </Modal>

      {/* Product Detail Modal */}
      <Modal
        title="Product Details"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedProduct(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setDetailModalVisible(false);
              setSelectedProduct(null);
            }}
          >
            Close
          </Button>,
          <Button
            key="edit"
            type="primary"
            icon={<DollarOutlined />}
            onClick={() => {
              setDetailModalVisible(false);
              showPriceModal(selectedProduct);
            }}
          >
            Edit Prices
          </Button>
        ]}
        width={700}
      >
        {selectedProduct && (
          <div className="space-y-4">
            {/* Product Info */}
            <Card size="small" title="Product Information">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Product Name:</span>
                  <span className="font-semibold">{selectedProduct.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Brand:</span>
                  <span>{selectedProduct.brandDetails?.name || 'N/A'}</span>
                </div>
                {selectedProduct.description && (
                  <div className="pt-2 border-t">
                    <span className="font-medium text-gray-600">Description:</span>
                    <p className="mt-1 text-gray-700">{selectedProduct.description}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Sheen Options */}
            <Card size="small" title="Available Sheen Options">
              <div className="flex flex-wrap gap-2">
                {selectedProduct.sheenOptions ? (
                  selectedProduct.sheenOptions.split(',').map((sheen, index) => (
                    <Tag key={index} color="green" className="text-base px-3 py-1">
                      {sheen.trim()}
                    </Tag>
                  ))
                ) : (
                  <span className="text-gray-400">No sheen options specified</span>
                )}
              </div>
            </Card>

            {/* Prices */}
            <Card size="small" title="Price Details">
              {selectedProduct.prices && selectedProduct.prices.length > 0 ? (
                <div className="space-y-2">
                  {selectedProduct.prices.map((price, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                      <span className="font-medium text-gray-700">{price.sheen}</span>
                      <span className="text-lg font-semibold text-green-600">
                        ${parseFloat(price.price).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-400 mb-3">No prices set yet</p>
                  <Button
                    type="primary"
                    icon={<DollarOutlined />}
                    onClick={() => {
                      setDetailModalVisible(false);
                      showPriceModal(selectedProduct);
                    }}
                  >
                    Set Prices Now
                  </Button>
                </div>
              )}
            </Card>

            {/* Metadata */}
            <Card size="small" title="Additional Information">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Product ID:</span>
                  <span className="font-mono">{selectedProduct.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <Tag color={selectedProduct.isActive ? 'green' : 'red'}>
                    {selectedProduct.isActive ? 'Active' : 'Inactive'}
                  </Tag>
                </div>
                {selectedProduct.createdAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span>{new Date(selectedProduct.createdAt).toLocaleDateString()}</span>
                  </div>
                )}
                {selectedProduct.updatedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Updated:</span>
                    <span>{new Date(selectedProduct.updatedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BrandProductManager;
