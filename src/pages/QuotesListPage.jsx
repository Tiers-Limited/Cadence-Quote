import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Card,
  Button,
  Space,
  Row,
  Col,
  Statistic,
  Input,
  Select,
  Modal,
  Tag,
  Descriptions,
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

const { Search } = Input;
const { Option } = Select;
const { confirm } = Modal;

const QuotesListPage = () => {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [productNames, setProductNames] = useState({});
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Pagination
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  // Stats
  const [stats, setStats] = useState({
    draft: 0,
    sent: 0,
    accepted: 0,
    scheduled: 0
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchQuotes();
  }, [pagination.current, pagination.pageSize, statusFilter, jobTypeFilter, sortBy, sortOrder]);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        jobType: jobTypeFilter !== 'all' ? jobTypeFilter : undefined,
        sortBy: sortBy,
        sortOrder: sortOrder
      };

      // Remove undefined values to avoid sending empty params
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const response = await quoteApiService.getQuotes(params);
      
      if (response.success) {
        setQuotes(response.data || []);
        setPagination({
          ...pagination,
          total: response.pagination?.total || 0
        });

        // Calculate stats from quotes (this only shows stats for current page)
        // For accurate stats, you'd need a separate API endpoint that returns all counts
        const quotesData = response.data || [];
        setStats({
          draft: quotesData.filter(q => q.status === 'draft').length,
          sent: quotesData.filter(q => q.status === 'sent').length,
          accepted: quotesData.filter(q => q.status === 'accepted').length,
          scheduled: quotesData.filter(q => q.status === 'scheduled').length
        });
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
      message.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    });
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    // Reset to first page when searching
    setPagination({ ...pagination, current: 1 });
  };

  const handleStatusFilter = (value) => {
    setStatusFilter(value);
    setPagination({ ...pagination, current: 1 });
  };

  const handleJobTypeFilter = (value) => {
    setJobTypeFilter(value);
    setPagination({ ...pagination, current: 1 });
  };

  const handleSortChange = (value) => {
    const [field, order] = value.split('_');
    setSortBy(field);
    setSortOrder(order.toUpperCase());
    setPagination({ ...pagination, current: 1 });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setJobTypeFilter('all');
    setSortBy('createdAt');
    setSortOrder('DESC');
    setPagination({ ...pagination, current: 1 });
  };

  const handleViewQuote = async (quoteId) => {
    try {
      const response = await quoteApiService.getQuoteById(quoteId);
      if (response.success) {
        setSelectedQuote(response.data);
        setDetailsModalVisible(true);
        
        // Fetch product names for all products in productSets
        if (response.data.productSets && response.data.productSets.length > 0) {
          fetchProductNames(response.data.productSets);
        }
      }
    } catch (error) {
      console.error('Error fetching quote details:', error);
      message.error('Failed to load quote details');
    }
  };

  const fetchProductNames = async (productSets) => {
    setLoadingProducts(true);
    try {
      const productIds = new Set();
      
      // Collect all unique product IDs
      productSets.forEach(set => {
        if (set.products) {
          if (set.products.good) productIds.add(set.products.good);
          if (set.products.better) productIds.add(set.products.better);
          if (set.products.best) productIds.add(set.products.best);
        }
      });

      // Fetch product details for each ID
      const productMap = {};
      await Promise.all(
        Array.from(productIds).map(async (productId) => {
          try {
            const response = await quoteApiService.getProductDetails(productId);
            if (response.success && response.data) {
              productMap[productId] = response.data.product?.name || `Product ${productId}`;
            }
          } catch (error) {
            console.error(`Error fetching product ${productId}:`, error);
            productMap[productId] = `Product ${productId}`;
          }
        })
      );

      setProductNames(productMap);
    } catch (error) {
      console.error('Error fetching product names:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleEditQuote = (quoteId) => {
    navigate(`/quotes/edit/${quoteId}`);
  };

  const handleDuplicateQuote = async (quoteId) => {
    try {
      const response = await quoteApiService.duplicateQuote(quoteId);
      if (response.success) {
        message.success('Quote duplicated successfully');
        fetchQuotes();
      }
    } catch (error) {
      console.error('Error duplicating quote:', error);
      message.error('Failed to duplicate quote');
    }
  };

  const handleDeleteQuote = (quoteId) => {
    confirm({
      title: 'Are you sure you want to delete this quote?',
      icon: <ExclamationCircleOutlined />,
      content: 'This action cannot be undone.',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const response = await quoteApiService.deleteQuote(quoteId);
          if (response.success) {
            message.success('Quote deleted successfully');
            fetchQuotes();
          }
        } catch (error) {
          console.error('Error deleting quote:', error);
          message.error('Failed to delete quote');
        }
      }
    });
  };

  const StatusBadge = ({ status }) => {
    const statusConfig = {
      draft: { color: 'default', icon: <FileTextOutlined /> },
      sent: { color: 'processing', icon: <SendOutlined /> },
      accepted: { color: 'success', icon: <CheckCircleOutlined /> },
      scheduled: { color: 'cyan', icon: <CalendarOutlined /> },
      rejected: { color: 'error', icon: <ExclamationCircleOutlined /> }
    };

    const config = statusConfig[status] || statusConfig.draft;

    return (
      <Tag color={config.color} icon={config.icon}>
        {status ? status.toUpperCase() : 'DRAFT'}
      </Tag>
    );
  };

  const columns = [
    {
      title: 'Quote #',
      dataIndex: 'quoteNumber',
      key: 'quoteNumber',
      width: 120,
      fixed: isMobile ? undefined : 'left',
      render: (text, record) => (
        <Button type="link" onClick={() => handleViewQuote(record.id)}>
          <strong>{text}</strong>
        </Button>
      )
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      key: 'customerName',
      responsive: ['sm'],
      render: (text, record) => (
        <div>
          <div><strong>{text}</strong></div>
          {record.customerEmail && (
            <div style={{ fontSize: '12px', color: '#888' }}>{record.customerEmail}</div>
          )}
        </div>
      )
    },
    {
      title: 'Job Type',
      dataIndex: 'jobType',
      key: 'jobType',
      width: 150,
      responsive: ['md'],
      render: (text, record) => (
        <div>
          <div>{text ? text.toUpperCase() : 'N/A'}</div>
          {record.jobCategory && (
            <Tag size="small">{record.jobCategory}</Tag>
          )}
        </div>
      )
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 140,
      render: (text, record) => (
        <div>
          <div><strong>${Number.parseFloat(text || 0).toFixed(2)}</strong></div>
          {record.totalSqft && !isMobile && (
            <div style={{ fontSize: '12px', color: '#888' }}>{record.totalSqft} sqft</div>
          )}
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      responsive: ['sm'],
      render: (status, record) => (
        <div>
          <StatusBadge status={status} />
          {record.sentAt && !isMobile && (
            <div style={{ fontSize: '11px', color: '#888', marginTop: 4 }}>
              Sent: {new Date(record.sentAt).toLocaleDateString()}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      responsive: ['lg'],
      render: (text, record) => (
        <div>
          <div>{new Date(text).toLocaleDateString()}</div>
          {record.validUntil && (
            <div style={{ fontSize: '11px', color: '#ff4d4f' }}>
              Valid until: {new Date(record.validUntil).toLocaleDateString()}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: isMobile ? 100 : 200,
      fixed: isMobile ? undefined : 'right',
      render: (_, record) => (
        <Space size="small" direction={isMobile ? 'vertical' : 'horizontal'} wrap>
          {!isMobile && (
            <>
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => handleViewQuote(record.id)}
                size="small"
              >
                View
              </Button>
              
              {record.status === 'draft' && (
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => handleEditQuote(record.id)}
                  size="small"
                >
                  Edit
                </Button>
              )}
              
              <Button
                type="link"
                icon={<CopyOutlined />}
                onClick={() => handleDuplicateQuote(record.id)}
                size="small"
              >
                Copy
              </Button>
              
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteQuote(record.id)}
                size="small"
              >
                Delete
              </Button>
            </>
          )}
          
          {isMobile && (
            <Space.Compact>
              <Button
                icon={<EyeOutlined />}
                onClick={() => handleViewQuote(record.id)}
                size="small"
              />
              {record.status === 'draft' && (
                <Button
                  icon={<EditOutlined />}
                  onClick={() => handleEditQuote(record.id)}
                  size="small"
                />
              )}
              <Button
                icon={<CopyOutlined />}
                onClick={() => handleDuplicateQuote(record.id)}
                size="small"
              />
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteQuote(record.id)}
                size="small"
              />
            </Space.Compact>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ padding: isMobile ? '16px' : '24px' }}>
        {/* Stats Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={12} md={6}>
            <Card>
              <Statistic
                title="Draft"
                value={stats.draft}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#999' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card>
              <Statistic
                title="Sent"
                value={stats.sent}
                prefix={<SendOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card>
              <Statistic
                title="Accepted"
                value={stats.accepted}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card>
              <Statistic
                title="Scheduled"
                value={stats.scheduled}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#13c2c2' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={[8, 8]}>
            <Col xs={24} md={8}>
              <Search
                placeholder={isMobile ? "Search quotes..." : "Search by customer name, email, or quote number"}
                allowClear
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onSearch={handleSearch}
                size={isMobile ? "middle" : "large"}
              />
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Select
                style={{ width: '100%' }}
                placeholder="Status"
                value={statusFilter}
                onChange={handleStatusFilter}
                size={isMobile ? "middle" : "large"}
              >
                <Option value="all">All Status</Option>
                <Option value="draft">Draft</Option>
                <Option value="sent">Sent</Option>
                <Option value="accepted">Accepted</Option>
                <Option value="scheduled">Scheduled</Option>
                <Option value="rejected">Rejected</Option>
              </Select>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Select
                style={{ width: '100%' }}
                placeholder="Job Type"
                value={jobTypeFilter}
                onChange={handleJobTypeFilter}
                size={isMobile ? "middle" : "large"}
              >
                <Option value="all">All Types</Option>
                <Option value="residential">Residential</Option>
                <Option value="commercial">Commercial</Option>
                <Option value="industrial">Industrial</Option>
              </Select>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Select
                style={{ width: '100%' }}
                placeholder="Sort By"
                value={`${sortBy}_${sortOrder.toLowerCase()}`}
                onChange={handleSortChange}
                size={isMobile ? "middle" : "large"}
              >
                <Option value="createdAt_desc">Newest First</Option>
                <Option value="createdAt_asc">Oldest First</Option>
                <Option value="total_desc">Highest Total</Option>
                <Option value="total_asc">Lowest Total</Option>
                <Option value="customerName_asc">Customer A-Z</Option>
                <Option value="customerName_desc">Customer Z-A</Option>
              </Select>
            </Col>
            <Col xs={12} sm={24} md={4}>
              <Button
                style={{ width: '100%' }}
                onClick={handleClearFilters}
                size={isMobile ? "middle" : "large"}
              >
                Clear Filters
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Quotes Table */}
        <Card
          title={
            <Space 
              style={{
                display:"flex",
                width:"100%",
                justifyContent:"space-between",
                flexWrap:"wrap"
              }}
            >
              <span style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 600 }}>Quotes</span>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/quotes/new')}
                size={isMobile ? 'middle' : 'large'}
              >
                {isMobile ? 'New' : 'New Quote'}
              </Button>
            </Space>
          }
        >
          <Table
            columns={columns}
            dataSource={quotes}
            rowKey="id"
            loading={loading}
            expandable={isMobile ? {
              expandedRowRender: (record) => (
                <div style={{ padding: '8px 0' }}>
                  <p style={{ margin: '4px 0' }}><strong>Customer:</strong> {record.customerName}</p>
                  <p style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}>{record.customerEmail}</p>
                  <p style={{ margin: '4px 0' }}><strong>Job:</strong> {record.jobType?.toUpperCase()} - {record.jobCategory}</p>
                  <p style={{ margin: '4px 0' }}><strong>Status:</strong> <StatusBadge status={record.status} /></p>
                  <p style={{ margin: '4px 0', fontSize: '11px', color: '#888' }}>Created: {new Date(record.createdAt).toLocaleDateString()}</p>
                </div>
              ),
              rowExpandable: () => true,
            } : undefined}
            pagination={{
              ...pagination,
              showSizeChanger: !isMobile,
              showTotal: (total) => `Total ${total} quotes`,
              pageSizeOptions: ['10', '20', '50', '100'],
              simple: isMobile,
              size: isMobile ? 'small' : 'default',
              position: [isMobile ? 'bottomCenter' : 'bottomRight']
            }}
            onChange={handleTableChange}
            scroll={{ x: isMobile ? 'max-content' : 1200 }}
            size={isMobile ? 'small' : 'middle'}
          />
        </Card>

        {/* Quote Details Modal */}
        <Modal
          title={`Quote Details - ${selectedQuote?.quoteNumber || ''}`}
          open={detailsModalVisible}
          onCancel={() => {
            setDetailsModalVisible(false);
            setProductNames({});
          }}
          footer={[
            <Button key="close" onClick={() => {
              setDetailsModalVisible(false);
              setProductNames({});
            }}>
              Close
            </Button>,
            selectedQuote?.status === 'draft' && (
              <Button
                key="edit"
                type="primary"
                onClick={() => {
                  setDetailsModalVisible(false);
                  handleEditQuote(selectedQuote.id);
                }}
              >
                Edit Quote
              </Button>
            )
          ]}
          width={isMobile ? '100%' : 800}
        >
          {selectedQuote && (
            <>
              <Descriptions bordered column={isMobile ? 1 : 2}>
                <Descriptions.Item label="Quote Number">
                  {selectedQuote.quoteNumber}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <StatusBadge status={selectedQuote.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Customer Name">
                  {selectedQuote.customerName}
                </Descriptions.Item>
                <Descriptions.Item label="Customer Email">
                  {selectedQuote.customerEmail}
                </Descriptions.Item>
                <Descriptions.Item label="Customer Phone">
                  {selectedQuote.customerPhone || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Job Type">
                  {selectedQuote.jobType ? selectedQuote.jobType.toUpperCase() : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Job Category">
                  {selectedQuote.jobCategory ? selectedQuote.jobCategory.toUpperCase() : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Pricing Scheme">
                  {selectedQuote.pricingScheme?.name || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Job Address" span={2}>
                  {`${selectedQuote.street}, ${selectedQuote.city}, ${selectedQuote.state} ${selectedQuote.zipCode}`}
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {new Date(selectedQuote.createdAt).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated">
                  {new Date(selectedQuote.updatedAt).toLocaleString()}
                </Descriptions.Item>
                {selectedQuote.sentAt && (
                  <Descriptions.Item label="Sent At">
                    {new Date(selectedQuote.sentAt).toLocaleString()}
                  </Descriptions.Item>
                )}
                {selectedQuote.validUntil && (
                  <Descriptions.Item label="Valid Until">
                    {new Date(selectedQuote.validUntil).toLocaleString()}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Labor Total">
                  ${Number.parseFloat(selectedQuote.laborTotal || 0).toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="Material Total">
                  ${Number.parseFloat(selectedQuote.materialTotal || 0).toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="Subtotal">
                  ${Number.parseFloat(selectedQuote.subtotal || 0).toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="Markup">
                  ${Number.parseFloat(selectedQuote.markup || 0).toFixed(2)} ({selectedQuote.markupPercent}%)
                </Descriptions.Item>
                <Descriptions.Item label="Tax">
                  ${Number.parseFloat(selectedQuote.tax || 0).toFixed(2)} ({selectedQuote.taxPercent}%)
                </Descriptions.Item>
                <Descriptions.Item label="Total">
                  <strong style={{ fontSize: '18px' }}>
                    ${Number.parseFloat(selectedQuote.total || 0).toFixed(2)}
                  </strong>
                </Descriptions.Item>
                {selectedQuote.totalSqft && (
                  <Descriptions.Item label="Total Square Feet" span={2}>
                    {selectedQuote.totalSqft} sqft
                  </Descriptions.Item>
                )}
                {selectedQuote.notes && (
                  <Descriptions.Item label="Notes" span={2}>
                    {selectedQuote.notes}
                  </Descriptions.Item>
                )}
                {selectedQuote.clientNotes && (
                  <Descriptions.Item label="Client Notes" span={2}>
                    {selectedQuote.clientNotes}
                  </Descriptions.Item>
                )}
              </Descriptions>

              {selectedQuote.areas && selectedQuote.areas.length > 0 && (
                <>
                  <h3 style={{ marginTop: 24, marginBottom: 16 }}>Areas</h3>
                  {selectedQuote.areas.map((area, index) => (
                    <Card key={index} size="small" style={{ marginBottom: 12 }}>
                      <h4>{area.name}</h4>
                      <p>Job Type: {area.jobType}</p>
                      {area.laborItems && (
                        <div>
                          <strong>Labor Items:</strong>
                          <ul>
                            {area.laborItems.filter(item => item.selected).map((item, idx) => (
                              <li key={idx}>
                                {item.categoryName} - {item.numberOfCoats} coat(s) @ ${item.laborRate}/{item.measurementUnit}
                                {item.quantity && ` (${item.quantity} ${item.measurementUnit})`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </Card>
                  ))}
                </>
              )}

              {selectedQuote.productSets && selectedQuote.productSets.length > 0 && (
                <>
                  <h3 style={{ marginTop: 24, marginBottom: 16 }}>Product Sets</h3>
                  {selectedQuote.productSets.map((set, index) => (
                    <Card key={index} size="small" style={{ marginBottom: 12 }} loading={loadingProducts}>
                      <h4>{set.surfaceType}</h4>
                      {set.products && (
                        <div>
                          <p><strong>Good:</strong> {productNames[set.products.good] || `Product ID ${set.products.good}`}</p>
                          <p><strong>Better:</strong> {productNames[set.products.better] || `Product ID ${set.products.better}`}</p>
                          <p><strong>Best:</strong> {productNames[set.products.best] || `Product ID ${set.products.best}`}</p>
                        </div>
                      )}
                      {set.prices && (
                        <div style={{ marginTop: 8 }}>
                          <p><strong>Prices:</strong></p>
                          <p>Good: ${set.prices.good}</p>
                          <p>Better: ${set.prices.better}</p>
                          <p>Best: ${set.prices.best}</p>
                        </div>
                      )}
                    </Card>
                  ))}
                </>
              )}
            </>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default QuotesListPage;
