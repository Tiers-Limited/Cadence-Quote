// pages/QuotesListPage.jsx
// Professional Quotes Management Page - View, filter, and manage all quotes

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Modal, 
  Tag, 
  Descriptions, 
  Table, 
  Button, 
  Space, 
  Card, 
  Row, 
  Col, 
  Statistic,
  Input,
  Select,
  message
} from 'antd';
import { 
  ExclamationCircleOutlined,
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  CopyOutlined,
  DeleteOutlined,
  FileTextOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import quoteApiService from '../services/quoteApiService';
import MainLayout from '../components/MainLayout';

const { Search } = Input;
const { Option } = Select;

const QuotesListPage = () => {
  const navigate = useNavigate();

  // State
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    jobType: '',
    search: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'createdAt',
    sortOrder: 'DESC'
  });

  // UI State
  const [viewQuoteModal, setViewQuoteModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [loadingQuoteDetails, setLoadingQuoteDetails] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch quotes
  const fetchQuotes = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      const response = await quoteApiService.getQuotes({
        page,
        limit: pageSize,
        ...filters
      });

      if (response.success) {
        setQuotes(response.data || []);
        setPagination({
          current: page,
          pageSize: pageSize,
          total: response.pagination?.totalQuotes || 0
        });
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
      message.error(error.response?.data?.message || 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  // Load quotes on mount and filter change
  useEffect(() => {
    fetchQuotes(1);
  }, [filters]);

  // Handle filter changes
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Handle table change (pagination, filters, sorter)
  const handleTableChange = (newPagination, filters, sorter) => {
    fetchQuotes(newPagination.current, newPagination.pageSize);
  };

  // Handle status update
  const handleStatusUpdate = async (quoteId, newStatus) => {
    try {
      const response = await quoteApiService.updateQuoteStatus(quoteId, newStatus);
      if (response.success) {
        message.success(`Quote ${newStatus} successfully`);
        fetchQuotes(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      console.error('Error updating quote status:', error);
      message.error(error.response?.data?.message || 'Failed to update quote status');
    }
  };

  // Handle duplicate
  const handleDuplicate = async (quoteId) => {
    try {
      const response = await quoteApiService.duplicateQuote(quoteId);
      if (response.success) {
        message.success('Quote duplicated successfully');
        fetchQuotes(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      console.error('Error duplicating quote:', error);
      message.error(error.response?.data?.message || 'Failed to duplicate quote');
    }
  };

  // Handle delete
  const handleDelete = (quoteId) => {
    Modal.confirm({
      title: 'Delete Quote',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this quote? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const response = await quoteApiService.deleteQuote(quoteId);
          if (response.success) {
            message.success('Quote deleted successfully');
            fetchQuotes(pagination.current, pagination.pageSize);
          }
        } catch (error) {
          console.error('Error deleting quote:', error);
          message.error(error.response?.data?.message || 'Failed to delete quote');
        }
      }
    });
  };

  // View quote details
  const handleViewQuote = async (quoteId) => {
    try {
      setLoadingQuoteDetails(true);
      setViewQuoteModal(true);
      const response = await quoteApiService.getQuoteById(quoteId);
      if (response.success) {
        setSelectedQuote(response.data);
      }
    } catch (error) {
      console.error('Error fetching quote details:', error);
      message.error('Failed to load quote details');
      setViewQuoteModal(false);
    } finally {
      setLoadingQuoteDetails(false);
    }
  };

  // Edit quote
  const handleEditQuote = async (quoteId) => {
    try {
      const response = await quoteApiService.getQuoteById(quoteId);
      if (response.success) {
        const quote = response.data;
        
        // Navigate to quote builder with complete quote data
        navigate('/quote-builder', { 
          state: { 
            editQuote: quote,
            isEditMode: true
          },
          replace: false
        });
      }
    } catch (error) {
      console.error('Error loading quote for edit:', error);
      message.error('Failed to load quote for editing');
    }
  };

  // Status badge component (Ant Design Tag)
  const StatusBadge = ({ status }) => {
    const statusConfig = {
      draft: { color: 'default', icon: <FileTextOutlined /> },
      sent: { color: 'blue', icon: <SendOutlined /> },
      viewed: { color: 'blue', icon: <EyeOutlined /> },
      accepted: { color: 'success', icon: <CheckCircleOutlined /> },
      scheduled: { color: 'purple', icon: <CalendarOutlined /> },
      declined: { color: 'error', icon: <ExclamationCircleOutlined /> },
      archived: { color: 'default', icon: <FileTextOutlined /> },
      // Legacy support
      pending: { color: 'warning', icon: <ExclamationCircleOutlined /> },
      approved: { color: 'success', icon: <CheckCircleOutlined /> }
    };

    const config = statusConfig[status] || statusConfig.draft;

    return (
      <Tag color={config.color} icon={config.icon}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Tag>
    );
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Table columns definition
  const columns = [
    {
      title: 'Quote #',
      dataIndex: 'quoteNumber',
      key: 'quoteNumber',
      render: (text, record) => (
        <Button 
          type="link" 
          onClick={() => handleViewQuote(record.id)}
          className="p-0 h-auto font-medium"
        >
          {text}
        </Button>
      ),
      width: 140,
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_, record) => (
        <div>
          <div className="font-medium text-gray-900">{record.customerName}</div>
          <div className="text-sm text-gray-500">{record.customerEmail}</div>
        </div>
      ),
    },
    {
      title: 'Job Type',
      dataIndex: 'jobType',
      key: 'jobType',
      render: (text, record) => (
        <div>
          <div className="capitalize">{text}</div>
          {record.jobCategory && (
            <div className="text-xs text-gray-500">{record.jobCategory}</div>
          )}
        </div>
      ),
      filters: [
        { text: 'Interior', value: 'interior' },
        { text: 'Exterior', value: 'exterior' },
      ],
      onFilter: (value, record) => record.jobType === value,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      render: (amount, record) => (
        <div>
          <div className="font-semibold text-gray-900">{formatCurrency(amount)}</div>
          {record.totalSqft && (
            <div className="text-xs text-gray-500">{record.totalSqft.toLocaleString()} sq ft</div>
          )}
        </div>
      ),
      sorter: (a, b) => a.total - b.total,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <div>
          <StatusBadge status={status} />
          {status === 'sent' && record.sentAt && (
            <div className="text-xs text-gray-500 mt-1">
              Sent {formatDate(record.sentAt)}
            </div>
          )}
          {status === 'accepted' && record.acceptedAt && (
            <div className="text-xs text-gray-500 mt-1">
              Accepted {formatDate(record.acceptedAt)}
            </div>
          )}
        </div>
      ),
      filters: [
        { text: 'Draft', value: 'draft' },
        { text: 'Sent', value: 'sent' },
        { text: 'Viewed', value: 'viewed' },
        { text: 'Accepted', value: 'accepted' },
        { text: 'Scheduled', value: 'scheduled' },
        { text: 'Declined', value: 'declined' },
        { text: 'Archived', value: 'archived' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date, record) => (
        <div>
          <div className="text-sm">{formatDate(date)}</div>
          {record.validUntil && new Date(record.validUntil) > new Date() && (
            <div className="text-xs text-orange-600 mt-1">
              Valid until {formatDate(record.validUntil)}
            </div>
          )}
          {record.validUntil && new Date(record.validUntil) <= new Date() && (
            <div className="text-xs text-red-600 mt-1">
              Expired
            </div>
          )}
        </div>
      ),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewQuote(record.id)}
            title="View Details"
          />
          {record.status === 'draft' && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditQuote(record.id)}
              title="Edit Quote"
            />
          )}
          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={() => handleDuplicate(record.id)}
            title="Duplicate"
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
            title="Delete"
          />
          {record.status !== 'archived' && (
            <Select
              value={record.status}
              onChange={(value) => handleStatusUpdate(record.id, value)}
              size="small"
              style={{ width: 120 }}
            >
              <Option value="draft">Draft</Option>
              <Option value="sent">Sent</Option>
              <Option value="accepted">Accepted</Option>
              <Option value="scheduled">Scheduled</Option>
              <Option value="declined">Declined</Option>
              <Option value="archived">Archive</Option>
            </Select>
          )}
        </Space>
      ),
      width: 300,
    },
  ];

  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Quotes</h1>
              <p className="text-gray-600 mt-1">Manage all your project quotes</p>
            </div>
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={() => navigate('/quote-builder')}
            >
              New Quote
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Draft"
                value={quotes.filter(q => q.status === 'draft').length}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#666' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Sent"
                value={quotes.filter(q => q.status === 'sent').length}
                prefix={<SendOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Accepted"
                value={quotes.filter(q => q.status === 'accepted').length}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Scheduled"
                value={quotes.filter(q => q.status === 'scheduled').length}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Search
              placeholder="Search by customer, quote #..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              allowClear
              className="w-full"
            />
            <Select
              placeholder="All Statuses"
              value={filters.status || undefined}
              onChange={(value) => handleFilterChange('status', value || '')}
              allowClear
              className="w-full"
            >
              <Option value="draft"><FileTextOutlined /> Draft</Option>
              <Option value="sent"><SendOutlined /> Sent</Option>
              <Option value="accepted"><CheckCircleOutlined /> Accepted</Option>
              <Option value="scheduled"><CalendarOutlined /> Scheduled</Option>
              <Option value="declined">Declined</Option>
              <Option value="archived">Archived</Option>
            </Select>
            <Select
              placeholder="All Job Types"
              value={filters.jobType || undefined}
              onChange={(value) => handleFilterChange('jobType', value || '')}
              allowClear
              className="w-full"
            >
              <Option value="interior">Interior</Option>
              <Option value="exterior">Exterior</Option>
            </Select>
            <Select
              placeholder="Sort By"
              value={filters.sortBy}
              onChange={(value) => handleFilterChange('sortBy', value)}
              className="w-full"
            >
              <Option value="createdAt">Created Date</Option>
              <Option value="total">Total Amount</Option>
              <Option value="customerName">Customer Name</Option>
            </Select>
          </div>
        </Card>

        {/* Quotes Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={quotes}
            rowKey="id"
            loading={loading}
            scroll={{ x: isMobile ? 800 : 'max-content' }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} quotes`,
              pageSizeOptions: ['10', '20', '50', '100'],
              simple: isMobile,
            }}
            onChange={handleTableChange}
            locale={{
              emptyText: (
                <div className="text-center py-12">
                  <FileTextOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No quotes found</h3>
                  <p className="mt-2 text-sm text-gray-500">Get started by creating a new quote.</p>
                  <div className="mt-6">
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => navigate('/quote-builder')}
                    >
                      Create Quote
                    </Button>
                  </div>
                </div>
              ),
            }}
          />
        </Card>
      </div>

      {/* Quote Detail Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <FileTextOutlined className="text-blue-600" />
            <div>
              <div className="font-bold">Quote #{selectedQuote?.quoteNumber}</div>
              <div className="text-sm font-normal text-gray-500">
                Created {selectedQuote && formatDate(selectedQuote.createdAt)}
              </div>
            </div>
          </div>
        }
        open={viewQuoteModal}
        onCancel={() => {
          setViewQuoteModal(false);
          setSelectedQuote(null);
        }}
        width={isMobile ? '100%' : 900}
        footer={[
          selectedQuote?.status === 'draft' && (
            <Button
              key="edit"
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                setViewQuoteModal(false);
                handleEditQuote(selectedQuote.id);
              }}
            >
              Edit Quote
            </Button>
          ),
          <Button
            key="duplicate"
            icon={<CopyOutlined />}
            onClick={() => {
              setViewQuoteModal(false);
              handleDuplicate(selectedQuote?.id);
            }}
          >
            Duplicate
          </Button>,
          <Button key="close" onClick={() => setViewQuoteModal(false)}>
            Close
          </Button>,
        ]}
        styles={{
          body: { maxHeight: '70vh', overflowY: 'auto' }
        }}
      >
        {loadingQuoteDetails ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : selectedQuote ? (
          <div className="space-y-6">
            {/* Customer Info */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">Customer Information</h3>
              <Descriptions bordered column={isMobile ? 1 : 2} size="small">
                <Descriptions.Item label="Name">{selectedQuote.customerName}</Descriptions.Item>
                <Descriptions.Item label="Email">{selectedQuote.customerEmail}</Descriptions.Item>
                <Descriptions.Item label="Phone">{selectedQuote.customerPhone || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Address">
                  {selectedQuote.street}, {selectedQuote.city}, {selectedQuote.state} {selectedQuote.zipCode}
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* Job Details */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">Job Details</h3>
              <Descriptions bordered column={isMobile ? 1 : 3} size="small">
                <Descriptions.Item label="Job Type">
                  <span className="capitalize">{selectedQuote.jobType}</span>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <StatusBadge status={selectedQuote.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Total">
                  <span className="font-bold text-green-600 text-lg">{formatCurrency(selectedQuote.total)}</span>
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* Areas Breakdown */}
            {selectedQuote.areas && selectedQuote.areas.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Areas & Surfaces</h3>
                <div className="space-y-4">
                  {selectedQuote.areas.map((area, index) => (
                    <Card key={area.id || index} size="small" title={area.name}>
                      {area.laborItems && area.laborItems.length > 0 ? (
                        <Table
                          size="small"
                          dataSource={area.laborItems.filter(item => item.selected)}
                          columns={[
                            {
                              title: 'Surface',
                              dataIndex: 'categoryName',
                              key: 'categoryName',
                            },
                            {
                              title: 'Qty',
                              key: 'quantity',
                              align: 'center',
                              render: (_, item) => `${item.quantity} ${item.measurementUnit}`,
                            },
                            {
                              title: 'Coats',
                              dataIndex: 'numberOfCoats',
                              key: 'numberOfCoats',
                              align: 'center',
                              render: (coats) => coats || '-',
                            },
                            {
                              title: 'Gallons',
                              dataIndex: 'gallons',
                              key: 'gallons',
                              align: 'center',
                              render: (gallons) => gallons ? `${gallons} gal` : '-',
                            },
                          ]}
                          pagination={false}
                          rowKey={(item, idx) => `${area.id || index}-${idx}`}
                        />
                      ) : (
                        <p className="text-sm text-gray-500">No surfaces selected</p>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedQuote.notes && (
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Notes</h3>
                <Card size="small" className="bg-yellow-50 border-yellow-200">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedQuote.notes}</p>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6">
            <p className="text-center text-gray-500">Quote not found</p>
          </div>
        )}
      </Modal>
    </MainLayout>
  );
};

export default QuotesListPage;
