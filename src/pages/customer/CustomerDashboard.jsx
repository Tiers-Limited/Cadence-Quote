import { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Tag, 
  Typography, 
  Space, 
  Input,
  Modal,
  message,
  Tooltip,
  Badge,
  Alert,
  Select
} from 'antd';
import { 
  FiEye, 
  FiCheck, 
  FiX, 
  FiClock, 
  FiDollarSign,
  FiSearch,
  FiAlertCircle
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import '../../styles/customerPortal.css';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { confirm } = Modal;

function CustomerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchProposals();
  }, [pagination.current, pagination.pageSize, searchText, statusFilter]);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/customer/proposals', {
        params: {
          page: pagination.current,
          limit: pagination.pageSize,
          search: searchText,
          status: statusFilter
        }
      });
      
      if (response.success) {
        setProposals(response.data || []);
        setPagination(prev => ({
          ...prev,
          total: response.pagination?.total || 0
        }));
      }
    } catch (error) {
      message.error('Failed to load proposals: ' + error.message);
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
    setSearchText(value);
    setPagination({ ...pagination, current: 1 });
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setPagination({ ...pagination, current: 1 });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'orange',
      accepted: 'green',
      declined: 'red',
      deposit_paid: 'blue',
      completed: 'success',
      expired: 'default'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (record) => {
    if (record.isExpired && record.status === 'pending') return 'Expired';
    if (record.status === 'pending') return 'Awaiting Review';
    if (record.status === 'accepted' && !record.depositVerified) return 'Payment Required';
    if (record.depositVerified && !record.finishStandardsAcknowledged) return 'Acknowledge Standards';
    if (record.portalOpen) return 'Portal Open';
    if (record.selectionsComplete) return 'Selections Complete';
    if (record.status === 'completed') return 'Completed';
    if (record.status === 'declined') return 'Declined';
    return record.status;
  };

  const showAcceptModal = (record) => {
    confirm({
      title: 'Accept Proposal',
      icon: <FiCheck className="text-green-500" />,
      content: (
        <div className="py-4">
          <Paragraph>
            You are about to accept proposal <strong>{record.quoteNumber}</strong>
          </Paragraph>
          <Paragraph>
            Deposit Amount: <strong className="text-green-600">${record.depositAmount || (record.total * 0.5).toFixed(2)}</strong>
          </Paragraph>
          <Alert
            message="Next Steps"
            description="After accepting, you will be directed to make a deposit payment. Once the deposit is paid, you'll get access to the Customer Portal to make your product and color selections."
            type="info"
            showIcon
          />
        </div>
      ),
      okText: 'Accept & Continue to Payment',
      cancelText: 'Cancel',
      okButtonProps: { type: 'primary', size: 'large' },
      width: 600,
      onOk: () => handleAccept(record.id)
    });
  };

  const showDeclineModal = (record) => {
    let declineReason = '';
    
    confirm({
      title: 'Decline Proposal',
      icon: <FiX className="text-red-500" />,
      content: (
        <div className="py-4">
          <Paragraph>
            Are you sure you want to decline proposal <strong>{record.quoteNumber}</strong>?
          </Paragraph>
          <Paragraph type="secondary" className="mb-3">
            Optional: Let us know why you're declining
          </Paragraph>
          <Input.TextArea
            rows={4}
            placeholder="Reason for declining (optional)"
            onChange={(e) => declineReason = e.target.value}
          />
        </div>
      ),
      okText: 'Decline Proposal',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      width: 600,
      onOk: () => handleDecline(record.id, declineReason)
    });
  };

  const handleAccept = async (proposalId) => {
    try {
      setActionLoading(true);
      const response = await apiService.post(`/customer/proposals/${proposalId}/accept`, {
        selectedTier: 'standard' // Can be modified based on your tier selection logic
      });
      
      if (response.success) {
        message.success(response.message || 'Proposal accepted successfully!');
        // Navigate to payment page
        navigate(`/portal/proposal/${proposalId}?payment=true`);
      }
    } catch (error) {
      message.error(error.message || 'Failed to accept proposal');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async (proposalId, reason) => {
    try {
      setActionLoading(true);
      const response = await apiService.post(`/customer/proposals/${proposalId}/decline`, {
        reason
      });
      
      if (response.success) {
        message.success('Proposal declined');
        fetchProposals(); // Refresh list
      }
    } catch (error) {
      message.error(error.message || 'Failed to decline proposal');
    } finally {
      setActionLoading(false);
    }
  };

  const handleView = (record) => {
    if (record.status === 'pending') {
      navigate(`/portal/proposal/${record.id}`);
    } else if (record.status === 'accepted' && !record.depositVerified) {
      navigate(`/portal/proposal/${record.id}?payment=true`);
    } else if (record.depositVerified && !record.finishStandardsAcknowledged) {
      navigate(`/portal/finish-standards/${record.id}`);
    } else if (record.portalOpen || record.selectionsComplete) {
      navigate(`/portal/selections/${record.id}`);
    } else {
      navigate(`/portal/proposal/${record.id}`);
    }
  };

  const columns = [
    {
      title: 'Quote #',
      dataIndex: 'quoteNumber',
      key: 'quoteNumber',
      fixed: 'left',
      width: 120,
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          {record.isExpired && record.status === 'pending' && (
            <Tag color="red" icon={<FiAlertCircle />}>Expired</Tag>
          )}
        </Space>
      )
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 180,
      ellipsis: true
    },
    {
      title: 'Status',
      key: 'status',
      width: 180,
      render: (_, record) => (
        <Tag color={getStatusColor(record.status)} className="px-3 py-1">
          {getStatusText(record)}
        </Tag>
      )
    },
    {
      title: 'Total Amount',
      dataIndex: 'total',
      key: 'total',
      width: 130,
      align: 'right',
      render: (value) => (
        <Text strong className="text-green-600">${parseFloat(value).toFixed(2)}</Text>
      )
    },
    {
      title: 'Deposit',
      dataIndex: 'depositAmount',
      key: 'depositAmount',
      width: 120,
      align: 'right',
      render: (value, record) => {
        const amount = value || (record.total * 0.5);
        return (
          <Space direction="vertical" size={0}>
            <Text>${parseFloat(amount).toFixed(2)}</Text>
            {record.depositVerified && (
              <Tag color="green" icon={<FiCheck />}>Paid</Tag>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Valid Until',
      dataIndex: 'validUntil',
      key: 'validUntil',
      width: 120,
      render: (date) => date ? new Date(date).toLocaleDateString() : 'N/A'
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="link"
              icon={<FiEye />}
              onClick={() => handleView(record)}
            >
              View
            </Button>
          </Tooltip>
          
          {record.status === 'pending' && !record.isExpired && (
            <>
              <Tooltip title="Accept Proposal">
                <Button
                  type="primary"
                  size="small"
                  icon={<FiCheck />}
                  onClick={() => showAcceptModal(record)}
                  loading={actionLoading}
                >
                  Accept
                </Button>
              </Tooltip>
              
              <Tooltip title="Decline Proposal">
                <Button
                  danger
                  size="small"
                  icon={<FiX />}
                  onClick={() => showDeclineModal(record)}
                  loading={actionLoading}
                >
                  Decline
                </Button>
              </Tooltip>
            </>
          )}

          {record.status === 'accepted' && !record.depositVerified && (
            <Button
              type="primary"
              size="small"
              icon={<FiDollarSign />}
              onClick={() => navigate(`/portal/payment/${record.id}`)}
            >
              Pay Deposit
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <Title level={2}>My Quotes</Title>
        <Paragraph type="secondary">
          View and manage all your painting project quotes
        </Paragraph>
      </div>

      <Card>
        <div className="mb-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <Space wrap>
            <Search
              placeholder="Search by quote number, name, or email..."
              allowClear
              enterButton={<FiSearch />}
              size="large"
              style={{ width: 350 }}
              onSearch={handleSearch}
              onChange={(e) => !e.target.value && handleSearch('')}
            />
            
            <Select
              size="large"
              style={{ width: 180 }}
              value={statusFilter}
              onChange={handleStatusFilterChange}
              options={[
                { label: 'All Status', value: 'all' },
                { label: 'Pending', value: 'pending' },
                { label: 'Accepted', value: 'accepted' },
                { label: 'Declined', value: 'declined' },
                { label: 'Completed', value: 'completed' }
              ]}
            />
          </Space>

          <Badge count={proposals.length} showZero color="blue">
            <Button size="large">Total Quotes</Button>
          </Badge>
        </div>

        <Table
          columns={columns}
          dataSource={proposals}
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} quotes`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          onChange={handleTableChange}
          rowKey="id"
          scroll={{ x: 1300 }}
          className="custom-table"
        />
      </Card>
    </div>
  );
}

export default CustomerDashboard;
