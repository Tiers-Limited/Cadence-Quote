import { useState, useEffect } from 'react';
import { Table, Tabs, Tag, DatePicker, Button, Space, message } from 'antd';
import { ReloadOutlined, FilterOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [dateRange, setDateRange] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });

  const categories = [
    { key: 'all', label: 'All Logs' },
    { key: 'auth', label: 'Authentication' },
    { key: 'product', label: 'Products' },
    { key: 'color', label: 'Colors' },
    { key: 'pricing', label: 'Pricing' },
    { key: 'tenant', label: 'Tenants' },
    { key: 'user', label: 'Users' },
    { key: 'payment', label: 'Payments' },
    { key: 'system', label: 'System' },
  ];

  useEffect(() => {
    fetchLogs();
  }, [activeCategory, dateRange, pagination.current]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
      };

      if (dateRange) {
        params.startDate = dateRange[0].toISOString();
        params.endDate = dateRange[1].toISOString();
      }

      let response;
      if (activeCategory === 'all') {
        response = await apiService.getAuditLogs(params);
      } else {
        response = await apiService.getAuditLogsByCategory(activeCategory, params);
      }

      setLogs(response.data || []);
      setPagination({
        ...pagination,
        total: response.pagination?.total || 0,
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      message.error('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (paginationData) => {
    setPagination({
      ...pagination,
      current: paginationData.current,
    });
  };

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    setPagination({ ...pagination, current: 1 });
  };

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

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => new Date(date).toLocaleString(),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category) => (
        <Tag color={getCategoryColor(category)}>{category}</Tag>
      ),
    },
    {
      title: 'User',
      key: 'user',
      width: 150,
      render: (_, record) => record.user?.fullName || 'System',
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
    },
    {
      title: 'Entity',
      key: 'entity',
      width: 150,
      render: (_, record) => {
        if (record.entityType && record.entityId) {
          return `${record.entityType} #${record.entityId}`;
        }
        return '-';
      },
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 140,
      render: (ip) => ip || '-',
    },
    {
      title: 'Changes',
      key: 'changes',
      ellipsis: true,
      render: (_, record) => {
        if (record.changes) {
          return (
            <div className="text-xs text-gray-400">
              {JSON.stringify(record.changes).substring(0, 100)}...
            </div>
          );
        }
        return '-';
      },
    },
  ];

  const expandedRowRender = (record) => {
    return (
      <div className="bg-gray-50 p-4 rounded">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-gray-600 text-sm mb-1">User Agent</div>
            <div className="text-sm">{record.userAgent || 'N/A'}</div>
          </div>
          <div>
            <div className="text-gray-600 text-sm mb-1">IP Address</div>
            <div className="text-sm">{record.ipAddress || 'N/A'}</div>
          </div>
          {record.changes && (
            <div className="col-span-2">
              <div className="text-gray-600 text-sm mb-1">Changes</div>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(record.changes, null, 2)}
              </pre>
            </div>
          )}
          {record.metadata && (
            <div className="col-span-2">
              <div className="text-gray-600 text-sm mb-1">Metadata</div>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(record.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <Space>
          <RangePicker
            onChange={handleDateRangeChange}
            style={{ width: 300 }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchLogs}
          >
            Refresh
          </Button>
        </Space>
      </div>

      <div className="bg-white rounded-lg p-4 shadow-sm">
        <Tabs
          activeKey={activeCategory}
          onChange={setActiveCategory}
          items={categories.map(cat => ({
            key: cat.key,
            label: cat.label,
          }))}
          type="card"
        />

        <Table
          columns={columns}
          dataSource={logs}
          loading={loading}
          rowKey="id"
          scroll={{ x: 'max-content' }}
          pagination={pagination}
          onChange={handleTableChange}
          expandable={{
            expandedRowRender,
            rowExpandable: (record) => record.changes || record.metadata,
          }}
        />
      </div>
    </div>
  );
};

export default AuditLogsPage;
