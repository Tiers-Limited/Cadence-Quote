import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag, Popconfirm, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalculatorOutlined } from '@ant-design/icons';

const { Option } = Select;
const { TextArea } = Input;

const PricingSchemeManagementPage = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingScheme, setEditingScheme] = useState(null);
  const [form] = Form.useForm();

  // Mock data for now - will be replaced with API calls
  useEffect(() => {
    fetchSchemes();
  }, []);

  const fetchSchemes = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await apiService.getPricingSchemes();
      // setSchemes(response.data || []);
      
      // Mock data for demonstration
      setTimeout(() => {
        setSchemes([
          {
            id: 1,
            name: 'Standard Residential',
            displayName: 'Standard Residential Pricing',
            description: 'Basic pricing for residential projects',
            category: 'residential',
            formula: '(sqft * baseRate) + materialCost + laborCost',
            variables: {
              sqft: { type: 'number', required: true, description: 'Square footage' },
              baseRate: { type: 'number', default: 2.5, description: 'Base rate per sqft' },
              materialCost: { type: 'number', required: true, description: 'Material cost' },
              laborCost: { type: 'number', required: true, description: 'Labor cost' },
            },
            isActive: true,
            isPinProtected: false,
            createdAt: '2024-01-15T10:00:00Z',
          },
          {
            id: 2,
            name: 'Commercial Premium',
            displayName: 'Commercial Premium Pricing',
            description: 'Premium pricing for large commercial projects',
            category: 'commercial',
            formula: '(sqft * baseRate * multiplier) + materialCost + (laborHours * hourlyRate)',
            variables: {
              sqft: { type: 'number', required: true, description: 'Square footage' },
              baseRate: { type: 'number', default: 3.5, description: 'Base rate per sqft' },
              multiplier: { type: 'number', default: 1.2, description: 'Commercial multiplier' },
              materialCost: { type: 'number', required: true, description: 'Material cost' },
              laborHours: { type: 'number', required: true, description: 'Estimated labor hours' },
              hourlyRate: { type: 'number', default: 45, description: 'Hourly labor rate' },
            },
            isActive: true,
            isPinProtected: true,
            createdAt: '2024-01-10T09:00:00Z',
          },
          {
            id: 3,
            name: 'Exterior Specialty',
            displayName: 'Exterior Specialty Pricing',
            description: 'Specialized pricing for exterior work',
            category: 'exterior',
            formula: '(sqft * tierRate[tier]) + weatherProtectionCost + materialCost',
            variables: {
              sqft: { type: 'number', required: true, description: 'Square footage' },
              tier: { type: 'select', options: ['Good', 'Better', 'Best'], required: true },
              tierRate: { type: 'map', values: { Good: 2.0, Better: 2.8, Best: 3.5 } },
              weatherProtectionCost: { type: 'number', default: 150, description: 'Weather protection' },
              materialCost: { type: 'number', required: true, description: 'Material cost' },
            },
            isActive: true,
            isPinProtected: true,
            createdAt: '2024-01-05T08:00:00Z',
          },
        ]);
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error fetching pricing schemes:', error);
      message.error('Failed to fetch pricing schemes');
      setLoading(false);
    }
  };

  const showModal = (scheme = null) => {
    setEditingScheme(scheme);
    if (scheme) {
      form.setFieldsValue({
        name: scheme.name,
        displayName: scheme.displayName,
        description: scheme.description,
        category: scheme.category,
        formula: scheme.formula,
        isPinProtected: scheme.isPinProtected,
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      // TODO: Implement actual API calls
      // if (editingScheme) {
      //   await apiService.updatePricingScheme(editingScheme.id, values);
      //   message.success('Pricing scheme updated successfully');
      // } else {
      //   await apiService.createPricingScheme(values);
      //   message.success('Pricing scheme created successfully');
      // }

      message.success(editingScheme ? 'Pricing scheme updated' : 'Pricing scheme created');
      setModalVisible(false);
      form.resetFields();
      fetchSchemes();
    } catch (error) {
      console.error('Error saving scheme:', error);
      message.error('Failed to save pricing scheme');
    }
  };

  const handleDelete = async (id) => {
    try {
      // TODO: await apiService.deletePricingScheme(id);
      message.success('Pricing scheme deleted successfully');
      fetchSchemes();
    } catch (error) {
      console.error('Error deleting scheme:', error);
      message.error('Failed to delete pricing scheme');
    }
  };

  const columns = [
    {
      title: 'Display Name',
      dataIndex: 'displayName',
      key: 'displayName',
      sorter: (a, b) => a.displayName.localeCompare(b.displayName),
    },
    {
      title: 'Internal Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <code style={{ color: '#52c41a' }}>{name}</code>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      filters: [
        { text: 'Residential', value: 'residential' },
        { text: 'Commercial', value: 'commercial' },
        { text: 'Exterior', value: 'exterior' },
        { text: 'Interior', value: 'interior' },
      ],
      onFilter: (value, record) => record.category === value,
      render: (category) => {
        const colors = {
          residential: 'blue',
          commercial: 'purple',
          exterior: 'orange',
          interior: 'green',
        };
        return <Tag color={colors[category]}>{category}</Tag>;
      },
    },
    {
      title: 'Formula',
      dataIndex: 'formula',
      key: 'formula',
      ellipsis: true,
      render: (formula) => (
        <code style={{ color: '#faad14', fontSize: '12px' }}>{formula}</code>
      ),
    },
    {
      title: 'Protection',
      key: 'protection',
      render: (_, record) => (
        record.isPinProtected ? (
          <Tag color="red">PIN Protected</Tag>
        ) : (
          <Tag color="green">Open</Tag>
        )
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
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
            title="Delete pricing scheme"
            description="Are you sure? Tenants using this scheme will need reassignment."
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Pricing Scheme Management</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => showModal()}
        >
          Add Scheme
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="text-gray-600 text-sm mb-1">Total Schemes</div>
          <div className="text-3xl font-bold">{schemes.length}</div>
        </Card>

        <Card>
          <div className="text-gray-600 text-sm mb-1">Active Schemes</div>
          <div className="text-3xl font-bold text-green-500">
            {schemes.filter(s => s.isActive).length}
          </div>
        </Card>

        <Card>
          <div className="text-gray-600 text-sm mb-1">PIN Protected</div>
          <div className="text-3xl font-bold text-red-500">
            {schemes.filter(s => s.isPinProtected).length}
          </div>
        </Card>
      </div>

      <div className="mb-6 p-4 bg-blue-50 rounded border border-blue-200">
        <div className="flex items-center mb-2">
          <CalculatorOutlined className="text-blue-500 mr-2" />
          <h3 className="font-semibold">Formula Variables Guide:</h3>
        </div>
        <div className="text-sm text-gray-700">
          • <code>sqft</code> - Square footage of the project
          <br />
          • <code>baseRate</code> - Base rate per square foot
          <br />
          • <code>materialCost</code> - Total cost of materials
          <br />
          • <code>laborCost</code> / <code>laborHours</code> / <code>hourlyRate</code> - Labor calculations
          <br />
          • <code>tier</code> - Product tier (Good/Better/Best)
          <br />
          • <code>multiplier</code> - Adjustment factor (e.g., commercial multiplier)
          <br />
          • Custom variables can be defined per scheme
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={schemes}
        loading={loading}
        rowKey="id"
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingScheme ? 'Edit Pricing Scheme' : 'Add Pricing Scheme'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            category: 'residential',
            isPinProtected: false,
          }}
        >
          <Form.Item
            name="displayName"
            label="Display Name"
            rules={[{ required: true, message: 'Please enter display name' }]}
          >
            <Input placeholder="e.g., Standard Residential Pricing" />
          </Form.Item>

          <Form.Item
            name="name"
            label="Internal Name (Unique Key)"
            rules={[
              { required: true, message: 'Please enter internal name' },
              { pattern: /^[a-z_]+$/, message: 'Use lowercase letters and underscores only' }
            ]}
          >
            <Input placeholder="e.g., standard_residential" disabled={!!editingScheme} />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea rows={2} placeholder="Describe this pricing scheme..." />
          </Form.Item>

          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="residential">Residential</Option>
              <Option value="commercial">Commercial</Option>
              <Option value="exterior">Exterior</Option>
              <Option value="interior">Interior</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="formula"
            label="Pricing Formula"
            rules={[{ required: true, message: 'Please enter formula' }]}
            extra="Use variables like sqft, baseRate, materialCost, laborCost, etc."
          >
            <TextArea 
              rows={3} 
              placeholder="e.g., (sqft * baseRate) + materialCost + laborCost"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            name="isPinProtected"
            label="PIN Protection"
            extra="Require PIN/2FA to modify formula (owner-only control)"
          >
            <Select>
              <Option value={false}>No Protection</Option>
              <Option value={true}>PIN Protected</Option>
            </Select>
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
              }}>
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

export default PricingSchemeManagementPage;
