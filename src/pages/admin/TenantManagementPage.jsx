import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag, Badge, InputNumber } from 'antd';
import { CheckCircleOutlined, StopOutlined, UserOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { Option } = Select;

const TenantManagementPage = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [form] = Form.useForm();
  const [isMobile, setIsMobile] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const filteredTenants = tenants.filter(tenant => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      tenant.companyName?.toLowerCase().includes(search) ||
      tenant.subdomain?.toLowerCase().includes(search) ||
      tenant.status?.toLowerCase().includes(search)
    );
  });

  const columns = [
    {
      title: 'Tenant Name',
      dataIndex: 'companyName',
      key: 'companyName',
      width: isMobile ? 150 : undefined,
      sorter: (a, b) => a.companyName.localeCompare(b.companyName),
      ellipsis: true,
    },
    
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: isMobile ? 90 : undefined,
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
    ...(!isMobile ? [{
      title: 'Users',
      key: 'users',
      render: (_, record) => (
        <Badge count={record.Users?.length || 0} showZero color="blue">
          <UserOutlined style={{ fontSize: 16, color: '#1890ff' }} />
        </Badge>
      ),
    }] : []),
    ...(!isMobile ? [{
      title: 'Seat Limit',
      dataIndex: 'seatLimit',
      key: 'seatLimit',
      render: (limit) => limit || 5,
    }] : []),
    ...(!isMobile ? [{
      title: 'Trial Ends',
      dataIndex: 'trialEndsAt',
      key: 'trialEndsAt',
      render: (date) => date ? new Date(date).toLocaleDateString('en-US',{
        'day': '2-digit',
        'month': 'short',
        'year': 'numeric'
      }) : '-',
    }] : []),
    {
      title: 'Actions',
      key: 'actions',
      fixed: isMobile ? undefined : 'right',
      width: isMobile ? 100 : 200,
      render: (_, record) => (
        <Space direction={isMobile ? 'vertical' : 'horizontal'} size="small">
          <Button
            icon={<EyeOutlined />}
            onClick={() => showEditModal(record)}
            size="small"
            block={isMobile}
          >
            {!isMobile && 'Edit'}
          </Button>
          {record.status !== 'active' && (
            <Button
              icon={<CheckCircleOutlined />}
              onClick={() => handleActivate(record.id)}
              size="small"
              type="primary"
              block={isMobile}
            >
              {!isMobile && 'Activate'}
            </Button>
          )}
          {record.status === 'active' && (
            <Button
              icon={<StopOutlined />}
              onClick={() => handleSuspend(record.id)}
              size="small"
              danger
              block={isMobile}
            >
              {!isMobile && 'Suspend'}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Tenant Management</h1>
        <Input
          placeholder="Search tenants..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          className="w-full sm:w-64"
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredTenants}
        loading={loading}
        rowKey="id"
        scroll={{ x: isMobile ? 800 : 'max-content' }}
        pagination={{ pageSize: isMobile ? 10 : 20, simple: isMobile }}
        expandable={{
          expandedRowRender: (record) => (
            <div className="bg-gray-50 p-3 sm:p-4 rounded">
              <h3 className="mb-2 sm:mb-3 text-sm sm:text-base font-semibold">Users ({record.Users?.length || 0})</h3>
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
        width={isMobile ? '100%' : 500}
        style={isMobile ? { top: 0, maxWidth: '100%', paddingBottom: 0 } : {}}
        bodyStyle={isMobile ? { maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' } : {}}
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
            <Space className={isMobile ? 'w-full flex-col' : 'w-full justify-end'}>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
              }} block={isMobile}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" block={isMobile}>
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
