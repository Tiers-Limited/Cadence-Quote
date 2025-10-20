import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, Select, InputNumber, 
  Space, Card, Switch, Tabs, message, Typography 
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import {apiService} from '../../services/apiService';

const { Option } = Select;
const { Text } = Typography;

const PricingSchemes = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingScheme, setEditingScheme] = useState(null);
  const [form] = Form.useForm();

  const fetchSchemes = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/pricing-schemes');
      if (response.success) {
        setSchemes(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch pricing schemes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemes();
  }, []);

  const showModal = (scheme = null) => {
    setEditingScheme(scheme);
    if (scheme) {
      form.setFieldsValue({
        ...scheme,
        rules: scheme.pricingRules
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        pricingRules: values.rules
      };
      
      if (editingScheme) {
        await apiService.put(`/pricing-schemes/${editingScheme.id}`, data);
        message.success('Pricing scheme updated successfully');
      } else {
        await apiService.post('/pricing-schemes', data);
        message.success('Pricing scheme created successfully');
      }
      setModalVisible(false);
      fetchSchemes();
    } catch (error) {
      message.error('Failed to save pricing scheme');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.delete(`/pricing-schemes/${id}`);
      message.success('Pricing scheme deleted successfully');
      fetchSchemes();
    } catch (error) {
      message.error('Failed to delete pricing scheme');
    }
  };

  const handleDuplicate = async (scheme) => {
    try {
      const newScheme = {
        ...scheme,
        name: `${scheme.name} (Copy)`,
        isDefault: false
      };
      delete newScheme.id;
      
      await apiService.post('/pricing-schemes', newScheme);
      message.success('Pricing scheme duplicated successfully');
      fetchSchemes();
    } catch (error) {
      message.error('Failed to duplicate pricing scheme');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {text}
          {record.isDefault && (
            <Text type="secondary">(Default)</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const types = {
          sqft_turnkey: 'Square Foot (Turnkey)',
          sqft_labor_only: 'Square Foot (Labor)',
          hourly_time_materials: 'Time & Materials',
          unit_based: 'Unit-Based'
        };
        return types[type] || type;
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <Space>
          {record.isActive ? (
            <Text type="success">Active</Text>
          ) : (
            <Text type="secondary">Inactive</Text>
          )}
        </Space>
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
            icon={<CopyOutlined />}
            onClick={() => handleDuplicate(record)}
          />
          <Button 
            icon={<DeleteOutlined />} 
            danger
            disabled={record.isDefault}
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  // Dynamic form fields based on pricing type
  const getRulesFields = (type) => {
    switch (type) {
      case 'sqft_turnkey':
      case 'sqft_labor_only':
        return (
          <>
            <Form.Item
              label="Interior Walls (per sq ft)"
              name={['rules', 'interior_walls']}
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
              label="Exterior Walls (per sq ft)"
              name={['rules', 'exterior_walls']}
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
              label="Ceilings (per sq ft)"
              name={['rules', 'ceilings']}
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
              label="Trim (per linear ft)"
              name={['rules', 'trim']}
              rules={[{ required: true }]}
            >
              <InputNumber 
                prefix="$" 
                min={0} 
                precision={2}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </>
        );
      
      case 'hourly_time_materials':
        return (
          <>
            <Form.Item
              label="Hourly Rate"
              name={['rules', 'hourly_rate']}
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
              label="Material Markup (%)"
              name={['rules', 'material_markup']}
              rules={[{ required: true }]}
            >
              <InputNumber 
                min={0} 
                max={100}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </>
        );
      
      case 'unit_based':
        return (
          <>
            <Form.Item
              label="Per Room Rate"
              name={['rules', 'per_room']}
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
              label="Per Door Rate"
              name={['rules', 'per_door']}
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
              label="Per Window Rate"
              name={['rules', 'per_window']}
              rules={[{ required: true }]}
            >
              <InputNumber 
                prefix="$" 
                min={0} 
                precision={2}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-semibold">Pricing Schemes</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => showModal()}
        >
          Add Scheme
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={schemes}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title={editingScheme ? 'Edit Pricing Scheme' : 'Add Pricing Scheme'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={720}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="Scheme Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="type"
            label="Pricing Type"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="sqft_turnkey">Square Foot (Turnkey)</Option>
              <Option value="sqft_labor_only">Square Foot (Labor Only)</Option>
              <Option value="hourly_time_materials">Time & Materials</Option>
              <Option value="unit_based">Unit-Based</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea />
          </Form.Item>

          <Card title="Pricing Rules" className="mb-4">
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) => getRulesFields(getFieldValue('type'))}
            </Form.Item>
          </Card>

          <Form.Item
            name="isActive"
            valuePropName="checked"
            label="Active"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="isDefault"
            valuePropName="checked"
            label="Set as Default Scheme"
          >
            <Switch />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                {editingScheme ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PricingSchemes;