import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, Select, Space,
  Card, Tabs, message, Typography, Tag, Dropdown
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

  const fetchForms = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/lead-forms');
      if (response.success) {
        setForms(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch forms');
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
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.delete(`/lead-forms/${id}`);
      message.success('Form deleted successfully');
      fetchForms();
    } catch (error) {
      message.error('Failed to delete form');
    }
  };

  const handleUpdateLeadStatus = async (leadId, status) => {
    try {
      await apiService.put(`/leads/${leadId}`, { status });
      message.success('Lead status updated');
      fetchLeads();
    } catch (error) {
      message.error('Failed to update lead status');
    }
  };

  const formColumns = [
    {
      title: 'Form Name',
      dataIndex: 'formName',
      key: 'formName',
    },
    {
      title: 'Public Title',
      dataIndex: 'formTitle',
      key: 'formTitle',
    },
    {
      title: 'Submissions',
      dataIndex: 'submissionCount',
      key: 'submissionCount',
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <Tag color={record.isActive ? 'green' : 'red'}>
          {record.isActive ? 'Active' : 'Inactive'}
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
            icon={<LinkOutlined />}
            onClick={() => {
              // Copy public URL to clipboard
              navigator.clipboard.writeText(record.publicUrl);
              message.success('Public URL copied to clipboard');
            }}
          />
          <Button
            icon={<EyeOutlined />}
            onClick={() => window.open(record.publicUrl, '_blank')}
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

  const leadColumns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Form',
      dataIndex: ['form', 'formName'],
      key: 'formName',
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record) => {
        const data = record.data || {};
        return (
          <Space direction="vertical" size="small">
            <Space>
              <Text>{data.name}</Text>
            </Space>
            {data.email && (
              <Space>
                <MailOutlined />
                <Text>{data.email}</Text>
              </Space>
            )}
            {data.phone && (
              <Space>
                <PhoneOutlined />
                <Text>{data.phone}</Text>
              </Space>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <Button
          icon={<FormOutlined />}
          onClick={() => {
            Modal.info({
              title: 'Lead Details',
              content: (
                <div>
                  {Object.entries(record.data || {}).map(([key, value]) => (
                    <div key={key} className="mb-2">
                      <Text strong>{key}: </Text>
                      <Text>{value}</Text>
                    </div>
                  ))}
                </div>
              ),
              width: 600,
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
      title: 'Follow Up',
      dataIndex: 'followUpDate',
      key: 'followUpDate',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
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
    <div className="p-6">
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Lead Forms" key="forms">
          <div className="flex justify-between mb-4">
            <h2 className="text-2xl font-semibold">Lead Forms</h2>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showModal()}
            >
              Create Form
            </Button>
          </div>

          <Table
            columns={formColumns}
            dataSource={forms}
            loading={loading}
            rowKey="id"
          />
        </TabPane>

        <TabPane tab="Leads" key="leads">
          <div className="flex justify-between mb-4">
            <h2 className="text-2xl font-semibold">Lead Management</h2>
          </div>

          <Table
            columns={leadColumns}
            dataSource={leads}
            loading={loading}
            rowKey="id"
          />
        </TabPane>
      </Tabs>

      <Modal
        title={editingForm ? 'Edit Lead Form' : 'Create Lead Form'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
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
          <Form.Item
            name="formName"
            label="Internal Form Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="formTitle"
            label="Public Form Title"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="formDescription"
            label="Form Description"
          >
            <Input.TextArea />
          </Form.Item>

          <Form.Item
            name="redirectUrl"
            label="Success Redirect URL"
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="notificationEmails"
            label="Notification Emails"
            help="Comma-separated email addresses"
          >
            <Input />
          </Form.Item>

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

          <Card title="Form Fields" className="mb-4">
            <div className="space-y-4">
              {defaultFormFields.map((field, index) => (
                <Card key={index} size="small" className="bg-gray-50">
                  <div className="flex items-center justify-between">
                    <Space>
                      <DragOutlined className="text-gray-400" />
                      <div>
                        <div className="font-medium">{field.label}</div>
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
            <Space className="w-full justify-end">
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
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