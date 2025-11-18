import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag, Popconfirm, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalculatorOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { Option } = Select;
const { TextArea } = Input;

const PricingSchemeManagementPage = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [settingDefault, setSettingDefault] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinSetupModalVisible, setPinSetupModalVisible] = useState(false);
  const [editingScheme, setEditingScheme] = useState(null);
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [form] = Form.useForm();
  const [pinForm] = Form.useForm();
  const [pinSetupForm] = Form.useForm();
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
        // Don't include protection fields when editing - they can't be changed
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        isPinProtected: false,
        protectionMethod: 'pin',
      });
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      // If editing a scheme
      if (editingScheme) {
        // If the scheme is protected, require PIN verification
        if (editingScheme.isPinProtected) {
          setPendingUpdate(values);
          setPinModalVisible(true);
          return;
        }
        // Not protected, submit directly
        await submitScheme(values);
        return;
      }

      // Creating new scheme - check if enabling protection
      const isEnablingProtection = values.isPinProtected;

      if (isEnablingProtection) {
        setPinSetupModalVisible(true);
        setPendingUpdate(values);
        return;
      }

      // No protection, submit directly
      await submitScheme(values);
    } catch (error) {
      console.error('Error saving scheme:', error);
      message.error(error.message || 'Failed to save pricing scheme');
    }
  };

  const submitScheme = async (values, verificationPin = null) => {
    setSubmitting(true);
    try {
      const data = {
        name: values.name,
        type: values.category, // Backend uses 'type' field
        description: values.description || '',
        isActive: true,
        pricingRules: {
          formula: values.formula,
        },
        isPinProtected: values.isPinProtected || false,
        protectionMethod: values.isPinProtected ? 'pin' : null,
      };

      // Only include protectionPin when creating a new protected scheme or changing the PIN
      if (values.protectionPin) {
        data.protectionPin = values.protectionPin;
      }

      const customHeaders = verificationPin ? { 'x-verification-pin': verificationPin } : {};

      if (editingScheme) {
        await apiService.updatePricingScheme(editingScheme.id, data, customHeaders);
        message.success('Pricing scheme updated successfully');
      } else {
        await apiService.createPricingScheme(data);
        message.success('Pricing scheme created successfully');
      }

      setModalVisible(false);
      setPinModalVisible(false);
      setPinSetupModalVisible(false);
      form.resetFields();
      pinForm.resetFields();
      pinSetupForm.resetFields();
      setPendingUpdate(null);
      fetchSchemes();
    } catch (error) {
      console.error('Submit scheme error:', error);
      
      if (error.response?.data?.requiresPin) {
        message.error('Invalid PIN. Please try again.');
      } else if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else if (error.message) {
        message.error(error.message);
      } else {
        message.error(`Failed to ${editingScheme ? 'update' : 'create'} pricing scheme`);
      }
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const handlePinVerification = async (values) => {
    setVerifying(true);
    try {
      await submitScheme(pendingUpdate, values.verificationPin);
    } catch (error) {
      // Error already handled in submitScheme
    } finally {
      setVerifying(false);
    }
  };

  const handlePinSetup = async (values) => {
    if (values.protectionPin !== values.confirmPin) {
      message.error('PINs do not match');
      return;
    }

    const updatedValues = {
      ...pendingUpdate,
      protectionPin: values.protectionPin,
    };

    try {
      await submitScheme(updatedValues);
    } catch (error) {
      // Error already handled in submitScheme
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await apiService.deletePricingScheme(id);
      message.success('Pricing scheme deleted successfully');
      fetchSchemes();
    } catch (error) {
      console.error('Error deleting scheme:', error);
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else if (error.message) {
        message.error(error.message);
      } else {
        message.error('Failed to delete pricing scheme');
      }
    } finally {
      setDeleting(null);
    }
  };

  const handleSetDefault = async (id) => {
    setSettingDefault(id);
    try {
      await apiService.setDefaultPricingScheme(id);
      message.success('Default pricing scheme updated');
      fetchSchemes();
    } catch (error) {
      console.error('Error setting default scheme:', error);
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else if (error.message) {
        message.error(error.message);
      } else {
        message.error('Failed to set default scheme');
      }
    } finally {
      setSettingDefault(null);
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
          <div style={{ display: 'flex', gap: '4px', marginTop: 4, flexWrap: 'wrap' }}>
            {record.isDefault && (
              <Tag color="gold">Default</Tag>
            )}
            {record.isPinProtected && (
              <Tag color="purple" style={{ fontSize: '11px' }}>
                🔒 PIN
              </Tag>
            )}
          </div>
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
              loading={settingDefault === record.id}
              disabled={settingDefault !== null || loading}
            >
              Set Default
            </Button>
          )}
          <Button
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
            size="small"
            block={isMobile}
            disabled={settingDefault !== null || deleting !== null || loading}
          >
            {isMobile && 'Edit'}
          </Button>
          <Popconfirm
            title="Delete pricing scheme"
            description="Are you sure?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
            disabled={deleting !== null || settingDefault !== null || loading}
          >
            <Button 
              icon={<DeleteOutlined />} 
              danger 
              size="small" 
              block={isMobile}
              loading={deleting === record.id}
              disabled={deleting !== null || settingDefault !== null || loading}
            />
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
            extra="Require PIN to modify this pricing scheme (cannot be changed after creation)"
          >
            <Select disabled={!!editingScheme}>
              <Option value={false}>No Protection</Option>
              <Option value={true}>Enable PIN Protection</Option>
            </Select>
          </Form.Item>

          {editingScheme?.isPinProtected && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                🔒 This scheme is protected with <strong>PIN</strong>. 
                Protection settings cannot be modified after creation.
              </p>
            </div>
          )}

          <Form.Item className="mb-0">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 w-full sm:justify-end">
              <Button 
                onClick={() => {
                  setModalVisible(false);
                  form.resetFields();
                }}
                block={isMobile}
                className="order-2 sm:order-1"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                block={isMobile}
                className="order-1 sm:order-2 sm:ml-2"
                loading={submitting}
                disabled={submitting}
              >
                {editingScheme ? 'Update' : 'Create'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* PIN Verification Modal */}
      <Modal
        title="Verify PIN"
        open={pinModalVisible}
        onCancel={() => {
          setPinModalVisible(false);
          pinForm.resetFields();
        }}
        footer={null}
        width={isMobile ? '100%' : 400}
      >
        <Form
          form={pinForm}
          layout="vertical"
          onFinish={handlePinVerification}
        >
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              This pricing scheme is PIN protected. 
              Please enter your PIN to make changes.
            </p>
          </div>

          <Form.Item
            name="verificationPin"
            label="Enter PIN"
            rules={[
              { required: true, message: 'Please enter your PIN' },
              { min: 4, message: 'PIN must be at least 4 characters' }
            ]}
          >
            <Input.Password
              placeholder="Enter your PIN"
              maxLength={6}
              autoComplete="off"
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <div className="flex gap-2 w-full justify-end">
              <Button 
                onClick={() => {
                  setPinModalVisible(false);
                  pinForm.resetFields();
                }}
                disabled={verifying}
              >
                Cancel
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={verifying}
                disabled={verifying}
              >
                Verify & Continue
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* PIN Setup Modal */}
      <Modal
        title="Set Up PIN Protection"
        open={pinSetupModalVisible}
        onCancel={() => {
          setPinSetupModalVisible(false);
          pinSetupForm.resetFields();
        }}
        footer={null}
        width={isMobile ? '100%' : 500}
      >
        <Form
          form={pinSetupForm}
          layout="vertical"
          onFinish={handlePinSetup}
        >
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">
              Set a PIN to protect this pricing scheme from unauthorized modifications.
              You'll need to enter this PIN whenever you want to edit this scheme.
            </p>
          </div>

          <Form.Item
            name="protectionPin"
            label="Create PIN"
            rules={[
              { required: true, message: 'Please enter a PIN' },
              { min: 4, message: 'PIN must be at least 4 characters' },
              { max: 6, message: 'PIN must be at most 6 characters' },
              { pattern: /^\d+$/, message: 'PIN must contain only numbers' }
            ]}
          >
            <Input.Password
              placeholder="Enter 4-6 digit PIN"
              maxLength={6}
              autoComplete="off"
            />
          </Form.Item>

          <Form.Item
            name="confirmPin"
            label="Confirm PIN"
            dependencies={['protectionPin']}
            rules={[
              { required: true, message: 'Please confirm your PIN' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('protectionPin') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('PINs do not match'));
                },
              }),
            ]}
          >
            <Input.Password
              placeholder="Re-enter PIN"
              maxLength={6}
              autoComplete="off"
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <div className="flex gap-2 w-full justify-end">
              <Button 
                onClick={() => {
                  setPinSetupModalVisible(false);
                  pinSetupForm.resetFields();
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={submitting}
                disabled={submitting}
              >
                Set PIN & Save
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PricingSchemeManagementPage;
