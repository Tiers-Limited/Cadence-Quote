import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Tag, message, Card, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {apiService} from '../../services/apiService';

const { Option } = Select;

const ColorLibrary = () => {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingColor, setEditingColor] = useState(null);
  const [form] = Form.useForm();

  const fetchColors = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/colors');
      if (response.success) {
        setColors(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch colors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColors();
  }, []);

  const showModal = (color = null) => {
    setEditingColor(color);
    if (color) {
      form.setFieldsValue(color);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingColor) {
        await apiService.put(`/colors/${editingColor.id}`, values);
        message.success('Color updated successfully');
      } else {
        await apiService.post('/colors', values);
        message.success('Color added successfully');
      }
      setModalVisible(false);
      fetchColors();
    } catch (error) {
      message.error('Failed to save color');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.delete(`/colors/${id}`);
      message.success('Color deleted successfully');
      fetchColors();
    } catch (error) {
      message.error('Failed to delete color');
    }
  };

  const columns = [
    {
      title: 'Preview',
      key: 'preview',
      render: (_, record) => (
        <div
          className="w-8 h-8 rounded border"
          style={{ 
            backgroundColor: record.hexValue,
            border: '1px solid #d9d9d9'
          }}
        />
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: 'Brand',
      dataIndex: 'brand',
      key: 'brand',
    },
    {
      title: 'Family',
      dataIndex: 'colorFamily',
      key: 'colorFamily',
      render: (family) => (
        <Tag color="blue">{family}</Tag>
      ),
    },
    {
      title: 'Type',
      key: 'type',
      render: (_, record) => (
        <Tag color={record.isCustomMatch ? 'orange' : 'green'}>
          {record.isCustomMatch ? 'Custom Match' : 'Standard'}
        </Tag>
      ),
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

  const colorFamilies = [
    { name: 'Whites', colors: colors.filter(c => c.colorFamily === 'Whites') },
    { name: 'Neutrals', colors: colors.filter(c => c.colorFamily === 'Neutrals') },
    { name: 'Blues', colors: colors.filter(c => c.colorFamily === 'Blues') },
    { name: 'Greens', colors: colors.filter(c => c.colorFamily === 'Greens') },
    // Add more color families as needed
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-semibold">Color Library</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => showModal()}
        >
          Add Color
        </Button>
      </div>

      {/* Color Family Grid View */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4">Color Families</h3>
        <Row gutter={[16, 16]}>
          {colorFamilies.map(family => (
            <Col xs={24} sm={12} md={8} lg={6} key={family.name}>
              <Card title={family.name}>
                <div className="grid grid-cols-4 gap-2">
                  {family.colors.map(color => (
                    <div
                      key={color.id}
                      className="w-full pt-[100%] relative rounded cursor-pointer hover:scale-105 transition-transform"
                      style={{ 
                        backgroundColor: color.hexValue,
                        border: '1px solid #d9d9d9'
                      }}
                      onClick={() => showModal(color)}
                      title={`${color.name} (${color.code})`}
                    />
                  ))}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* Detailed List View */}
      <Table
        columns={columns}
        dataSource={colors}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title={editingColor ? 'Edit Color' : 'Add Color'}
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
            name="name"
            label="Color Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="code"
            label="Color Code"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

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
            name="colorFamily"
            label="Color Family"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="Whites">Whites</Option>
              <Option value="Neutrals">Neutrals</Option>
              <Option value="Blues">Blues</Option>
              <Option value="Greens">Greens</Option>
              <Option value="Reds">Reds</Option>
              <Option value="Yellows">Yellows</Option>
              <Option value="Other">Other</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="hexValue"
            label="Hex Color Code"
            rules={[
              { required: true },
              { pattern: /^#[0-9A-Fa-f]{6}$/, message: 'Invalid hex color code' }
            ]}
          >
            <Input type="color" />
          </Form.Item>

          <Form.Item
            name="isCustomMatch"
            valuePropName="checked"
            label="Custom Match"
          >
            <Input type="checkbox" />
          </Form.Item>

          <Form.Item
            name="notes"
            label="Notes"
          >
            <Input.TextArea />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                {editingColor ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ColorLibrary;