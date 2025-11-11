import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag, Badge, InputNumber } from 'antd';
import { CheckCircleOutlined, StopOutlined, UserOutlined, EyeOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { Option } = Select;

const TenantManagementPage = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await apiService.getTenants();
      setTenants(response.data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      message.error('Failed to fetch tenants');
    } finally {
      setLoading(false);
    }
  };

  const showEditModal = (tenant) => {
    setSelectedTenant(tenant);
    form.setFieldsValue({
      companyName: tenant.companyName,
      status: tenant.status,
      seatLimit: tenant.seatLimit || 5,
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      await apiService.updateTenant(selectedTenant.id, values);
      message.success('Tenant updated successfully');
      setModalVisible(false);
      form.resetFields();
      fetchTenants();
    } catch (error) {
      console.error('Error updating tenant:', error);
      message.error('Failed to update tenant');
    }
  };

  const handleActivate = async (id) => {
    try {
      await apiService.activateTenant(id);
      message.success('Tenant activated successfully');
      fetchTenants();
    } catch (error) {
      console.error('Error activating tenant:', error);
      message.error('Failed to activate tenant');
    }
  };

  const handleSuspend = async (id) => {
    try {
      await apiService.suspendTenant(id);
      message.success('Tenant suspended successfully');
      fetchTenants();
    } catch (error) {
      console.error('Error suspending tenant:', error);
      message.error('Failed to suspend tenant');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'green',
      suspended: 'red',
      trial: 'blue',
      cancelled: 'default',
    };
    return colors[status] || 'default';
  };

  const columns = [
    {
      title: 'Tenant Name',
      dataIndex: 'companyName',
      key: 'companyName',
      sorter: (a, b) => a.companyName.localeCompare(b.companyName),
    },
    
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Trial', value: 'trial' },
        { text: 'Suspended', value: 'suspended' },
        { text: 'Cancelled', value: 'cancelled' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status?.toUpperCase() || 'UNKNOWN'}
        </Tag>
      ),
    },
    {
      title: 'Users',
      key: 'users',
      render: (_, record) => (
        <Badge count={record.Users?.length || 0} showZero color="blue">
          <UserOutlined style={{ fontSize: 16, color: '#1890ff' }} />
        </Badge>
      ),
    },
    {
      title: 'Seat Limit',
      dataIndex: 'seatLimit',
      key: 'seatLimit',
      render: (limit) => limit || 5,
    },
    {
      title: 'Trial Ends',
      dataIndex: 'trialEndsAt',
      key: 'trialEndsAt',
      render: (date) => date ? new Date(date).toLocaleDateString('en-US',{
        'day': '2-digit',
        'month': 'short',
        'year': 'numeric'
      }) : '-',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString('en-US',{
        'day': '2-digit',
        'month': 'short',
        'year': 'numeric'
      }),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => showEditModal(record)}
            size="small"
          >
            Edit
          </Button>
          {record.status !== 'active' && (
            <Button
              icon={<CheckCircleOutlined />}
              onClick={() => handleActivate(record.id)}
              size="small"
              type="primary"
            >
              Activate
            </Button>
          )}
          {record.status === 'active' && (
            <Button
              icon={<StopOutlined />}
              onClick={() => handleSuspend(record.id)}
              size="small"
              danger
            >
              Suspend
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Tenant Management</h1>
      </div>

      <Table
        columns={columns}
        dataSource={tenants}
        loading={loading}
        rowKey="id"
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 20 }}
        expandable={{
          expandedRowRender: (record) => (
            <div className="bg-gray-50 p-4 rounded">
              <h3 className="mb-3 font-semibold">Users ({record.Users?.length || 0})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {record.Users?.map(user => (
                  <div key={user.id} className="p-3 bg-white rounded border border-gray-200">
                    <div className="font-semibold">{user.fullName}</div>
                    <div className="text-gray-600 text-sm">{user.email}</div>
                    <Tag color="blue" className="mt-2">{user.role}</Tag>
                    {user.isActive ? (
                      <Tag color="green">Active</Tag>
                    ) : (
                      <Tag color="red">Inactive</Tag>
                    )}
                  </div>
                )) || <div className="text-gray-500">No users found</div>}
              </div>
            </div>
          ),
          rowExpandable: (record) => record.Users && record.Users.length > 0,
        }}
      />

      <Modal
        title="Edit Tenant"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="companyName"
            label="Tenant Name"
            rules={[{ required: true, message: 'Please enter tenant name' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select status' }]}
          >
            <Select>
              <Option value="active">Active</Option>
              <Option value="trial">Trial</Option>
              <Option value="suspended">Suspended</Option>
              <Option value="cancelled">Cancelled</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="seatLimit"
            label="Seat Limit"
            rules={[{ required: true, message: 'Please enter seat limit' }]}
          >
            <InputNumber min={1} max={999} style={{ width: '100%' }} />
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
                Update
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TenantManagementPage;
