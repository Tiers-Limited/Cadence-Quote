import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag, Popconfirm, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalculatorOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { Option } = Select;
const { TextArea } = Input;

const PricingSchemeManagementPage = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingScheme, setEditingScheme] = useState(null);
  const [form] = Form.useForm();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mock data for now - will be replaced with API calls
  useEffect(() => {
    fetchSchemes();
  }, []);

  const fetchSchemes = async () => {
    try {
      setLoading(true);
      const response = await apiService.getPricingSchemes();
      setSchemes(response.data || []);
    } catch (error) {
      console.error('Error fetching pricing schemes:', error);
      message.error('Failed to fetch pricing schemes');
    } finally {
      setLoading(false);
    }
  };

  const showModal = (scheme = null) => {
    setEditingScheme(scheme);
    if (scheme) {
      form.setFieldsValue({
        name: scheme.name,
        description: scheme.description,
        category: scheme.type, // Backend uses 'type' field
        formula: scheme.pricingRules?.formula || '',
        isPinProtected: scheme.pricingRules?.isPinProtected || false,
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        name: values.name,
        type: values.category, // Backend uses 'type' field
        description: values.description || '',
        isActive: true,
        pricingRules: {
          formula: values.formula,
          isPinProtected: values.isPinProtected || false,
        },
      };

      if (editingScheme) {
        await apiService.updatePricingScheme(editingScheme.id, data);
        message.success('Pricing scheme updated successfully');
      } else {
        await apiService.createPricingScheme(data);
        message.success('Pricing scheme created successfully');
      }

      setModalVisible(false);
      form.resetFields();
      fetchSchemes();
    } catch (error) {
      console.error('Error saving scheme:', error);
      message.error(error.message || 'Failed to save pricing scheme');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.deletePricingScheme(id);
      message.success('Pricing scheme deleted successfully');
      fetchSchemes();
    } catch (error) {
      console.error('Error deleting scheme:', error);
      message.error(error.message || 'Failed to delete pricing scheme');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await apiService.setDefaultPricingScheme(id);
      message.success('Default pricing scheme updated');
      fetchSchemes();
    } catch (error) {
      console.error('Error setting default scheme:', error);
      message.error('Failed to set default scheme');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: isMobile ? 150 : undefined,
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          {record.isDefault && (
            <Tag color="gold" style={{ marginTop: 4 }}>Default</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: isMobile ? 100 : undefined,
      render: (type) => {
        const typeLabels = {
          sqft_turnkey: 'Sq Ft (Turnkey)',
          sqft_labor_paint: 'Sq Ft (Labor + Paint)',
          hourly_time_materials: 'Hourly (T&M)',
          unit_pricing: 'Unit Pricing',
          room_flat_rate: 'Room/Flat Rate',
        };
        const colors = {
          sqft_turnkey: 'blue',
          sqft_labor_paint: 'cyan',
          hourly_time_materials: 'purple',
          unit_pricing: 'orange',
          room_flat_rate: 'green',
        };
        return <Tag color={colors[type] || 'default'}>{typeLabels[type] || type}</Tag>;
      },
    },
    ...(!isMobile ? [{
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    }] : []),
    ...(!isMobile ? [{
      title: 'Formula',
      key: 'formula',
      ellipsis: true,
      render: (_, record) => (
        <code style={{ color: '#faad14', fontSize: '11px' }}>
          {record.pricingRules?.formula || 'N/A'}
        </code>
      ),
    }] : []),
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: isMobile ? 80 : undefined,
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: isMobile ? undefined : 'right',
      width: isMobile ? 100 : 120,
      render: (_, record) => (
        <Space size="small" direction={isMobile ? 'vertical' : 'horizontal'}>
          {!record.isDefault && (
            <Button
              size="small"
              onClick={() => handleSetDefault(record.id)}
              title="Set as default"
            >
              Set Default
            </Button>
          )}
          <Button
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
            size="small"
            block={isMobile}
          >
            {isMobile && 'Edit'}
          </Button>
          <Popconfirm
            title="Delete pricing scheme"
            description="Are you sure?"
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
        <h1 className="text-2xl sm:text-3xl font-bold">Pricing Scheme Management</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => showModal()}
          block={isMobile}
        >
          Add Scheme
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Card>
          <div className="text-gray-600 text-xs sm:text-sm mb-1">Total Schemes</div>
          <div className="text-2xl sm:text-3xl font-bold">{schemes.length}</div>
        </Card>

        <Card>
          <div className="text-gray-600 text-xs sm:text-sm mb-1">Active Schemes</div>
          <div className="text-2xl sm:text-3xl font-bold text-green-500">
            {schemes.filter(s => s.isActive).length}
          </div>
        </Card>

        <Card>
          <div className="text-gray-600 text-xs sm:text-sm mb-1">Default Scheme</div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-500">
            {schemes.find(s => s.isDefault)?.name || 'None'}
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
        scroll={{ x: isMobile ? 700 : 'max-content' }}
        pagination={{ 
          pageSize: isMobile ? 10 : 20,
          simple: isMobile 
        }}
      />

      <Modal
        title={editingScheme ? 'Edit Pricing Scheme' : 'Add Pricing Scheme'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={isMobile ? '100%' : 700}
        style={isMobile ? { top: 0, maxWidth: '100%', paddingBottom: 0 } : {}}
        bodyStyle={isMobile ? { maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' } : {}}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            category: 'sqft_turnkey',
            isPinProtected: false,
          }}
        >
          <Form.Item
            name="name"
            label="Scheme Name"
            rules={[
              { required: true, message: 'Please enter scheme name' },
              { max: 100, message: 'Name must be less than 100 characters' }
            ]}
          >
            <Input placeholder="e.g., Standard Residential Pricing" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea rows={2} placeholder="Describe this pricing scheme..." />
          </Form.Item>

          <Form.Item
            name="category"
            label="Pricing Type"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="sqft_turnkey">Square Foot (Turnkey, All-In)</Option>
              <Option value="sqft_labor_paint">Square Foot (Labor + Paint Separated)</Option>
              <Option value="hourly_time_materials">Hourly Rate (Time & Materials)</Option>
              <Option value="unit_pricing">Unit Pricing (Doors, Windows, Trim, etc.)</Option>
              <Option value="room_flat_rate">Room-Based / Flat Rate</Option>
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
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 w-full sm:justify-end">
              <Button 
                onClick={() => {
                  setModalVisible(false);
                  form.resetFields();
                }}
                block={isMobile}
                className="order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                block={isMobile}
                className="order-1 sm:order-2 sm:ml-2"
              >
                {editingScheme ? 'Update' : 'Create'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PricingSchemeManagementPage;
