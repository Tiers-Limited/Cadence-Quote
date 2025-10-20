import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, Space, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';


const { Option } = Select;

const ProductCatalog = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form] = Form.useForm();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/paint-products');
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
      form.setFieldsValue(product);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingProduct) {
        await apiService.put(`/paint-products/${editingProduct.id}`, values);
        message.success('Product updated successfully');
      } else {
        await apiService.post('/paint-products', values);
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
      await apiService.delete(`/paint-products/${id}`);
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
    },
    {
      title: 'Line',
      dataIndex: 'line',
      key: 'line',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
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
          'default'
        }>
          {category.toUpperCase()}
        </Tag>
      ),
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
    },
    {
      title: 'Cost/Gallon',
      dataIndex: 'costPerGallon',
      key: 'costPerGallon',
      render: (cost) => `$${cost.toFixed(2)}`,
    },
    {
      title: 'Actions',
      key: 'actions',
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
      ),
    },
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
            rules={[{ required: true }]}
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
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="name"
            label="Product Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true }]}
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
            rules={[{ required: true }]}
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
            rules={[{ required: true }]}
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
            rules={[{ required: true }]}
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
            rules={[{ required: true }]}
          >
            <InputNumber
              min={0}
              style={{ width: '100%' }}
            />
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