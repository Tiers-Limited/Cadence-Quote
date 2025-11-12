import { useState, useEffect } from 'react';
import { Table, Button, Modal, message, Space, Tag, Card, Descriptions, Tabs } from 'antd';
import { CreditCardOutlined, DollarOutlined, HistoryOutlined, TeamOutlined } from '@ant-design/icons';

const StripeBillingPage = () => {
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activeTab, setActiveTab] = useState('subscriptions');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mock data for demonstration
  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API calls
      // const subsResponse = await apiService.getStripeSubscriptions();
      // const paymentsResponse = await apiService.getStripePayments();
      
      // Mock subscriptions data
      setTimeout(() => {
        setSubscriptions([
          {
            id: 'sub_1',
            tenantId: 1,
            tenantName: 'Acme Painting Co',
            customerEmail: 'admin@acmepainting.com',
            plan: 'Professional Plan',
            status: 'active',
            amount: 99.00,
            interval: 'month',
            currentPeriodStart: '2024-01-01T00:00:00Z',
            currentPeriodEnd: '2024-02-01T00:00:00Z',
            cancelAtPeriodEnd: false,
            seats: 5,
            addons: ['Color Portal', 'Multi-User Access'],
          },
          {
            id: 'sub_2',
            tenantId: 2,
            tenantName: 'Elite Contractors LLC',
            customerEmail: 'billing@elitecontractors.com',
            plan: 'Enterprise Plan',
            status: 'active',
            amount: 299.00,
            interval: 'year',
            currentPeriodStart: '2023-12-15T00:00:00Z',
            currentPeriodEnd: '2024-12-15T00:00:00Z',
            cancelAtPeriodEnd: false,
            seats: 20,
            addons: ['Color Portal', 'Multi-User Access', 'API Access', 'Advanced Analytics'],
          },
          {
            id: 'sub_3',
            tenantId: 3,
            tenantName: 'Premium Painting Services',
            customerEmail: 'owner@premiumpainting.com',
            plan: 'Basic Plan',
            status: 'trialing',
            amount: 49.00,
            interval: 'month',
            currentPeriodStart: '2024-01-20T00:00:00Z',
            currentPeriodEnd: '2024-02-20T00:00:00Z',
            cancelAtPeriodEnd: false,
            seats: 2,
            addons: [],
          },
        ]);

        setPayments([
          {
            id: 'pi_1',
            tenantName: 'Acme Painting Co',
            amount: 99.00,
            status: 'succeeded',
            created: '2024-01-01T10:30:00Z',
            description: 'Professional Plan - Monthly',
          },
          {
            id: 'pi_2',
            tenantName: 'Elite Contractors LLC',
            amount: 299.00,
            status: 'succeeded',
            created: '2023-12-15T14:20:00Z',
            description: 'Enterprise Plan - Yearly',
          },
          {
            id: 'pi_3',
            tenantName: 'Acme Painting Co',
            amount: 99.00,
            status: 'succeeded',
            created: '2023-12-01T10:30:00Z',
            description: 'Professional Plan - Monthly',
          },
        ]);

        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error fetching billing data:', error);
      message.error('Failed to fetch billing data');
      setLoading(false);
    }
  };

  const subscriptionColumns = [
    {
      title: 'Tenant',
      dataIndex: 'tenantName',
      key: 'tenantName',
      width: isMobile ? 150 : undefined,
      sorter: (a, b) => a.tenantName.localeCompare(b.tenantName),
      ellipsis: true,
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      key: 'plan',
      width: isMobile ? 120 : undefined,
      render: (plan) => <strong style={{ color: '#1890ff', fontSize: isMobile ? '12px' : '14px' }}>{plan}</strong>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: isMobile ? 80 : undefined,
      filters: !isMobile ? [
        { text: 'Active', value: 'active' },
        { text: 'Trialing', value: 'trialing' },
        { text: 'Past Due', value: 'past_due' },
        { text: 'Canceled', value: 'canceled' },
      ] : undefined,
      onFilter: (value, record) => record.status === value,
      render: (status) => {
        const colors = {
          active: 'green',
          trialing: 'blue',
          past_due: 'orange',
          canceled: 'red',
        };
        return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Amount',
      key: 'amount',
      width: isMobile ? 90 : undefined,
      render: (_, record) => (
        <span style={{ color: '#52c41a', fontWeight: 'bold', fontSize: isMobile ? '11px' : '14px' }}>
          ${record.amount.toFixed(2)}/{record.interval}
        </span>
      ),
    },
    ...(!isMobile ? [{
      title: 'Seats',
      dataIndex: 'seats',
      key: 'seats',
      render: (seats) => (
        <Tag icon={<TeamOutlined />} color="purple">{seats}</Tag>
      ),
    },
    {
      title: 'Add-ons',
      dataIndex: 'addons',
      key: 'addons',
      render: (addons) => (
        <div>
          {addons.length === 0 ? (
            <span style={{ color: '#666' }}>None</span>
          ) : (
            addons.map((addon, idx) => (
              <Tag key={idx} color="blue" style={{ marginBottom: 4 }}>
                {addon}
              </Tag>
            ))
          )}
        </div>
      ),
    },
    {
      title: 'Current Period',
      key: 'period',
      render: (_, record) => (
        <div style={{ fontSize: '12px', color: '#999' }}>
          {new Date(record.currentPeriodStart).toLocaleDateString()} - 
          {new Date(record.currentPeriodEnd).toLocaleDateString()}
        </div>
      ),
    }] : []),
    {
      title: 'Actions',
      key: 'actions',
      fixed: isMobile ? undefined : 'right',
      width: isMobile ? 80 : 120,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            onClick={() => message.info('View subscription details (Stripe Dashboard)')}
            block={isMobile}
          >
            View
          </Button>
        </Space>
      ),
    },
  ];

  const paymentColumns = [
    {
      title: 'Date',
      dataIndex: 'created',
      key: 'created',
      width: isMobile ? 120 : undefined,
      sorter: (a, b) => new Date(a.created) - new Date(b.created),
      render: (created) => {
        const d = new Date(created);
        return isMobile ? d.toLocaleDateString() : d.toLocaleString();
      },
    },
    {
      title: 'Tenant',
      dataIndex: 'tenantName',
      key: 'tenantName',
      width: isMobile ? 150 : undefined,
      ellipsis: true,
    },
    ...(!isMobile ? [{
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    }] : []),
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: isMobile ? 80 : undefined,
      render: (amount) => (
        <span style={{ color: '#52c41a', fontWeight: 'bold', fontSize: isMobile ? '11px' : '14px' }}>
          ${amount.toFixed(2)}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: isMobile ? 90 : undefined,
      render: (status) => {
        const colors = {
          succeeded: 'green',
          pending: 'blue',
          failed: 'red',
          refunded: 'orange',
        };
        return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>;
      },
    },
  ];

  const stats = {
    totalRevenue: subscriptions.reduce((sum, sub) => {
      if (sub.status === 'active') {
        return sum + (sub.interval === 'month' ? sub.amount * 12 : sub.amount);
      }
      return sum;
    }, 0),
    activeSubscriptions: subscriptions.filter(s => s.status === 'active').length,
    trialingSubscriptions: subscriptions.filter(s => s.status === 'trialing').length,
    totalSeats: subscriptions.reduce((sum, sub) => sum + sub.seats, 0),
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Stripe Billing</h1>
        <Button
          type="primary"
          icon={<CreditCardOutlined />}
          onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
          block={isMobile}
        >
          Open Stripe Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Card>
          <div className="flex items-center">
            <DollarOutlined className={`${isMobile ? 'text-2xl' : 'text-3xl'} text-green-500 mr-2 sm:mr-3`} />
            <div>
              <div className="text-gray-600 text-xs sm:text-sm">Annual Revenue</div>
              <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-green-500`}>
                ${stats.totalRevenue.toFixed(2)}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <CreditCardOutlined className={`${isMobile ? 'text-2xl' : 'text-3xl'} text-blue-500 mr-2 sm:mr-3`} />
            <div>
              <div className="text-gray-600 text-xs sm:text-sm">Active Subscriptions</div>
              <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>
                {stats.activeSubscriptions}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <HistoryOutlined className={`${isMobile ? 'text-2xl' : 'text-3xl'} text-orange-500 mr-2 sm:mr-3`} />
            <div>
              <div className="text-gray-600 text-xs sm:text-sm">Trialing</div>
              <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>
                {stats.trialingSubscriptions}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <TeamOutlined className={`${isMobile ? 'text-2xl' : 'text-3xl'} text-purple-500 mr-2 sm:mr-3`} />
            <div>
              <div className="text-gray-600 text-xs sm:text-sm">Total Seats</div>
              <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>
                {stats.totalSeats}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded border border-gray-200">
        <h3 className="mb-2 text-sm sm:text-base font-semibold">Stripe Integration Status</h3>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Mode">
            <Tag color="orange">Test Mode</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Webhook Status">
            <Tag color="green">Connected</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Last Sync">
            {new Date().toLocaleString()}
          </Descriptions.Item>
        </Descriptions>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'subscriptions',
            label: 'Subscriptions',
            children: (
              <Table
                columns={subscriptionColumns}
                dataSource={subscriptions}
                loading={loading}
                rowKey="id"
                scroll={{ x: isMobile ? 800 : 'max-content' }}
                pagination={{ pageSize: isMobile ? 10 : 20, simple: isMobile }}
              />
            ),
          },
          {
            key: 'payments',
            label: 'Payment History',
            children: (
              <Table
                columns={paymentColumns}
                dataSource={payments}
                loading={loading}
                rowKey="id"
                scroll={{ x: isMobile ? 600 : 'max-content' }}
                pagination={{ pageSize: isMobile ? 10 : 20, simple: isMobile }}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

export default StripeBillingPage;
