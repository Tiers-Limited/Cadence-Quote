import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, Select, Space,
  Card, Tabs, message, Typography, Tag, Dropdown, Row, Col
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  DragOutlined, LinkOutlined, EyeOutlined,
  MailOutlined, PhoneOutlined, FormOutlined
} from '@ant-design/icons';
import {apiService} from '../../services/apiService';

const { TabPane } = Tabs;
const { Text } = Typography;

const LeadFormBuilder = () => {
  const [forms, setForms] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [activeTab, setActiveTab] = useState('forms');
  const [form] = Form.useForm();
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchForms = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/lead-forms');
      if (response.success) {
        setForms(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch forms');
      console.error('Fetch forms error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/leads');
      if (response.success) {
        setLeads(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch leads');
      console.error('Fetch leads error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForms();
    fetchLeads();
  }, []);

  const showModal = (formData = null) => {
    setEditingForm(formData);
    if (formData) {
      form.setFieldsValue(formData);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingForm) {
        await apiService.put(`/lead-forms/${editingForm.id}`, values);
        message.success('Form updated successfully');
      } else {
        await apiService.post('/lead-forms', values);
        message.success('Form created successfully');
      }
      setModalVisible(false);
      fetchForms();
    } catch (error) {
      message.error('Failed to save form');
      console.error('Save form error:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.delete(`/lead-forms/${id}`);
      message.success('Form deleted successfully');
      fetchForms();
    } catch (error) {
      message.error('Failed to delete form');
      console.error('Delete form error:', error);
    }
  };

  const handleUpdateLeadStatus = async (leadId, status) => {
    try {
      await apiService.put(`/leads/${leadId}`, { status });
      message.success('Lead status updated');
      fetchLeads();
    } catch (error) {
      message.error('Failed to update lead status');
      console.error('Update lead status error:', error);
    }
  };
  const formColumns = [
    {
      title: 'Form Name',
      dataIndex: 'formName',
      key: 'formName',
      width: 150,
    },
    {
      title: 'Public Title',
      dataIndex: 'formTitle',
      key: 'formTitle',
      width: 150,
    },
    {
      title: 'Submissions',
      dataIndex: 'submissionCount',
      key: 'submissionCount',
      width: 120,
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, record) => (
        <Tag color={record.isActive ? 'green' : 'red'}>
          {record.isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          />
          <Button
            size="small"
            icon={<LinkOutlined />}
            onClick={() => {
              // Copy public URL to clipboard
              navigator.clipboard.writeText(globalThis.location.origin+"/public-form/"+record.publicUrl);
              message.success('Public URL copied to clipboard');
            }}
          />
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => window.open("/public-form/"+record.publicUrl, '_blank')}
          />
          <Button
            size="small"
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  const leadColumns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
      width: 120,
    },
    {
      title: 'Form',
      dataIndex: ['LeadForm', 'formTitle'],
      key: 'formTitle',
      width: 150,
    },
    {
      title: 'Contact',
      key: 'contact',
      width: 250,
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Text strong>{record.fullName}</Text>
          {record.email && (
            <Space size="small">
              <MailOutlined />
              <Text copyable className="text-xs">{record.email}</Text>
            </Space>
          )}
          {record.phone && (
            <Space size="small">
              <PhoneOutlined />
              <Text copyable className="text-xs">{record.phone}</Text>
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: 'Project',
      key: 'project',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Text className="text-xs">Type: {record.projectType?.replace('_', ' ').toUpperCase()}</Text>
          {record.homeSize && <Text className="text-xs">Size: {record.homeSize} sq ft</Text>}
          {record.ballparkQuote && <Text strong className="text-xs">Quote: ${record.ballparkQuote}</Text>}
        </Space>
      ),
    },
    {
      title: 'Details',
      key: 'details',
      width: 120,
      render: (_, record) => (
        <Button
          size="small"
          icon={<FormOutlined />}
          onClick={() => {
            // Parse photoUrls if it's a string
            let photoUrls = [];
            try {
              photoUrls = typeof record.photoUrls === 'string' 
                ? JSON.parse(record.photoUrls) 
                : (record.photoUrls || []);
            } catch (e) {
              photoUrls = [];
            }

            Modal.info({
              title: 'Lead Details',
              content: (
                <div className="space-y-3">
                  <Row gutter={[8, 8]}>
                    <Col span={24}>
                      <Text strong>Full Name: </Text>
                      <Text>{record.fullName}</Text>
                    </Col>
                    <Col span={24}>
                      <Text strong>Email: </Text>
                      <Text copyable>{record.email}</Text>
                    </Col>
                    <Col span={24}>
                      <Text strong>Phone: </Text>
                      <Text copyable>{record.phone}</Text>
                    </Col>
                  </Row>
                  {record.address && (
                    <div>
                      <Text strong>Address: </Text>
                      <Text>{record.address}</Text>
                    </div>
                  )}
                  {record.zipCode && (
                    <div>
                      <Text strong>Zip Code: </Text>
                      <Text>{record.zipCode}</Text>
                    </div>
                  )}
                  {record.homeSize && (
                    <div>
                      <Text strong>Home Size: </Text>
                      <Text>{record.homeSize} sq ft</Text>
                    </div>
                  )}
                  {record.roomCount && (
                    <div>
                      <Text strong>Room Count: </Text>
                      <Text>{record.roomCount}</Text>
                    </div>
                  )}
                  {record.projectType && (
                    <div>
                      <Text strong>Project Type: </Text>
                      <Text>{record.projectType.replace('_', ' ').toUpperCase()}</Text>
                    </div>
                  )}
                  {record.projectDetails && (
                    <div>
                      <Text strong>Project Details: </Text>
                      <Text>{record.projectDetails}</Text>
                    </div>
                  )}
                  {record.preferredContactMethod && (
                    <div>
                      <Text strong>Preferred Contact: </Text>
                      <Text>{record.preferredContactMethod}</Text>
                    </div>
                  )}
                  {record.bestTimeToContact && (
                    <div>
                      <Text strong>Best Time: </Text>
                      <Text>{record.bestTimeToContact}</Text>
                    </div>
                  )}
                  {record.timeline && (
                    <div>
                      <Text strong>Timeline: </Text>
                      <Text>{record.timeline}</Text>
                    </div>
                  )}
                  {record.referralSource && (
                    <div>
                      <Text strong>Referral Source: </Text>
                      <Text>{record.referralSource}</Text>
                    </div>
                  )}
                  {record.ballparkQuote && (
                    <div>
                      <Text strong>Ballpark Quote: </Text>
                      <Text>${record.ballparkQuote}</Text>
                    </div>
                  )}
                  {photoUrls.length > 0 && (
                    <div>
                      <Text strong>Photos: </Text>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {photoUrls.map((url, index) => (
                          <img 
                            key={index} 
                            src={url} 
                            alt={`Project ${index + 1}`}
                            className="w-full h-32 object-cover rounded"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ),
              width: isMobile ? '100%' : 700,
            });
          }}
        >
          View Details
        </Button>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const statusColors = {
          new: 'blue',
          contacted: 'orange',
          qualified: 'cyan',
          converted: 'green',
          lost: 'red',
        };
        
        return (
          <Dropdown
            menu={{
              items: [
                { key: 'new', label: 'New' },
                { key: 'contacted', label: 'Contacted' },
                { key: 'qualified', label: 'Qualified' },
                { key: 'converted', label: 'Converted' },
                { key: 'lost', label: 'Lost' },
              ],
              onClick: ({ key }) => handleUpdateLeadStatus(record.id, key),
            }}
          >
            <Tag color={statusColors[record.status]} style={{ cursor: 'pointer' }}>
              {record.status?.toUpperCase()}
            </Tag>
          </Dropdown>
        );
      },
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (source) => (
        <Tag color="green">{source?.toUpperCase()}</Tag>
      ),
    },
  ];

  const defaultFormFields = [
    {
      name: 'name',
      label: 'Full Name',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
    },
    {
      name: 'phone',
      label: 'Phone',
      type: 'tel',
      required: true,
    },
    {
      name: 'projectType',
      label: 'Project Type',
      type: 'select',
      options: ['Interior', 'Exterior', 'Both'],
      required: true,
    },
    {
      name: 'message',
      label: 'Project Details',
      type: 'textarea',
      required: false,
    },
  ];
  return (
    <div className="p-3 md:p-6">
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Lead Forms" key="forms">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h2 className="text-xl md:text-2xl font-semibold">Lead Forms</h2>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showModal()}
              block={isMobile}
            >
              Create Form
            </Button>
          </div>

          <Table
            columns={formColumns}
            dataSource={forms}
            loading={loading}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: isMobile ? 10 : 20 }}
          />
        </TabPane>

        <TabPane tab="Leads" key="leads">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h2 className="text-xl md:text-2xl font-semibold">Lead Management</h2>
          </div>

          <Table
            columns={leadColumns}
            dataSource={leads}
            loading={loading}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: isMobile ? 10 : 20 }}
          />
        </TabPane>
      </Tabs>

      <Modal
        title={editingForm ? 'Edit Lead Form' : 'Create Lead Form'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={isMobile ? '100%' : 800}
        style={isMobile ? { top: 0, paddingBottom: 0, maxWidth: '100vw' } : {}}
        styles={isMobile ? { body: { maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' } } : {}}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            fields: defaultFormFields,
          }}
        >
          <Row gutter={isMobile ? 0 : 16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="formName"
                label="Internal Form Name"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="formTitle"
                label="Public Form Title"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="formDescription"
            label="Form Description"
          >
            <Input.TextArea rows={isMobile ? 2 : 3} />
          </Form.Item>

          <Row gutter={isMobile ? 0 : 16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="redirectUrl"
                label="Success Redirect URL"
              >
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="notificationEmails"
                label="Notification Emails"
                help="Comma-separated email addresses"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="isActive"
            valuePropName="checked"
            label="Active"
          >
            <Select>
              <Select.Option value={true}>Active</Select.Option>
              <Select.Option value={false}>Inactive</Select.Option>
            </Select>
          </Form.Item>

          <Card title="Form Fields" className="mb-4" size={isMobile ? 'small' : 'default'}>
            <div className="space-y-2">
              {defaultFormFields.map((field, index) => (
                <Card key={index} size="small" className="bg-gray-50">
                  <div className="flex items-center justify-between">
                    <Space size="small">
                      <DragOutlined className="text-gray-400" />
                      <div>
                        <div className="font-medium text-sm">{field.label}</div>
                        <div className="text-xs text-gray-500">
                          Type: {field.type}
                          {field.required && ' • Required'}
                        </div>
                      </div>
                    </Space>
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end" size={isMobile ? 'small' : 'middle'}>
              <Button onClick={() => setModalVisible(false)} block={isMobile}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" block={isMobile}>
                {editingForm ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LeadFormBuilder;