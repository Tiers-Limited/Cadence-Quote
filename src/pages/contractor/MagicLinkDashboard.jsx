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
      render: (_, record) => (
        <div>
          <div className="font-semibold">{record.client?.name || 'N/A'}</div>
          <div className="text-gray-500 text-sm">{record.client?.email || 'N/A'}</div>
        </div>
      ),
    },
    {
      title: 'Quote',
      key: 'quote',
      render: (_, record) => {
        const quoteNumber = record.metadata?.quoteNumber || record.quote?.quoteNumber;
        return quoteNumber ? <Tag color="blue">{quoteNumber}</Tag> : <span className="text-gray-400">N/A</span>;
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => getStatusTag(record),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      }),
    },
    {
      title: 'Expires',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (date) => new Date(date).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      }),
    },
    {
      title: 'Last Access',
      dataIndex: 'lastAccessedAt',
      key: 'lastAccessedAt',
      render: (date) => date ? new Date(date).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      }) : 'Never',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const now = new Date();
        const expiresAt = new Date(record.expiresAt);
        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
        const magicLink = `${window.location.origin}/portal/access/${record.token}`;

        return (
          <Space>
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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Cadence Pulse Management</h1>

      {/* Statistics */}
      {stats && (
        <Row gutter={16} className="mb-6">
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Active"
                value={stats.active}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Expiring Soon"
                value={stats.expiringSoon}
                prefix={<WarningOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Expired"
                value={stats.expired}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Created"
                value={stats.totalCreated}
                prefix={<LinkOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters and Actions */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center flex-1">
            <Search
              placeholder="Search by customer name or email..."
              allowClear
              style={{ width: 300 }}
              onSearch={(value) => setFilters(prev => ({ ...prev, search: value }))}
            />
            
            <Select
              value={filters.status}
              onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              style={{ width: 150 }}
            >
              <Option value="all">All Status</Option>
              <Option value="active">Active</Option>
              <Option value="expiring_soon">Expiring Soon</Option>
              <Option value="expired">Expired</Option>
            </Select>
          </div>
          
          <Space>
            {stats && stats.expiringSoon > 0 && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleBulkExtend}
              >
                Extend All Expiring ({stats.expiringSoon})
              </Button>
            )}
            
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchMagicLinks}
            >
              Refresh
            </Button>
          </Space>
        </div>
      </Card>

      {/* Magic Links Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={magicLinks}
          loading={loading}
          rowKey="id"
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
          }}
        />
      </Card>
    </div>
  );
};

export default MagicLinkDashboard;
