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
  Select,
  Tabs,
  Layout,
  Popconfirm
} from 'antd';
import { 
  FiEye, 
  FiCheck, 
  FiX, 
  FiClock, 
  FiDollarSign,
  FiSearch,
  FiAlertCircle,
  FiUnlock,
  FiShield,
  FiCalendar,
  FiFileText
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/customerPortal.css';
import BrandedPortalHeader from './BrandedPortalHeader';
import PortalFooter from './PortalFooter';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { confirm } = Modal;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api/v1';

function MagicLinkCustomerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [activeTab, setActiveTab] = useState('proposals');
  const [sessionToken, setSessionToken] = useState(null);
  const [clientInfo, setClientInfo] = useState(null);
  const [branding, setBranding] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [allowMultiJob, setAllowMultiJob] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [singleQuoteId, setSingleQuoteId] = useState(null);

  useEffect(() => {
    // Check for magic link session
    const token = localStorage.getItem('portalSession');
    const client = localStorage.getItem('portalClient');
    const brandingData = localStorage.getItem('tenantBranding');
    const quoteData = localStorage.getItem('portalQuote');
    const verified = localStorage.getItem('portalVerified') === 'true';
    const multiJobAccess = localStorage.getItem('portalAllowMultiJob') === 'true';
    
    if (!token) {
      navigate('/portal/access');
      return;
    }
    
    setSessionToken(token);
    setIsVerified(verified);
    setAllowMultiJob(multiJobAccess);
    
    if (client) {
      setClientInfo(JSON.parse(client));
    }
    
    if (brandingData) {
      setBranding(JSON.parse(brandingData));
    }
    
    if (quoteData) {
      const quote = JSON.parse(quoteData);
      setSingleQuoteId(quote.id);
    }
    
    // Fetch data immediately with the token
    if (activeTab === 'proposals') {
      fetchProposalsWithToken(token);
    } else {
      fetchJobsWithToken(token);
    }
  }, [activeTab]);

  const fetchProposalsWithToken = async (token) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/quotes`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );
       
      if (response.data.success) {
       
        setProposals(response.data.quotes || []);
      }
    } catch (error) {
      console.error('Failed to load proposals:', error);
      if (error.response?.status === 401) {
        navigate('/portal/access');
      } else {
        message.error('Failed to load proposals');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchProposals = async () => {
    const token = localStorage.getItem('portalSession');
    if (!token) {
      navigate('/portal/access');
      return;
    }
    await fetchProposalsWithToken(token);
  };

  const fetchJobsWithToken = async (token) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/jobs`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );
      
      if (response.data.success) {
        setJobs(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
      message.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    const token = localStorage.getItem('portalSession');
    if (!token) {
      navigate('/portal/access');
      return;
    }
    await fetchJobsWithToken(token);
  };

  // OTP Verification Functions
  const requestOTP = async () => {
    try {
      setOtpLoading(true);
      const response = await axios.post(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/request-otp`,
        {
          sessionToken,
          method: 'email', // or 'sms'
          target: clientInfo?.email
        }
      );
      
      if (response.data.success) {
        message.success('Verification code sent to your email!');
        setShowOTPModal(true);
      }
    } catch (error) {
      console.error('Failed to request OTP:', error);
      message.error('Failed to send verification code');
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOTP = async () => {
    try {
      setOtpLoading(true);
      const response = await axios.post(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/verify-otp`,
        {
          sessionToken,
          code: otpCode
        }
      );
      
      if (response.data.success) {
        message.success('Verification successful! You now have access to all your projects.');
        setIsVerified(true);
        localStorage.setItem('portalVerified', 'true');
        setShowOTPModal(false);
        setOtpCode('');
        // Refresh data to show all proposals/jobs
        if (activeTab === 'proposals') {
          fetchProposals();
        } else {
          fetchJobs();
        }
      }
    } catch (error) {
      console.error('Failed to verify OTP:', error);
      message.error(error.response?.data?.message || 'Invalid verification code');
    } finally {
      setOtpLoading(false);
    }
  };

  // Filter data based on verification status
  const getFilteredQuotes = () => {
   
    // Show only the single quote from magic link if unverified
    return proposals
  };

  const getFilteredJobs = () => {
   
    // Show only jobs related to the single quote if unverified
    return jobs
  };

  // Quick Actions
  const handleQuickApprove = async (quoteId) => {
    try {
      const token = localStorage.getItem('portalSession');
      const response = await axios.post(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/quotes/${quoteId}/approve`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );
      
      if (response.data.success) {
        message.success('Quote approved successfully!');
        fetchProposals();
      }
    } catch (error) {
      console.error('Failed to approve quote:', error);
      message.error('Failed to approve quote');
    }
  };

  const handleQuickReject = async (quoteId) => {
    try {
      const token = localStorage.getItem('portalSession');
      const response = await axios.post(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/quotes/${quoteId}/reject`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );
      
      if (response.data.success) {
        message.success('Quote rejected');
        fetchProposals();
      }
    } catch (error) {
      console.error('Failed to reject quote:', error);
      message.error('Failed to reject quote');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'orange',
      sent: 'blue',
      accepted: 'green',
      scheduled: 'green',
      declined: 'red',
      completed: 'cyan',
      expired: 'default'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: 'Pending',
      sent: 'Sent',
      accepted: 'Accepted',
      scheduled: 'Scheduled',
      declined: 'Declined',
      completed: 'Completed',
      expired: 'Expired'
    };
    return texts[status] || status;
  };

  const computeAreaProgressText = (record) => {
    const areas = record.quote?.areas || record.areas || [];
    const total = Array.isArray(areas) ? areas.length : 0;
    const progressMap = record.job?.areaProgress || record.areaProgress || {};
    const updatedCount = Object.keys(progressMap || {}).length;
    if (total > 0 && updatedCount > 0) return `${updatedCount}/${total} areas updated`;
    if (total > 0) return `${total} areas`;
    if (updatedCount > 0) return `${updatedCount} areas updated`;
    return null;
  };

  // Ensure customer acknowledges finish standards before entering selections
  const navigateToSelectionsGuarded = (record, selectionsPath) => {
    if (record.depositVerified && !record.finishStandardsAcknowledged) {
      navigate(`/portal/finish-standards/${record.id}`);
      return;
    }
    navigate(selectionsPath);
  };

  const proposalColumns = [
    {
      title: 'Quote Number',
      dataIndex: 'quoteNumber',
      key: 'quoteNumber',
      width: 150,
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: 'Job Type',
      dataIndex: 'jobType',
      key: 'jobType',
      width: 120,
      render: (type) => type || 'N/A'
    },
    {
      title: 'Total Amount',
      dataIndex: 'total',
      key: 'total',
      width: 150,
      render: (amount) => (
        <Text strong style={{ color: '#1890ff' }}>
          ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      )
    },
    {
      title: 'Created Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date) => new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    },
   
    {
      title: 'Actions',
      key: 'actions',
      width: 320,
      fixed: 'right',
      render: (_, record) => {
        const primaryColor = branding?.primaryColor || '#1890ff';
        
        return (
          <Space size="small" wrap>
            <Button
              type="link"
              icon={<FiEye />}
              onClick={() => {
                // Use new ProposalAcceptance route
                if (record.status === 'sent' || record.status === 'pending') {
                  navigate(`/portal/proposals/${record.id}/accept`);
                } else if (record.depositVerified && record.portalOpen && !record.selectionsComplete) {
                  navigateToSelectionsGuarded(record, `/portal/proposals/${record.id}/selections`);
                } else if (record.selectionsComplete && record.jobId) {
                  navigate(`/portal/job/${record.jobId}`);
                } else {
                  navigate(`/portal/job/${record.jobId}`);
                }
              }}
            >
              View
            </Button>

            <Button
              type="link"
              icon={<FiFileText />}
              onClick={() => navigate(`/portal/documents/${record.id}`)}
              title="View Documents"
            >
              Documents
            </Button>
            
            {(record.status === 'sent' || record.status === 'pending') && (
              <>
                <Button
                  type="primary"
                  size="small"
                  icon={<FiCheck />}
                  style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                  onClick={() => navigate(`/portal/proposals/${record.id}/accept`)}
                >
                  Review & Accept
                </Button>
                
                <Popconfirm
                  title="Reject this quote?"
                  onConfirm={() => handleQuickReject(record.id)}
                  okType="danger"
                >
                  <Button danger size="small" icon={<FiX />}>
                    Reject
                  </Button>
                </Popconfirm>
              </>
            )}
            
            {record.status === 'accepted' && !record.depositVerified && (
              <Button
                type="primary"
                size="small"
                icon={<FiDollarSign />}
                onClick={() => navigate(`/portal/proposals/${record.id}/accept?step=payment`)}
                style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
              >
                Pay Deposit
              </Button>
            )}
            
            {record.depositVerified && record.portalOpen && !record.selectionsComplete && (
              <Button
                type="primary"
                size="small"
                onClick={() => navigateToSelectionsGuarded(record, `/portal/proposals/${record.id}/selections`)}
                style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
              >
                Make Selections
              </Button>
            )}
            
            {record.selectionsComplete && record.jobId && (
              <Button
                type="primary"
                size="small"
                onClick={() => navigate(`/portal/job/${record.jobId}`)}
                style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
              >
                Track Job
              </Button>
            )}
          </Space>
        );
      }
    }
  ];

  const jobColumns = [
    {
      title: 'Job Number',
      dataIndex: 'jobNumber',
      key: 'jobNumber',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 160,
      render: (_, record) => {
        const txt = computeAreaProgressText(record);
        return txt ? <Text>{txt}</Text> : null;
      }
    },
    {
      title: 'Job Name',
      dataIndex: 'jobName',
      key: 'jobName',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount) => (
        <Text strong style={{ color: '#1890ff' }}>
          ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={() => navigate(`/portal/job/${record.id}`)}
            style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
          >
            Track Job
          </Button>
          <Button
            type="link"
            icon={<FiEye />}
            onClick={() => navigate(`/portal/jobs/${record.id}`)}
          >
            Details
          </Button>
        </Space>
      )
    }
  ];

  const filteredQuotes = getFilteredQuotes();
  const filteredJobs = getFilteredJobs();
  const primaryColor = branding?.primaryColor || '#1890ff';

  return (
    <>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Card style={{ marginBottom: '24px' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <Title level={2} style={{ margin: 0, color: primaryColor }}>
                    Welcome, {clientInfo?.name || 'Customer'}!
                  </Title>
                  <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>
                    View and manage your proposals and projects below.
                  </Paragraph>
                </div>
                <Button
                  type="primary"
                  icon={<FiCalendar />}
                  onClick={() => navigate('/portal/calendar')}
                  size="large"
                  style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                >
                  View Calendar
                </Button>
              </div>

              {!isVerified && allowMultiJob && (
                <Alert
                  message="Unlock All Your Projects"
                  description={
                    <Space direction="vertical" size="small">
                      <Text>
                        You have multiple projects with {branding?.companyName}. 
                        Verify your identity to access all of them.
                      </Text>
                      <Button
                        type="primary"
                        icon={<FiUnlock />}
                        onClick={requestOTP}
                        loading={otpLoading}
                        style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                      >
                        Verify to See All Projects
                      </Button>
                    </Space>
                  }
                  type="info"
                  icon={<FiShield />}
                  showIcon
                />
              )}

              {isVerified && (
                <Alert
                  message="Verified Account"
                  description={`You have full access to all your projects with ${branding?.companyName}.`}
                  type="success"
                  icon={<FiShield />}
                  showIcon
                />
              )}
            </Space>
          </Card>

          <Card>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'proposals',
                  label: (
                    <span>
                            <FiDollarSign style={{ marginRight: '8px' }} />
                            Proposals {filteredQuotes.length > 0 && `(${filteredQuotes.length})`}
                    </span>
                  ),
                  children: (
                    <Table
                      columns={proposalColumns}
                      dataSource={filteredQuotes}
                      loading={loading}
                      rowKey="id"
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 1200 }}
                    />
                  )
                },
                {
                  key: 'jobs',
                  label: (
                    <span>
                      <FiClock style={{ marginRight: '8px' }} />
                      Active Jobs {filteredJobs.length > 0 && `(${filteredJobs.length})`}
                    </span>
                  ),
                  children: (
                    <Table
                      columns={jobColumns}
                      dataSource={filteredJobs}
                      loading={loading}
                      rowKey="id"
                      pagination={{ pageSize: 10 }}
                    />
                  )
                }
              ]}
            />
          </Card>
        </div>
    

      <Modal
        title={
          <Space>
            <FiShield />
            <span>Verify Your Identity</span>
          </Space>
        }
        open={showOTPModal}
        onOk={verifyOTP}
        onCancel={() => {
          setShowOTPModal(false);
          setOtpCode('');
        }}
        okText="Verify"
        confirmLoading={otpLoading}
        okButtonProps={{ 
          style: { backgroundColor: primaryColor, borderColor: primaryColor },
          disabled: otpCode.length !== 6
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Paragraph>
            A 6-digit code was sent to <Text strong>{clientInfo?.email}</Text>.
            Enter it below to access all your projects.
          </Paragraph>
          
          <Input
            placeholder="Enter 6-digit code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            size="large"
            style={{ 
              fontSize: '24px',
              textAlign: 'center',
              letterSpacing: '8px'
            }}
          />
          
          <Button type="link" onClick={requestOTP} loading={otpLoading} block>
            Didn't receive the code? Resend
          </Button>
        </Space>
      </Modal>
    </>
  );
}

export default MagicLinkCustomerDashboard;
