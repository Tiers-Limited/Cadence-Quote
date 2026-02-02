import { useState, useEffect, useRef } from 'react';
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
  Select,
  Tabs
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
import { isAbortError } from '../../hooks/useAbortableEffect';
import '../../styles/customerPortal.css';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { confirm } = Modal;

function CustomerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [activeTab, setActiveTab] = useState('proposals');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);
  
  // AbortController ref for cancelling requests
  const abortControllerRef = useRef(null);

  useEffect(() => {
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this effect
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    if (activeTab === 'proposals') {
      fetchProposals(signal);
    } else {
      fetchJobs(signal);
    }
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [pagination.current, pagination.pageSize, searchText, statusFilter, activeTab]);

  const fetchProposals = async (signal) => {
    try {
      setLoading(true);
      const response = await apiService.get('/customer/proposals', {
        params: {
          page: pagination.current,
          limit: pagination.pageSize,
          search: searchText,
          status: statusFilter
        }
      }, { signal });
      
      if (signal && signal.aborted) return;
      
      if (response.success) {
        setProposals(response.data || []);
        setPagination(prev => ({
          ...prev,
          total: response.pagination?.total || 0
        }));
      }
    } catch (error) {
      if (isAbortError(error)) {
        console.log('Fetch proposals aborted');
        return;
      }
      message.error('Failed to load proposals: ' + error.message);
    } finally {
      if (signal && !signal.aborted) {
        setLoading(false);
      }
    }
  };

  const fetchJobs = async (signal) => {
    try {
      setLoading(true);
      const response = await apiService.get('/customer/jobs', null, { signal });
      
      if (signal && signal.aborted) return;
      
      if (response.success) {
        setJobs(response.data || []);
      }
    } catch (error) {
      if (isAbortError(error)) {
        console.log('Fetch jobs aborted');
        return;
      }
      message.error('Failed to load jobs: ' + error.message);
    } finally {
      if (signal && !signal.aborted) {
        setLoading(false);
      }
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
      expired: 'default',
      // Job statuses
      scheduled: 'blue',
      in_progress: 'processing',
      paused: 'warning',
      selections_pending: 'orange',
      selections_complete: 'cyan'
    };
    return colors[status] || 'default';
  };

  const getJobStatusText = (status) => {
    const statusTexts = {
      accepted: 'Accepted',
      pending_deposit: 'Awaiting Deposit',
      deposit_paid: 'Deposit Paid',
      selections_pending: 'Selections Pending',
      selections_complete: 'Selections Complete',
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      paused: 'Paused',
      completed: 'Completed',
      invoiced: 'Invoiced',
      paid: 'Paid',
      canceled: 'Canceled',
      on_hold: 'On Hold'
    };
    return statusTexts[status] || status;
  };

  const getStatusText = (record) => {
    if (record.isExpired && (record.status === 'sent' || record.status === 'pending')) return 'Expired';
    if (record.status === 'sent') return 'Awaiting Your Review';
    if (record.status === 'pending') return 'Awaiting Your Review';
    if (record.status === 'accepted' && !record.depositVerified) return 'Payment Required';
    if (record.depositVerified && !record.finishStandardsAcknowledged) return 'Acknowledge Standards';
    if (record.portalOpen) return 'Portal Open';
    if (record.selectionsComplete) return 'Selections Complete';
    if (record.status === 'completed') return 'Completed';
    if (record.status === 'declined') return 'Declined';
    return record.status;
  };

  const showAcceptModal = (record) => {
    // Instead of accepting directly, navigate to proposal view where customer can select tier
    navigate(`/portal/proposal/${record.id}`);
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
    // This function is no longer used - acceptance happens on ViewProposal page with tier selection
    // Keeping for backward compatibility but redirecting to proposal view
    navigate(`/portal/proposal/${proposalId}`);
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
    console.log('Viewing record:', record);
    if (record.status === 'pending' || record.status === 'sent') {
      // New flow: Use ProposalAcceptance component
      navigate(`/portal/proposals/${record.id}/accept`);
    } else if (record.status === 'accepted' && !record.depositVerified) {
      // Redirect to deposit payment
      navigate(`/portal/proposals/${record.id}/accept?step=payment`);
    } else if (record.depositVerified && record.portalOpen && !record.selectionsComplete) {
      // New flow: Use ProductSelectionWizard
      navigate(`/portal/proposals/${record.id}/selections`);
    } else if (record.selectionsComplete && record.jobId) {
      // New flow: Use JobTracking component
      navigate(`/portal/job/${record.jobId}`);
    } else {
      // Fallback to old proposal view
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
      render: (date) => date ? new Date(date).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      }) : 'N/A'
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })
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
          
          {(record.status === 'sent' || record.status === 'pending') && !record.isExpired && (
            <>
              <Tooltip title="View & Accept Proposal">
                <Button
                  type="primary"
                  size="small"
                  icon={<FiCheck />}
                  onClick={() => navigate(`/portal/proposals/${record.id}/accept`)}
                  loading={actionLoading}
                >
                  Review
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
              onClick={() => navigate(`/portal/proposals/${record.id}/accept?step=payment`)}
            >
              Pay Deposit
            </Button>
          )}
          
          {record.depositVerified && record.portalOpen && !record.selectionsComplete && (
            <Button
              type="primary"
              size="small"
              onClick={() => navigate(`/portal/proposals/${record.id}/selections`)}
            >
              Make Selections
            </Button>
          )}
          
          {record.selectionsComplete && record.jobId && (
            <Button
              type="primary"
              size="small"
              onClick={() => navigate(`/portal/job/${record.jobId}`)}
            >
              Track Job
            </Button>
          )}
        </Space>
      )
    }
  ];

  const jobColumns = [
    {
      title: 'Job #',
      dataIndex: 'jobNumber',
      key: 'jobNumber',
      fixed: 'left',
      width: 150,
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Job Name',
      dataIndex: 'jobName',
      key: 'jobName',
      width: 200,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
          
      render: (status) => (
        <Tag color={getStatusColor(status)} className="px-3 py-1">
          {getJobStatusText(status)}
        </Tag>
      )
    },
    {
      title: 'Scheduled Start',
      dataIndex: 'scheduledStartDate',
      key: 'scheduledStartDate',
      width: 140,
      render: (date) => date ? new Date(date).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      }) : 'Not scheduled'
    },
    {
      title: 'Scheduled End',
      dataIndex: 'scheduledEndDate',
      key: 'scheduledEndDate',
      width: 140,
      render: (date) => date ? new Date(date).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      }) : 'Not scheduled'
    },
    {
      title: 'Duration',
      dataIndex: 'estimatedDuration',
      key: 'estimatedDuration',
      width: 100,
      render: (duration) => duration ? `${duration} days` : 'N/A'
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 130,
      align: 'right',
      render: (value) => (
        <Text strong className="text-green-600">${parseFloat(value).toFixed(2)}</Text>
      )
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            onClick={() => navigate(`/portal/job/${record.id}`)}
          >
            Track Job
          </Button>
          <Button
            type="link"
            size="small"
            icon={<FiEye />}
            onClick={() => navigate(`/portal/job/${record.id}`)}
          >
            Details
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <Title level={2}>My Dashboard</Title>
        <Paragraph type="secondary">
          View and manage your painting project quotes and jobs
        </Paragraph>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'quotes',
              label: (
                <span>
                  <Badge count={proposals.length} offset={[10, 0]} showZero>
                    Quotes
                  </Badge>
                </span>
              ),
              children: (
                <>
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
                          { label: 'All Quotes', value: 'all' },
                          { label: 'Awaiting Review', value: 'sent' },
                          { label: 'Accepted', value: 'accepted' },
                          { label: 'Declined', value: 'declined' },
                          { label: 'Completed', value: 'completed' }
                        ]}
                      />
                    </Space>
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
                </>
              )
            },
            {
              key: 'jobs',
              label: (
                <span>
                  <Badge count={jobs.length} offset={[10, 0]} showZero>
                    Jobs
                  </Badge>
                </span>
              ),
              children: (
                <Table
                  columns={jobColumns}
                  dataSource={jobs}
                  loading={loading}
                  pagination={false}
                  rowKey="id"
                  scroll={{ x: 1200 }}
                  className="custom-table"
                />
              )
            }
          ]}
        />
      </Card>
    </div>
  );
}

export default CustomerDashboard;
