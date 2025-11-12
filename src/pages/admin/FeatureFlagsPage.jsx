import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag, Switch, InputNumber, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { Option } = Select;
const { TextArea } = Input;

const FeatureFlagsPage = () => {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [form] = Form.useForm();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      setLoading(true);
      const response = await apiService.getFeatureFlags();
      setFeatures(response.data || []);
    } catch (error) {
      console.error('Error fetching features:', error);
      message.error('Failed to fetch feature flags');
    } finally {
      setLoading(false);
    }
  };

  const showModal = (feature = null) => {
    setEditingFeature(feature);
    if (feature) {
      form.setFieldsValue({
        name: feature.name,
        displayName: feature.displayName,
        description: feature.description,
        category: feature.category,
        isEnabled: feature.isEnabled,
        isPaid: feature.isPaid,
        priceMonthly: feature.priceMonthly,
        priceYearly: feature.priceYearly,
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingFeature) {
        await apiService.updateFeatureFlag(editingFeature.id, values);
        message.success('Feature flag updated successfully');
      } else {
        await apiService.createFeatureFlag(values);
        message.success('Feature flag created successfully');
      }

      setModalVisible(false);
      form.resetFields();
      fetchFeatures();
    } catch (error) {
      console.error('Error saving feature:', error);
      message.error(error.message || 'Failed to save feature flag');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.deleteFeatureFlag(id);
      message.success('Feature flag deleted successfully');
      fetchFeatures();
    } catch (error) {
      console.error('Error deleting feature:', error);
      message.error('Failed to delete feature flag');
    }
  };

  const handleToggle = async (feature) => {
    try {
      await apiService.updateFeatureFlag(feature.id, {
        isEnabled: !feature.isEnabled,
      });
      message.success(`Feature ${!feature.isEnabled ? 'enabled' : 'disabled'}`);
      fetchFeatures();
    } catch (error) {
      console.error('Error toggling feature:', error);
      message.error('Failed to toggle feature');
    }
  };

  const columns = [
    {
      title: 'Enabled',
      key: 'enabled',
      width: isMobile ? 150 : 100,
      render: (_, record) => (
        <Switch
          checked={record.isEnabled}
          onChange={() => handleToggle(record)}
          
        />
      ),
    },
    {
      title: 'Display Name',
      dataIndex: 'displayName',
      key: 'displayName',
      width: isMobile ? 150 : undefined,
      sorter: (a, b) => a.displayName.localeCompare(b.displayName),
      ellipsis: true,
    },
    ...(!isMobile ? [{
      title: 'Internal Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <code style={{ color: '#52c41a' }}>{name}</code>,
    }] : []),
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: isMobile ? 80 : undefined,
      filters: !isMobile ? [
        { text: 'Feature', value: 'feature' },
        { text: 'Add-on', value: 'addon' },
        { text: 'Integration', value: 'integration' },
      ] : undefined,
      onFilter: (value, record) => record.category === value,
      render: (category) => {
        const colors = {
          feature: 'blue',
          addon: 'purple',
          integration: 'orange',
        };
        return <Tag color={colors[category]}>{category}</Tag>;
      },
    },
    {
      title: 'Pricing',
      key: 'pricing',
      width: isMobile ? 70 : undefined,
      render: (_, record) => {
        if (!record.isPaid) {
          return <Tag color="green">Free</Tag>;
        }
        return (
          <div className={isMobile ? 'text-xs' : ''}>
            {record.priceMonthly && (
              <div className={isMobile ? 'text-xs' : 'text-sm text-gray-400'}>
                ${record.priceMonthly}/mo
              </div>
            )}
            {record.priceYearly && (
              <div className={isMobile ? 'text-xs' : 'text-sm text-gray-400'}>
                ${record.priceYearly}/yr
              </div>
            )}
          </div>
        );
      },
    },
    ...(!isMobile ? [{
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    }] : []),
    {
      title: 'Actions',
      key: 'actions',
      fixed: isMobile ? undefined : 'right',
      width: isMobile ? 100 : 120,
      render: (_, record) => (
        <Space size="small" direction={isMobile ? 'vertical' : 'horizontal'}>
          <Button
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
            size="small"
            block={isMobile}
          >
            {isMobile && 'Edit'}
          </Button>
          <Popconfirm
            title="Delete feature flag"
            description="Are you sure? This will affect all tenants using this feature."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<DeleteOutlined />} danger size="small" block={isMobile} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Feature Flags & Add-ons</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => showModal()}
          block={isMobile}
        >
          Add Feature
        </Button>
      </div>

      <div className="mb-4 p-3 sm:p-4 bg-blue-50 rounded border border-blue-200">
        <h3 className="mb-2 text-sm sm:text-base font-semibold">Available Add-ons:</h3>
        <div className="text-xs sm:text-sm text-gray-700">
          • Color Portal - Advanced color management and visualization
          <br />
          • Multi-User Access - Enable multiple users per tenant
          <br />
          • DIY Mode - Self-service mode for customers
          <br />
          • Advanced Analytics - Detailed reporting dashboard
          <br />
          • API Access - RESTful API for integrations
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={features}
        loading={loading}
        rowKey="id"
        scroll={{ x: isMobile ? 600 : 'max-content' }}
        pagination={{ 
          pageSize: isMobile ? 10 : 20,
          simple: isMobile 
        }}
      />

      <Modal
        title={editingFeature ? 'Edit Feature Flag' : 'Add Feature Flag'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={isMobile ? '100%' : 600}
        style={isMobile ? { top: 0, maxWidth: '100%', paddingBottom: 0 } : {}}
        bodyStyle={isMobile ? { maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' } : {}}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            category: 'feature',
            isEnabled: false,
            isPaid: false,
          }}
        >
          <Form.Item
            name="displayName"
            label="Display Name"
            rules={[{ required: true, message: 'Please enter display name' }]}
          >
            <Input placeholder="e.g., Color Portal" />
          </Form.Item>

          <Form.Item
            name="name"
            label="Internal Name (Unique Key)"
            rules={[
              { required: true, message: 'Please enter internal name' },
              { pattern: /^[a-z_]+$/, message: 'Use lowercase letters and underscores only' }
            ]}
          >
            <Input placeholder="e.g., color_portal" disabled={!!editingFeature} />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea rows={3} placeholder="Describe this feature..." />
          </Form.Item>

          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="feature">Feature</Option>
              <Option value="addon">Add-on</Option>
              <Option value="integration">Integration</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="isEnabled"
            label="Enable Globally"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="isPaid"
            label="Paid Feature"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="priceMonthly"
              label="Monthly Price ($)"
            >
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="priceYearly"
              label="Yearly Price ($)"
            >
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                {editingFeature ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FeatureFlagsPage;
