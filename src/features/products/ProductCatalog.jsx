import React, { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  InputNumber,
  Space,
  Tag,
  message,
  Switch,
  Row,
  Col
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { apiService } from '../../services/apiService'
import { useAuth } from '../../hooks/useAuth'
import { Navigate } from 'react-router-dom'

const { Option } = Select

const ProductCatalog = () => {
  const { isAuthenticated, user } = useAuth()
  const [products, setProducts] = useState([])
  const [globalProducts, setGlobalProducts] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [selectedGlobalProduct, setSelectedGlobalProduct] = useState(null)
  const [form] = Form.useForm()
  const [isMobile, setIsMobile] = useState(false)

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const response = await apiService.get('/products')
      if (response.success) {
        setProducts(response.data)
      }
    } catch (error) {
      message.error('Failed to fetch products')
      console.error('Fetch products error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchGlobalProducts = async () => {
    try {
      const response = await apiService.getGlobalProducts()
      if (response.success || response.data) {
        setGlobalProducts(response.data || [])
      }
    } catch (error) {
      message.error('Failed to fetch global products')
      console.error('Fetch global products error:', error)
    }
  }

  const fetchBrands = async () => {
    try {
      const response = await apiService.get('/brands')
      if (response.success) {
        setBrands(response.data)
      }
    } catch (error) {
      console.error('Fetch brands error:', error)
    }
  }

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchGlobalProducts()
    fetchBrands()
  }, [])

  // Redirect business_admin to ComingSoonPage
  if (!isAuthenticated) {
    return <Navigate to='/login' replace />
  }
  if (user?.role === 'business_admin') {
    return <Navigate to='/coming-soon' replace />
  }

  const showModal = (product = null) => {
    setEditingProduct(product)
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
        isSystemDefault: product.isSystemDefault ?? false,
        ...sheenPricing
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        isActive: true,
        isSystemDefault: false
      })
      setSelectedGlobalProduct(null)
    }
    setModalVisible(true)
  }

  const handleGlobalProductChange = (globalProductId) => {
    const globalProd = globalProducts.find(gp => gp.id === globalProductId);
    setSelectedGlobalProduct(globalProd);
    
    // Reset sheen pricing fields when product changes
    const sheenOpts = globalProd?.sheenOptions ? globalProd.sheenOptions.split(',').map(s => s.trim()) : [];
    const resetFields = {};
    sheenOpts.forEach(sheen => {
      const sheenKey = sheen.toLowerCase().replace(/[^a-z]/g, '');
      resetFields[`${sheenKey}_price`] = undefined;
      resetFields[`${sheenKey}_coverage`] = undefined;
    });
    form.setFieldsValue(resetFields);
  }

  const handleSubmit = async values => {
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
        isSystemDefault: values.isSystemDefault ?? false,
        ...sheenPricing
      }

      if (editingProduct) {
        await apiService.put(`/products/${editingProduct.id}`, payload)
        message.success('Product updated successfully')
      } else {
        await apiService.post('/products', payload)
        message.success('Product added successfully')
      }
      
      setModalVisible(false)
      setSelectedGlobalProduct(null)
      form.resetFields()
      fetchProducts()
    } catch (error) {
      message.error('Failed to save product')
      console.error('Save product error:', error)
    }
  }

  const handleDelete = async id => {
    try {
      await apiService.delete(`/products/${id}`)
      message.success('Product deleted successfully')
      fetchProducts()
    } catch (error) {
      message.error('Failed to delete product')
      console.error('Delete product error:', error)
    }
  }

  const columns = [
    {
      title: 'Brand',
      dataIndex: 'brandId',
      key: 'brandId',
      render: (brandId, record) => {
        const brand = brands.find(b => b.id === brandId)
        return brand ? brand.name : record.brand || 'N/A'
      },
      sorter: (a, b) => {
        const brandA = brands.find(b => b.id === a.brandId)
        const brandB = brands.find(b => b.id === b.brandId)
        const nameA = brandA ? brandA.name : a.brand || ''
        const nameB = brandB ? brandB.name : b.brand || ''
        return nameA.localeCompare(nameB)
      },
      filters: brands.map(brand => ({ text: brand.name, value: brand.id })),
      onFilter: (value, record) => {
        return record.brandId === value
      }
    },
    {
      title: 'Line',
      dataIndex: 'line',
      key: 'line',
      sorter: (a, b) => a.line.localeCompare(b.line)
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name)
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: category => (
        <Tag
          color={
            category === 'interior'
              ? 'blue'
              : category === 'exterior'
              ? 'green'
              : category === 'primer'
              ? 'orange'
              : category === 'ceiling'
              ? 'cyan'
              : category === 'trim'
              ? 'purple'
              : 'default'
          }
        >
          {category.toUpperCase()}
        </Tag>
      ),
      filters: [
        { text: 'Interior', value: 'interior' },
        { text: 'Exterior', value: 'exterior' },
        { text: 'Primer', value: 'primer' },
        { text: 'Ceiling', value: 'ceiling' },
        { text: 'Trim', value: 'trim' },
        { text: 'Custom', value: 'custom' }
      ],
      onFilter: (value, record) => record.category === value
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      render: tier => (
        <Tag
          color={
            tier === 'best' ? 'gold' : tier === 'better' ? 'blue' : 'green'
          }
        >
          {tier.toUpperCase()}
        </Tag>
      ),
      filters: [
        { text: 'Good', value: 'good' },
        { text: 'Better', value: 'better' },
        { text: 'Best', value: 'best' }
      ],
      onFilter: (value, record) => record.tier === value
    },
    // {
    //   title: 'Sheen',
    //   dataIndex: 'sheen',
    //   key: 'sheen',
    //   render: (sheen) => (
    //     <Tag color="default">
    //       {sheen.toUpperCase()}
    //     </Tag>
    //   ),
    //   filters: [
    //     { text: 'Matte', value: 'matte' },
    //     { text: 'Eggshell', value: 'eggshell' },
    //     { text: 'Satin', value: 'satin' },
    //     { text: 'Semi-Gloss', value: 'semi-gloss' },
    //     { text: 'Gloss', value: 'gloss' }
    //   ],
    //   onFilter: (value, record) => record.sheen === value
    // },
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
      title: 'Cost/Gallon',
      dataIndex: 'costPerGallon',
      key: 'costPerGallon',
      render: (cost, record) => {
        // Try to get first sheen price if costPerGallon not available
        if (cost) return `$${Number(cost).toFixed(2)}`;
        
        const sheenOptions = record.sheenOptions;
        if (sheenOptions) {
          const firstSheen = sheenOptions.split(',')[0].trim();
          const sheenKey = firstSheen.toLowerCase().replace(/[^a-z]/g, '');
          const price = record[`${sheenKey}_price`];
          if (price) return `$${Number(price).toFixed(2)} (${firstSheen})`;
        }
        return '-';
      },
      sorter: (a, b) => {
        const priceA = a.costPerGallon || 0;
        const priceB = b.costPerGallon || 0;
        return priceA - priceB;
      }
    },
    {
      title: 'Coverage Rate',
      dataIndex: 'coverageRate',
      key: 'coverageRate',
      render: (rate, record) => {
        if (rate) return `${rate} sq ft/gallon`;
        
        // Try to get first sheen coverage
        const sheenOptions = record.sheenOptions;
        if (sheenOptions) {
          const firstSheen = sheenOptions.split(',')[0].trim();
          const sheenKey = firstSheen.toLowerCase().replace(/[^a-z]/g, '');
          const coverage = record[`${sheenKey}_coverage`];
          if (coverage) return `${coverage} sq ft/gal (${firstSheen})`;
        }
        return '-';
      },
      sorter: (a, b) => {
        const rateA = a.coverageRate || 0;
        const rateB = b.coverageRate || 0;
        return rateA - rateB;
      }
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      render: isActive => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false }
      ],
      onFilter: (value, record) => record.isActive === value
    },
    {
      title: 'System Default',
      dataIndex: 'isSystemDefault',
      key: 'isSystemDefault',
      render: isSystemDefault => (
        <Tag color={isSystemDefault ? 'blue' : 'default'}>
          {isSystemDefault ? 'Default' : 'Not Default'}
        </Tag>
      ),
      filters: [
        { text: 'Default', value: true },
        { text: 'Not Default', value: false }
      ],
      onFilter: (value, record) => record.isSystemDefault === value
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: date => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    },
    {
      title: 'Updated At',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: date => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt)
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => showModal(record)} />
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      )
    }
  ]

  return (
    <div className='p-2 md:p-0'>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4'>
        <h2 className='text-xl md:text-2xl font-semibold'>Product Catalog</h2>
        <Button
          type='primary'
          icon={<PlusOutlined />}
          onClick={() => showModal()}
          block={isMobile}
        >
          Add Product
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={products}
        loading={loading}
        rowKey='id'
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedGlobalProduct(null);
          form.resetFields();
        }}
        footer={null}
        width={isMobile ? '100%' : 600}
        style={isMobile ? { top: 0, paddingBottom: 0, maxWidth: '100vw' } : {}}
        styles={
          isMobile
            ? { body: { maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' } }
            : {}
        }
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
              {globalProducts.map(gp => (
                <Option key={gp.id} value={gp.id}>
                  {gp.brand?.name || gp.customBrand || 'Unknown Brand'} - {gp.name} ({gp.category})
                </Option>
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
                    <Row gutter={isMobile ? 0 : 16}>
                      <Col xs={24} sm={12}>
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
                      </Col>

                      <Col xs={24} sm={12}>
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
                      </Col>
                    </Row>
                  </div>
                );
              })}
            </>
          )}

          <Row gutter={isMobile ? 0 : 16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name='isActive'
                label='Active'
                valuePropName='checked'
                initialValue={true}
              >
                <Switch />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name='isSystemDefault'
                label='System Default'
                valuePropName='checked'
                initialValue={false}
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item className='mb-0'>
            <Space
              className='w-full justify-end'
              size={isMobile ? 'small' : 'middle'}
            >
              <Button onClick={() => {
                setModalVisible(false);
                setSelectedGlobalProduct(null);
                form.resetFields();
              }} block={isMobile}>
                Cancel
              </Button>
              <Button type='primary' htmlType='submit' block={isMobile} disabled={!selectedGlobalProduct}>
                {editingProduct ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ProductCatalog
