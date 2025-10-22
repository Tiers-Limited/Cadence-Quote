import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, Space, Tag, message, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth';
import { Navigate } from 'react-router-dom';

const { Option } = Select;

const ProductCatalog = () => {
  const { isAuthenticated, user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form] = Form.useForm();

  // Redirect business_admin to ComingSoonPage
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === 'business_admin') {
    return <Navigate to="/coming-soon" replace />;
  }

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/products');
      if (response.success) {
        setProducts(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const showModal = (product = null) => {
    setEditingProduct(product);
    if (product) {
      form.setFieldsValue({
        ...product,
        isActive: product.isActive ?? true,
        isSystemDefault: product.isSystemDefault ?? false
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        isActive: true,
        isSystemDefault: false
      });
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        costPerGallon: Number(values.costPerGallon),
        coverageRate: Number(values.coverageRate)
      };
      if (editingProduct) {
        await apiService.put(`/products/${editingProduct.id}`, payload);
        message.success('Product updated successfully');
      } else {
        await apiService.post('/products', payload);
        message.success('Product added successfully');
      }
      setModalVisible(false);
      fetchProducts();
    } catch (error) {
      message.error('Failed to save product');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.delete(`/products/${id}`);
      message.success('Product deleted successfully');
      fetchProducts();
    } catch (error) {
      message.error('Failed to delete product');
    }
  };

  const columns = [
    {
      title: 'Brand',
      dataIndex: 'brand',
      key: 'brand',
      sorter: (a, b) => a.brand.localeCompare(b.brand),
      filters: [
        { text: 'Sherwin-Williams', value: 'sherwin-williams' },
        { text: 'Benjamin Moore', value: 'benjamin-moore' },
        { text: 'Behr', value: 'behr' },
        { text: 'Other', value: 'other' }
      ],
      onFilter: (value, record) => record.brand === value
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
      render: (category) => (
        <Tag color={
          category === 'interior' ? 'blue' :
          category === 'exterior' ? 'green' :
          category === 'primer' ? 'orange' :
          category === 'ceiling' ? 'cyan' :
          category === 'trim' ? 'purple' :
          'default'
        }>
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
      render: (tier) => (
        <Tag color={
          tier === 'best' ? 'gold' :
          tier === 'better' ? 'blue' :
          'green'
        }>
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
    {
      title: 'Sheen',
      dataIndex: 'sheen',
      key: 'sheen',
      render: (sheen) => (
        <Tag color="default">
          {sheen.toUpperCase()}
        </Tag>
      ),
      filters: [
        { text: 'Matte', value: 'matte' },
        { text: 'Eggshell', value: 'eggshell' },
        { text: 'Satin', value: 'satin' },
        { text: 'Semi-Gloss', value: 'semi-gloss' },
        { text: 'Gloss', value: 'gloss' }
      ],
      onFilter: (value, record) => record.sheen === value
    },
    {
      title: 'Cost/Gallon',
      dataIndex: 'costPerGallon',
      key: 'costPerGallon',
      render: (cost) => `$${Number(cost).toFixed(2)}`,
      sorter: (a, b) => a.costPerGallon - b.costPerGallon
    },
    {
      title: 'Coverage Rate',
      dataIndex: 'coverageRate',
      key: 'coverageRate',
      render: (rate) => `${rate} sq ft/gallon`,
      sorter: (a, b) => a.coverageRate - b.coverageRate
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
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
      render: (isSystemDefault) => (
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
      render: (date) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    },
    {
      title: 'Updated At',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt)
    },
    {
      title: 'Actions',
      key: 'actions',
        fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            onClick={() => showModal(record)}
          />
          <Button 
            icon={<DeleteOutlined />} 
            danger
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      )
    }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-semibold">Product Catalog</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => showModal()}
        >
          Add Product
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={products}
        loading={loading}
        rowKey="id"
        scroll={{ x: 'max-content' }} // ✅ adds horizontal scroll
    pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="brand"
            label="Brand"
            rules={[{ required: true, message: 'Please select a brand' }]}
          >
            <Select>
              <Option value="sherwin-williams">Sherwin-Williams</Option>
              <Option value="benjamin-moore">Benjamin Moore</Option>
              <Option value="behr">Behr</Option>
              <Option value="other">Other</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="line"
            label="Product Line"
            rules={[{ required: true, message: 'Please enter product line' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="name"
            label="Product Name"
            rules={[{ required: true, message: 'Please enter product name' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Please select a category' }]}
          >
            <Select>
              <Option value="interior">Interior</Option>
              <Option value="exterior">Exterior</Option>
              <Option value="primer">Primer</Option>
              <Option value="ceiling">Ceiling</Option>
              <Option value="trim">Trim</Option>
              <Option value="custom">Custom</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="tier"
            label="Quality Tier"
            rules={[{ required: true, message: 'Please select a quality tier' }]}
          >
            <Select>
              <Option value="good">Good</Option>
              <Option value="better">Better</Option>
              <Option value="best">Best</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="sheen"
            label="Sheen"
            rules={[{ required: true, message: 'Please select a sheen' }]}
          >
            <Select>
              <Option value="matte">Matte</Option>
              <Option value="eggshell">Eggshell</Option>
              <Option value="satin">Satin</Option>
              <Option value="semi-gloss">Semi-Gloss</Option>
              <Option value="gloss">Gloss</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="costPerGallon"
            label="Cost per Gallon"
            rules={[{ required: true, message: 'Please enter cost per gallon' }]}
          >
            <InputNumber
              prefix="$"
              min={0}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="coverageRate"
            label="Coverage Rate (sq ft/gallon)"
            rules={[{ required: true, message: 'Please enter coverage rate' }]}
          >
            <InputNumber
              min={0}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="Active"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="isSystemDefault"
            label="System Default"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                {editingProduct ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductCatalog;