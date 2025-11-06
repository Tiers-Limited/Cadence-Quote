import React, { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
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
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
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
      form.setFieldsValue({
        brandId: product.brandId,
        line: product.line,
        name: product.name,
        category: product.category,
        tier: product.tier,
        sheen: product.sheen,
        sheenOptions: product.sheenOptions ? product.sheenOptions.split(',').map(s => s.trim()) : [],
        costPerGallon: product.pricePerGallon || product.costPerGallon,
        coverageRate: product.coverageRate,
        isActive: product.isActive ?? true,
        isSystemDefault: product.isSystemDefault ?? false
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        isActive: true,
        isSystemDefault: false
      })
    }
    setModalVisible(true)
  }

  const handleSubmit = async values => {
    try {
      const payload = {
        brandId: values.brandId,
        line: values.line,
        name: values.name,
        category: values.category,
        tier: values.tier,
        sheen: values.sheen,
        sheenOptions: Array.isArray(values.sheenOptions) 
          ? values.sheenOptions.join(', ') 
          : values.sheenOptions || '',
        pricePerGallon: Number(values.costPerGallon),
        coverageRate: Number(values.coverageRate),
        isActive: values.isActive ?? true,
        isSystemDefault: values.isSystemDefault ?? false
      }
      if (editingProduct) {
        await apiService.put(`/products/${editingProduct.id}`, payload)
        message.success('Product updated successfully')
      } else {
        await apiService.post('/products', payload)
        message.success('Product added successfully')
      }
      setModalVisible(false)
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
      title: 'Sheen',
      dataIndex: 'sheenOptions',
      key: 'sheenOptions',
      width: 250,
      render: sheenOptions => (
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
      sorter: (a, b) => {
        const sheenA = a.sheenOptions || ''
        // complete this function
        const sheenB = b.sheenOptions || ''
        return sheenA.localeCompare(sheenB)
      },
      filters: [
        { text: 'Matte', value: 'matte' },
        { text: 'Eggshell', value: 'eggshell' },
        { text: 'Satin', value: 'satin' },
        { text: 'Semi-Gloss', value: 'semi-gloss' },
        { text: 'Gloss', value: 'gloss' }
      ],
      onFilter: (value, record) => {
        // complete this function
        return (
          record.sheenOptions &&
          record.sheenOptions
            .split(',')
            .map(s => s.trim().toLowerCase())
            .includes(value)
        )
      }
    },
    {
      title: 'Cost/Gallon',
      dataIndex: 'costPerGallon',
      key: 'costPerGallon',
      render: cost => `$${Number(cost).toFixed(2)}`,
      sorter: (a, b) => a.costPerGallon - b.costPerGallon
    },
    {
      title: 'Coverage Rate',
      dataIndex: 'coverageRate',
      key: 'coverageRate',
      render: rate => `${rate} sq ft/gallon`,
      sorter: (a, b) => a.coverageRate - b.coverageRate
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
        onCancel={() => setModalVisible(false)}
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
          <Row gutter={isMobile ? 0 : 16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name='brandId'
                label='Brand'
                rules={[{ required: true, message: 'Please select a brand' }]}
              >
                <Select
                  placeholder='Select a brand'
                  showSearch
                  optionFilterProp='children'
                  filterOption={(input, option) =>
                    option.children
                      .toLowerCase()
                      .indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {brands.map(brand => (
                    <Option key={brand.id} value={brand.id}>
                      {brand.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name='line'
                label='Product Line'
                rules={[
                  { required: true, message: 'Please enter product line' }
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name='name'
            label='Product Name'
            rules={[{ required: true, message: 'Please enter product name' }]}
          >
            <Input />
          </Form.Item>

          <Row gutter={isMobile ? 0 : 16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name='category'
                label='Category'
                rules={[
                  { required: true, message: 'Please select a category' }
                ]}
              >
                <Select>
                  <Option value='interior'>Interior</Option>
                  <Option value='exterior'>Exterior</Option>
                  <Option value='primer'>Primer</Option>
                  <Option value='ceiling'>Ceiling</Option>
                  <Option value='trim'>Trim</Option>
                  <Option value='custom'>Custom</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name='tier'
                label='Quality Tier'
                rules={[
                  { required: true, message: 'Please select a quality tier' }
                ]}
              >
                <Select>
                  <Option value='good'>Good</Option>
                  <Option value='better'>Better</Option>
                  <Option value='best'>Best</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name='sheenOptions'
            label='Available Sheen Options'
            rules={[{ required: true, message: 'Please select sheen options' }]}
          >
            <Select
              mode='multiple'
              placeholder='Select available sheens'
              options={[
                { label: 'Flat', value: 'Flat' },
                { label: 'Matte', value: 'Matte' },
                { label: 'Eggshell', value: 'Eggshell' },
                { label: 'Satin', value: 'Satin' },
                { label: 'Semi-Gloss', value: 'Semi-Gloss' },
                { label: 'Gloss', value: 'Gloss' }
              ]}
            />
          </Form.Item>

          <Form.Item
            name='sheen'
            label='Default Sheen'
            rules={[{ required: true, message: 'Please select a default sheen' }]}
          >
            <Select>
              <Option value='flat'>Flat</Option>
              <Option value='matte'>Matte</Option>
              <Option value='eggshell'>Eggshell</Option>
              <Option value='satin'>Satin</Option>
              <Option value='semi-gloss'>Semi-Gloss</Option>
              <Option value='gloss'>Gloss</Option>
            </Select>
          </Form.Item>

          <Row gutter={isMobile ? 0 : 16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name='costPerGallon'
                label='Cost per Gallon'
                rules={[
                  { required: true, message: 'Please enter cost per gallon' }
                ]}
              >
                <InputNumber
                  prefix='$'
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name='coverageRate'
                label='Coverage Rate (sq ft/gallon)'
                rules={[
                  { required: true, message: 'Please enter coverage rate' }
                ]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

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
              <Button onClick={() => setModalVisible(false)} block={isMobile}>
                Cancel
              </Button>
              <Button type='primary' htmlType='submit' block={isMobile}>
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
