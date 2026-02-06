// src/pages/contractor/MagicLinkDashboard.jsx
// Contractor dashboard for managing customer magic links

import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Modal,
  message,
  Space,
  Statistic,
  Row,
  Col,
  Tooltip,
  Popconfirm,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  LinkOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  StopOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { Search } = Input;
const { Option } = Select;

const MagicLinkDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [magicLinks, setMagicLinks] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
  });

  useEffect(() => {
    fetchMagicLinks();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchMagicLinks = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/cadence-pulse', {
        params: {
          page: pagination.current,
          limit: pagination.pageSize,
          search: filters.search || undefined,
          status: filters.status !== 'all' ? filters.status : undefined,
        },
      });
      
      setMagicLinks(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0,
      }));
      if (response.stats) {
        setStats(response.stats);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching magic links:', err);
      message.error('Failed to load magic links');
      setLoading(false);
    }
  };

  const handleExtend = async (id, days = 7) => {
    try {
      await apiService.put(`/cadence-pulse/${id}/extend`, { days });
      message.success(`Extended by ${days} days`);
      fetchMagicLinks();
    } catch (err) {
      console.error('Error extending link:', err);
      message.error('Failed to extend link');
    }
  };

  const handleRegenerate = async (id) => {
    try {
      const response = await apiService.post(`/cadence-pulse/${id}/regenerate`);
      message.success('New magic link generated and sent to customer');
      fetchMagicLinks();
    } catch (err) {
      console.error('Error regenerating link:', err);
      message.error('Failed to regenerate link');
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await apiService.delete(`/cadence-pulse/${id}`);
      message.success('Magic link deactivated');
      fetchMagicLinks();
    } catch (err) {
      console.error('Error deactivating link:', err);
      message.error('Failed to deactivate link');
    }
  };

  const handleBulkExtend = async () => {
    Modal.confirm({
      title: 'Extend All Expiring Links?',
      content: 'This will extend all links expiring within 3 days by 7 additional days.',
      onOk: async () => {
        try {
          const response = await apiService.post('/cadence-pulse/bulk-extend', { days: 7 });
          message.success(`Extended ${response.data.count} links`);
          fetchMagicLinks();
        } catch (err) {
          console.error('Error bulk extending:', err);
          message.error('Failed to extend links');
        }
      },
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  const getStatusTag = (link) => {
    const now = new Date();
    const expiresAt = new Date(link.expiresAt);
    const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

    if (link.revokedAt) {
      return <Tag color="red" icon={<StopOutlined />}>Deactivated</Tag>;
    }
    if (daysLeft <= 0) {
      return <Tag color="red" icon={<WarningOutlined />}>Expired</Tag>;
    }
    if (daysLeft <= 3) {
      return <Tag color="orange" icon={<ClockCircleOutlined />}>Expiring Soon ({daysLeft}d)</Tag>;
    }
    return <Tag color="green" icon={<CheckCircleOutlined />}>Active ({daysLeft}d)</Tag>;
  };

  const columns = [
    {
      title: 'Customer',
      key: 'customer',
      fixed: 'left',
      width: 200,
      render: (_, record) => (
        <div>
          <div className="font-semibold text-sm">{record.client?.name || 'N/A'}</div>
          <div className="text-gray-500 text-xs truncate max-w-[180px]">{record.client?.email || 'N/A'}</div>
        </div>
      ),
    },
    {
      title: 'Quote',
      key: 'quote',
      width: 120,
      responsive: ['md'],
      render: (_, record) => {
        const quoteNumber = record.metadata?.quoteNumber || record.quote?.quoteNumber;
        return quoteNumber ? <Tag color="blue">{quoteNumber}</Tag> : <span className="text-gray-400">N/A</span>;
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 160,
      render: (_, record) => getStatusTag(record),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      responsive: ['lg'],
      render: (date) => new Date(date).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      }),
    },
    {
      title: 'Expires',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 120,
      responsive: ['sm'],
      render: (date) => new Date(date).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      }),
    },
    {
      title: 'Last Access',
      dataIndex: 'lastAccessedAt',
      key: 'lastAccessedAt',
      width: 120,
      responsive: ['xl'],
      render: (date) => date ? new Date(date).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      }) : 'Never',
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 160,
      render: (_, record) => {
        const now = new Date();
        const expiresAt = new Date(record.expiresAt);
        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
        const magicLink = `${window.location.origin}/portal/access/${record.token}`;

        return (
          <Space size="small">
            <Tooltip title="Copy Link">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(magicLink)}
              />
            </Tooltip>
            
            {!record.revokedAt && (
              <>
                <Tooltip title="Extend 7 Days">
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => handleExtend(record.id, 7)}
                  />
                </Tooltip>
                
                <Tooltip title="Regenerate Link">
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => handleRegenerate(record.id)}
                  />
                </Tooltip>
                
                <Popconfirm
                  title="Deactivate this magic link?"
                  description="Customer will lose access to the portal."
                  onConfirm={() => handleDeactivate(record.id)}
                  okText="Deactivate"
                  cancelText="Cancel"
                >
                  <Tooltip title="Deactivate">
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<StopOutlined />}
                    />
                  </Tooltip>
                </Popconfirm>
              </>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Cadence Pulse Management</h1>

      {/* Statistics */}
      {stats && (
        <Row gutter={[12, 12]} className="mb-4 sm:mb-6">
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="Active"
                value={stats.active}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#3f8600', fontSize: '20px' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="Expiring Soon"
                value={stats.expiringSoon}
                prefix={<WarningOutlined />}
                valueStyle={{ color: '#cf1322', fontSize: '20px' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="Expired"
                value={stats.expired}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ fontSize: '20px' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="Total Created"
                value={stats.totalCreated}
                prefix={<LinkOutlined />}
                valueStyle={{ fontSize: '20px' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters and Actions */}
      <Card className="mb-4" size="small">
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Search and Filter Row */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Search
              placeholder="Search customer..."
              allowClear
              className="w-full sm:flex-1 sm:max-w-xs"
              onSearch={(value) => setFilters(prev => ({ ...prev, search: value }))}
            />
            
            <Select
              value={filters.status}
              onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              className="w-full sm:w-40"
            >
              <Option value="all">All Status</Option>
              <Option value="active">Active</Option>
              <Option value="expiring_soon">Expiring Soon</Option>
              <Option value="expired">Expired</Option>
            </Select>
          </div>
          
          {/* Action Buttons Row */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {stats && stats.expiringSoon > 0 && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleBulkExtend}
                className="w-full sm:w-auto"
                size="middle"
              >
                <span className="hidden sm:inline">Extend All Expiring ({stats.expiringSoon})</span>
                <span className="sm:hidden">Extend ({stats.expiringSoon})</span>
              </Button>
            )}
            
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchMagicLinks}
              className="w-full sm:w-auto"
              size="middle"
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Magic Links Table */}
      <Card size="small">
        <Table
          columns={columns}
          dataSource={magicLinks}
          loading={loading}
          rowKey="id"
          scroll={{ x: 800 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} magic links`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({
                ...prev,
                current: page,
                pageSize,
              }));
            },
            responsive: true,
            size: 'default',
          }}
        />
      </Card>
    </div>
  );
};

export default MagicLinkDashboard;
