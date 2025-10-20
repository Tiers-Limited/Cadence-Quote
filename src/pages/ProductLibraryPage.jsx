import { useState, useEffect } from 'react'
import { Segmented, Tabs, Table, Button, Modal, Form, Input, InputNumber, Select, message, Popconfirm, Tag } from 'antd'
import { FiPackage, FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi'
import { apiService } from '../services/apiService'
import MainLayout from '../components/MainLayout'

const { TabPane } = Tabs
const { Option } = Select

// Tier badge colors
const TIER_COLORS = {
  good: 'green',
  better: 'blue',
  best: 'gold',
  default: 'cyan',
  upgrade: 'purple'
}

// Sheen options
const SHEEN_OPTIONS = ['flat', 'matte', 'eggshell', 'satin', 'semi_gloss', 'gloss']

function ProductLibraryPage() {
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState([])
  const [activeTab, setActiveTab] = useState('wall_paint')
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchProducts()
  }, [activeTab])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const response = await apiService.get(`/products?category=${activeTab}`)
      if (response.success) {
        setProducts(response.data)
      }
    } catch (error) {
      message.error('Failed to load products: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddProduct = () => {
    setEditingProduct(null)
    form.resetFields()
    form.setFieldsValue({ category: activeTab, isActive: true })
    setIsModalVisible(true)
  }

  const handleEditProduct = (product) => {
    setEditingProduct(product)
    form.setFieldsValue(product)
    setIsModalVisible(true)
  }

  const handleDeleteProduct = async (productId) => {
    try {
      const response = await apiService.delete(`/products/${productId}`)
      if (response.success) {
        message.success('Product deleted successfully')
        fetchProducts()
      }
    } catch (error) {
      message.error('Failed to delete product: ' + error.message)
    }
  }

  const handleModalSubmit = async (values) => {
    try {
      if (editingProduct) {
        // Update existing product
        const response = await apiService.put(`/products/${editingProduct.id}`, values)
        if (response.success) {
          message.success('Product updated successfully')
          setIsModalVisible(false)
          fetchProducts()
        }
      } else {
        // Create new product
        const response = await apiService.post('/products', values)
        if (response.success) {
          message.success('Product created successfully')
          setIsModalVisible(false)
          fetchProducts()
        }
      }
    } catch (error) {
      message.error(`Failed to ${editingProduct ? 'update' : 'create'} product: ${error.message}`)
    }
  }

  const columns = [
    {
      title: 'Brand',
      dataIndex: 'brand',
      key: 'brand',
      sorter: (a, b) => a.brand.localeCompare(b.brand),
    },
    {
      title: 'Product Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      render: (tier) => (
        <Tag color={TIER_COLORS[tier] || 'default'}>
          {tier?.toUpperCase()}
        </Tag>
      ),
      filters: [
        { text: 'Good', value: 'good' },
        { text: 'Better', value: 'better' },
        { text: 'Best', value: 'best' },
        { text: 'Default', value: 'default' },
        { text: 'Upgrade', value: 'upgrade' },
      ],
      onFilter: (value, record) => record.tier === value,
    },
    {
      title: 'Sheen',
      dataIndex: 'sheen',
      key: 'sheen',
      render: (sheen) => sheen?.replace('_', ' ').toUpperCase(),
    },
    {
      title: 'Price/Gal',
      dataIndex: 'pricePerGallon',
      key: 'pricePerGallon',
      render: (price) => `$${Number(price).toFixed(2)}`,
      sorter: (a, b) => a.pricePerGallon - b.pricePerGallon,
    },
    {
      title: 'Coverage',
      dataIndex: 'coverageRate',
      key: 'coverageRate',
      render: (coverage) => `${coverage} sq ft/gal`,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => record.isActive === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button
            type="link"
            icon={<FiEdit2 />}
            onClick={() => handleEditProduct(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Product"
            description="Are you sure you want to delete this product?"
            onConfirm={() => handleDeleteProduct(record.id)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              danger
              icon={<FiTrash2 />}
            >
              Delete
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <MainLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FiPackage className="text-3xl text-blue-600" />
                <h1 className="text-3xl font-bold text-gray-900">Product Library</h1>
              </div>
              <p className="text-gray-600">
                Manage your paint products and pricing across different categories
              </p>
            </div>
            <Button
              type="primary"
              size="large"
              icon={<FiPlus />}
              onClick={handleAddProduct}
            >
              Add Product
            </Button>
          </div>
        </div>

        {/* Tabs with Tables (Segmented header) */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4">
            <Segmented
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { label: 'Wall Paints', value: 'wall_paint' },
                { label: 'Ceiling Paints', value: 'ceiling_paint' },
                { label: 'Trim Paints', value: 'trim_paint' },
                { label: 'Primers', value: 'primer' },
                { label: 'Custom', value: 'custom' },
              ]}
              className='ant-segmented--rounded'
              block
            />
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type="card"
            size="large"
            tabBarStyle={{ display: 'none' }}
          >
            <TabPane tab="Wall Paints" key="wall_paint">
              <div className="p-6">
                <Table
                  columns={columns}
                  dataSource={products}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} products`,
                  }}
                />
              </div>
            </TabPane>

            <TabPane tab="Ceiling Paints" key="ceiling_paint">
              <div className="p-6">
                <Table
                  columns={columns}
                  dataSource={products}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} products`,
                  }}
                />
              </div>
            </TabPane>

            <TabPane tab="Trim Paints" key="trim_paint">
              <div className="p-6">
                <Table
                  columns={columns}
                  dataSource={products}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} products`,
                  }}
                />
              </div>
            </TabPane>

            <TabPane tab="Primers" key="primer">
              <div className="p-6">
                <Table
                  columns={columns}
                  dataSource={products}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} products`,
                  }}
                />
              </div>
            </TabPane>

            <TabPane tab="Custom" key="custom">
              <div className="p-6">
                <Table
                  columns={columns}
                  dataSource={products}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} products`,
                  }}
                />
              </div>
            </TabPane>
          </Tabs>
        </div>

        {/* Add/Edit Product Modal */}
        <Modal
          title={editingProduct ? 'Edit Product' : 'Add New Product'}
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          footer={null}
          width={700}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleModalSubmit}
            className="mt-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                label="Category"
                name="category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select size="large">
                  <Option value="wall_paint">Wall Paint</Option>
                  <Option value="ceiling_paint">Ceiling Paint</Option>
                  <Option value="trim_paint">Trim Paint</Option>
                  <Option value="primer">Primer</Option>
                  <Option value="custom">Custom</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="Tier"
                name="tier"
                rules={[{ required: true, message: 'Please select tier' }]}
              >
                <Select size="large">
                  <Option value="good">Good</Option>
                  <Option value="better">Better</Option>
                  <Option value="best">Best</Option>
                  <Option value="default">Default</Option>
                  <Option value="upgrade">Upgrade</Option>
                </Select>
              </Form.Item>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                label="Brand"
                name="brand"
                rules={[{ required: true, message: 'Please enter brand' }]}
              >
                <Input size="large" placeholder="e.g., Sherwin-Williams" />
              </Form.Item>

              <Form.Item
                label="Product Name"
                name="name"
                rules={[{ required: true, message: 'Please enter product name' }]}
              >
                <Input size="large" placeholder="e.g., Duration Interior" />
              </Form.Item>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                label="Sheen"
                name="sheen"
                rules={[{ required: true, message: 'Please select sheen' }]}
              >
                <Select size="large">
                  {SHEEN_OPTIONS.map(sheen => (
                    <Option key={sheen} value={sheen}>
                      {sheen.replace('_', ' ').toUpperCase()}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="Status"
                name="isActive"
                rules={[{ required: true, message: 'Please select status' }]}
              >
                <Select size="large">
                  <Option value={true}>Active</Option>
                  <Option value={false}>Inactive</Option>
                </Select>
              </Form.Item>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                label="Price per Gallon ($)"
                name="pricePerGallon"
                rules={[{ required: true, message: 'Please enter price' }]}
              >
                <InputNumber
                  size="large"
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder="78.99"
                />
              </Form.Item>

              <Form.Item
                label="Coverage (sq ft/gal)"
                name="coverageRate"
                rules={[{ required: true, message: 'Please enter coverage rate' }]}
              >
                <InputNumber
                  size="large"
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="400"
                />
              </Form.Item>
            </div>

            <Form.Item
              label="Description (Optional)"
              name="description"
            >
              <Input.TextArea
                rows={3}
                placeholder="Additional product details..."
              />
            </Form.Item>

            <div className="flex justify-end gap-3 mt-6">
              <Button size="large" onClick={() => setIsModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" size="large" htmlType="submit">
                {editingProduct ? 'Update Product' : 'Add Product'}
              </Button>
            </div>
          </Form>
        </Modal>
      </div>
    </MainLayout>
  )
}

export default ProductLibraryPage
