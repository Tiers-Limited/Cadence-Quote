import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Spin, message } from 'antd';
import { UserOutlined, TeamOutlined, DatabaseOutlined, FlagOutlined, FileTextOutlined, DollarOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const AdminDashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    tenants: { total: 0, active: 0, suspended: 0, trial: 0 },
    products: 0,
    colors: 0,
    features: 0,
    auditLogs: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch tenant stats
      const tenantStats = await apiService.getTenantStats();
      
      // Fetch audit log stats
      const auditStats = await apiService.getAuditLogStats();
      
      // Fetch product count
      const products = await apiService.getGlobalProducts({ limit: 1 });
      
      // Fetch color count
      const colors = await apiService.getGlobalColors({ limit: 1 });
      
      // Fetch feature flags count
      const features = await apiService.getFeatureFlags({ limit: 1 });

      setStats({
        tenants: tenantStats.data || { total: 0, active: 0, suspended: 0, trial: 0 },
        products: products.pagination?.total || 0,
        colors: colors.pagination?.total || 0,
        features: features.pagination?.total || 0,
        auditLogs: auditStats.data?.total || 0,
      });

      setRecentActivity(auditStats.data?.recentActivity || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const activityColumns = [
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString(),
      width: 180,
      responsive: ['md'],
    },
    {
      title: 'User',
      dataIndex: ['user', 'fullName'],
      key: 'user',
      render: (name) => name || 'System',
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      ellipsis: true,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category) => (
        <Tag color={getCategoryColor(category)}>{category}</Tag>
      ),
      responsive: ['sm'],
    },
  ];

  const getCategoryColor = (category) => {
    const colors = {
      auth: 'blue',
      product: 'green',
      color: 'purple',
      pricing: 'orange',
      tenant: 'red',
      user: 'cyan',
      payment: 'gold',
      system: 'default',
    };
    return colors[category] || 'default';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Admin Dashboard</h1>

      {/* Statistics Cards */}
      <Row gutter={[12, 12]} className="mb-4 md:mb-6">
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Total Tenants"
              value={stats.tenants.total}
              prefix={<TeamOutlined />}
            />
            <div className="mt-2 text-xs md:text-sm text-gray-500">
              <div className="flex flex-wrap gap-2">
                <span>Active: {stats.tenants.active}</span>
                <span>Trial: {stats.tenants.trial}</span>
                <span>Suspended: {stats.tenants.suspended}</span>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Global Products"
              value={stats.products}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Global Colors"
              value={stats.colors}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Feature Flags"
              value={stats.features}
              prefix={<FlagOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Audit Logs"
              value={stats.auditLogs}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="System Status"
              value="Operational"
              valueStyle={{ color: '#52c41a', fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Card title="Recent Activity">
        <Table
          columns={activityColumns}
          dataSource={recentActivity}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} items`,
            pageSizeOptions: ['5', '10', '20', '50'],
            responsive: true,
          }}
          scroll={{ x: 768 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default AdminDashboardPage;
