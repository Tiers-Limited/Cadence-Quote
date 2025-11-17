import { useState, useEffect } from 'react';
import { Table, Button, message, Space, Tag, Card, Descriptions, Tabs, Tooltip, Popconfirm } from 'antd';
import { 
  CreditCardOutlined, 
  DollarOutlined, 
  HistoryOutlined, 
  ReloadOutlined,
  StopOutlined,
  SyncOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const StripeBillingPage = () => {
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState(null);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('subscriptions');
  const [isMobile, setIsMobile] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchSubscriptions();
    fetchStats();
    fetchStripeStatus();
  }, [pagination.page]);

  const fetchSubscriptions = async (filters = {}) => {
    try {
      setLoading(true);
      const response = await apiService.getSubscriptions({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      });

      if (response.success) {
        setSubscriptions(response.data.subscriptions);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          totalPages: response.data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      message.error('Failed to fetch subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const response = await apiService.getSubscriptionStats();
      
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      message.error('Failed to fetch statistics');
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchStripeStatus = async () => {
    try {
      setStatusLoading(true);
      const response = await apiService.getStripeIntegrationStatus();
      
      if (response.success) {
        setStripeStatus(response.data);
      }
    } catch (error) {
      console.error('Error fetching Stripe status:', error);
      message.error('Failed to fetch Stripe integration status');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleCancelSubscription = async (id, immediate = false) => {
    try {
      const response = await apiService.cancelSubscription(id, immediate);
      
      if (response.success) {
        message.success(response.message);
        fetchSubscriptions();
        fetchStats();
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      message.error('Failed to cancel subscription');
    }
  };

  const handleRetryPayment = async (id) => {
    try {
      const response = await apiService.retryPayment(id);
      
      if (response.success) {
        message.success('Payment retry initiated');
        fetchSubscriptions();
      }
    } catch (error) {
      console.error('Error retrying payment:', error);
      message.error('Failed to retry payment');
    }
  };

  const getTierColor = (tier) => {
    if (tier === 'basic') return 'blue';
    if (tier === 'pro') return 'green';
    return 'purple';
  };

  const subscriptionColumns = [
    {
      title: 'Tenant',
      dataIndex: ['tenant', 'companyName'],
      key: 'tenantName',
      width: isMobile ? 150 : undefined,
      sorter: (a, b) => a.tenant?.companyName?.localeCompare(b.tenant?.companyName || '') || 0,
      ellipsis: true,
      render: (companyName, record) => (
        <div>
          <div className="font-semibold">{companyName}</div>
          <div className="text-xs text-gray-500">{record.tenant?.email}</div>
        </div>
      )
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      width: isMobile ? 100 : undefined,
      render: (tier) => {
        const colors = {
          basic: 'blue',
          pro: 'green',
          enterprise: 'purple'
        };
        return (
          <Tag color={colors[tier]}>
            {tier?.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: isMobile ? 100 : undefined,
      filters: isMobile ? undefined : [
        { text: 'Active', value: 'active' },
        { text: 'Trialing', value: 'trialing' },
        { text: 'Past Due', value: 'past_due' },
        { text: 'Canceled', value: 'canceled' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => {
        const colors = {
          active: 'green',
          trialing: 'blue',
          past_due: 'orange',
          canceled: 'red',
          unpaid: 'red',
          incomplete: 'gray'
        };
        return <Tag color={colors[status]}>{status?.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'MRR',
      dataIndex: 'mrr',
      key: 'mrr',
      width: isMobile ? 80 : undefined,
      sorter: (a, b) => a.mrr - b.mrr,
      render: (mrr) => <strong>${Number.parseFloat(mrr || 0).toFixed(2)}</strong>,
    },
    {
      title: 'Period',
      key: 'period',
      width: isMobile ? 150 : undefined,
      render: (_, record) => {
        const start = new Date(record.currentPeriodStart);
        const end = new Date(record.currentPeriodEnd);
        return (
          <div className="text-xs">
            <div>{start.toLocaleDateString()}</div>
            <div className="text-gray-500">to {end.toLocaleDateString()}</div>
          </div>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: isMobile ? 120 : 200,
      render: (_, record) => (
        <Space size="small" direction={isMobile ? 'vertical' : 'horizontal'}>
          {record.status === 'past_due' && (
            <Tooltip title="Retry failed payment">
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => handleRetryPayment(record.id)}
              >
                {!isMobile && 'Retry'}
              </Button>
            </Tooltip>
          )}
          {(record.status === 'active' || record.status === 'trialing') && !record.cancelAtPeriodEnd && (
            <Popconfirm
              title="Cancel subscription?"
              description="Cancel at period end or immediately?"
              onConfirm={() => handleCancelSubscription(record.id, false)}
              onCancel={() => handleCancelSubscription(record.id, true)}
              okText="Period End"
              cancelText="Immediate"
              icon={<ExclamationCircleOutlined style={{ color: 'orange' }} />}
            >
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
              >
                {!isMobile && 'Cancel'}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Stripe Billing & Subscriptions</h1>
        <Space>
          <Button
            icon={<SyncOutlined />}
            onClick={() => {
              fetchSubscriptions();
              fetchStats();
              fetchStripeStatus();
            }}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<CreditCardOutlined />}
            onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
          >
            {!isMobile && 'Open '} Stripe
          </Button>
        </Space>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Card loading={statsLoading}>
            <div className="flex items-center">
              <DollarOutlined className={`${isMobile ? 'text-2xl' : 'text-3xl'} text-green-500 mr-2 sm:mr-3`} />
              <div>
                <div className="text-gray-600 text-xs sm:text-sm">Total MRR</div>
                <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-green-500`}>
                  ${stats.mrr?.total?.toFixed(2) || '0.00'}
                </div>
                <div className="text-xs text-gray-500">
                  {stats.mrr?.growth >= 0 ? '+' : ''}{stats.mrr?.growth}% growth
                </div>
              </div>
            </div>
          </Card>

          <Card loading={statsLoading}>
            <div className="flex items-center">
              <CreditCardOutlined className={`${isMobile ? 'text-2xl' : 'text-3xl'} text-blue-500 mr-2 sm:mr-3`} />
              <div>
                <div className="text-gray-600 text-xs sm:text-sm">Active Subscriptions</div>
                <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>
                  {stats.subscriptions?.active || 0}
                </div>
                <div className="text-xs text-gray-500">
                  {stats.subscriptions?.new || 0} new this month
                </div>
              </div>
            </div>
          </Card>

          <Card loading={statsLoading}>
            <div className="flex items-center">
              <HistoryOutlined className={`${isMobile ? 'text-2xl' : 'text-3xl'} text-orange-500 mr-2 sm:mr-3`} />
              <div>
                <div className="text-gray-600 text-xs sm:text-sm">Trials</div>
                <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>
                  {stats.subscriptions?.trialing || 0}
                </div>
                <div className="text-xs text-gray-500">
                  {stats.metrics?.trialConversionRate || 0}% conversion
                </div>
              </div>
            </div>
          </Card>

          <Card loading={statsLoading}>
            <div className="flex items-center">
              <ExclamationCircleOutlined className={`${isMobile ? 'text-2xl' : 'text-3xl'} text-red-500 mr-2 sm:mr-3`} />
              <div>
                <div className="text-gray-600 text-xs sm:text-sm">Churn Rate</div>
                <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>
                  {stats.metrics?.churnRate || 0}%
                </div>
                <div className="text-xs text-gray-500">
                  {stats.subscriptions?.canceled || 0} canceled
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card loading={statusLoading} className="mb-4 sm:mb-6">
        <h3 className="mb-3 text-sm sm:text-base font-semibold">Stripe Integration Status</h3>
        {stripeStatus && (
          <Descriptions column={isMobile ? 1 : 2} size="small">
            <Descriptions.Item label="Configuration">
              <Tag color={stripeStatus.configured ? 'green' : 'red'}>
                {stripeStatus.configured ? 'Configured' : 'Not Configured'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Mode">
              <Tag color={stripeStatus.mode === 'test' ? 'orange' : 'green'}>
                {stripeStatus.mode === 'test' ? 'Test Mode' : stripeStatus.mode === 'live' ? 'Live Mode' : 'N/A'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Account Status">
              <Tag color={stripeStatus.accountStatus === 'connected' ? 'green' : 'red'}>
                {stripeStatus.accountStatus === 'connected' ? 'Connected' : stripeStatus.accountStatus === 'error' ? 'Error' : 'Unknown'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Webhook">
              <Tag color={stripeStatus.webhookConfigured ? 'green' : 'orange'}>
                {stripeStatus.webhookConfigured ? 'Configured' : 'Not Configured'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Last Sync">
              {stripeStatus.lastSync ? new Date(stripeStatus.lastSync).toLocaleString() : 'Never'}
            </Descriptions.Item>
            <Descriptions.Item label="Recent Webhook Events">
              <Tag color={stripeStatus.recentWebhookEvents > 0 ? 'blue' : 'gray'}>
                {stripeStatus.recentWebhookEvents || 0}
              </Tag>
            </Descriptions.Item>
            {stripeStatus.accountId && (
              <Descriptions.Item label="Account ID" span={2}>
                <code className="text-xs">{stripeStatus.accountId}</code>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Failed Payments">
              <Tag color={stats?.metrics?.failedPayments > 0 ? 'red' : 'green'}>
                {stats?.metrics?.failedPayments || 0}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'subscriptions',
            label: `Subscriptions (${pagination.total})`,
            children: (
              <Table
                columns={subscriptionColumns}
                dataSource={subscriptions}
                loading={loading}
                rowKey="id"
                scroll={{ x: isMobile ? 800 : 'max-content' }}
                pagination={{
                  current: pagination.page,
                  pageSize: pagination.limit,
                  total: pagination.total,
                  simple: isMobile,
                  onChange: (page) => setPagination(prev => ({ ...prev, page }))
                }}
              />
            ),
          },
          {
            key: 'tierBreakdown',
            label: 'Tier Breakdown',
            children: stats?.tierBreakdown && (
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {stats.tierBreakdown.map((tier) => (
                    <Card key={tier.tier}>
                      <div className="text-center">
                        <Tag 
                          color={getTierColor(tier.tier)}
                          className="mb-2"
                        >
                          {tier.tier.toUpperCase()}
                        </Tag>
                        <div className="text-2xl font-bold">{tier.count}</div>
                        <div className="text-gray-500 text-sm">subscriptions</div>
                        <div className="text-green-600 font-semibold mt-2">
                          ${tier.revenue.toFixed(2)} MRR
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default StripeBillingPage;
