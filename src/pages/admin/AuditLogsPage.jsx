import { useState, useEffect } from 'react';
import { Table, Tabs, Tag, DatePicker, Button, Space, message, Input } from 'antd';
import { ReloadOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons';
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
  const [isMobile, setIsMobile] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const filteredLogs = logs.filter(log => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      log.action?.toLowerCase().includes(search) ||
      log.category?.toLowerCase().includes(search) ||
      log.user?.fullName?.toLowerCase().includes(search) ||
      log.entityType?.toLowerCase().includes(search) ||
      log.ipAddress?.toLowerCase().includes(search)
    );
  });

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
      width: isMobile ? 120 : 180,
      render: (date) => {
        const d = new Date(date);
        return isMobile ? d.toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      }) : d.toLocaleString();
      },
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: isMobile ? 80 : 120,
      render: (category) => (
        <Tag color={getCategoryColor(category)}>{category}</Tag>
      ),
    },
    ...(!isMobile ? [{
      title: 'User',
      key: 'user',
      width: 150,
      render: (_, record) => record.user?.fullName || 'System',
    }] : []),
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      ellipsis: true,
    },
    ...(!isMobile ? [{
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
    }] : []),
  ];

  const expandedRowRender = (record) => {
    return (
      <div className="bg-gray-50 p-3 sm:p-4 rounded">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
            <div className="col-span-1 sm:col-span-2">
              <div className="text-gray-600 text-xs sm:text-sm mb-1">Metadata</div>
              <pre className="text-[10px] sm:text-xs bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(record.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Audit Logs</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Input
            placeholder="Search logs..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            className="w-full sm:w-48"
          />
          <RangePicker
            onChange={handleDateRangeChange}
            className="w-full sm:w-[300px]"
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchLogs}
            block={isMobile}
          >
            Refresh
          </Button>
        </div>
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
          dataSource={filteredLogs}
          loading={loading}
          rowKey="id"
          scroll={{ x: isMobile ? 500 : 'max-content' }}
          pagination={{
            ...pagination,
            simple: isMobile,
            pageSize: isMobile ? 20 : 50,
          }}
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
