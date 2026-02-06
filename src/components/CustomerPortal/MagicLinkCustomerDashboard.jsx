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
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      console.log('🔍 Fetching proposals with token...');
      
      const response = await axios.get(
        `${API_BASE_URL.replace('/api/v1', '')}/api/customer-portal/quotes`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );
       
      console.log('🔍 Proposals response:', response.data);
       
      if (response.data.success) {
        const quotes = response.data.quotes || [];
        const verified = response.data.isVerified;
        
        console.log('🔍 Got quotes:', quotes.length, 'Verified:', verified);
        
        setProposals(quotes);
        setIsVerified(verified);
        
        // Update localStorage with current verification status
        localStorage.setItem('portalVerified', verified.toString());
        
        // Check if customer has multiple projects but isn't verified
        // This indicates they should be offered verification
        if (!verified && quotes.length > 0) {
          // Check if this customer has more quotes available after verification
          checkForMultipleProjects(token);
        }
        
        // If we have no quotes and we're not verified, show a helpful message
        if (quotes.length === 0 && !verified) {
          console.warn('⚠️ No quotes found for unverified customer - possible session issue');
          message.warning('No proposals found. This might be a session issue. Please try accessing your portal link again.');
        }
      }
    } catch (error) {
      console.error('Failed to load proposals:', error);
      if (error.response?.status === 401) {
        message.error('Your session has expired. Please access your portal link again.');
        localStorage.removeItem('portalSession');
        localStorage.removeItem('portalClient');
        localStorage.removeItem('portalVerified');
        navigate('/portal/access');
      } else {
        message.error('Failed to load proposals');
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if customer has multiple projects that would be available after verification
  const checkForMultipleProjects = async (token) => {
    try {
      // This is a simple heuristic - if allowMultiJobAccess was set during login,
      // it means there are multiple projects available
      const storedAllowMultiJob = localStorage.getItem('portalAllowMultiJob') === 'true';
      if (storedAllowMultiJob) {
        setAllowMultiJob(true);
      }
    } catch (error) {
      console.error('Failed to check for multiple projects:', error);
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
          method: 'email',
          target: clientInfo?.email
        }
      );
      
      if (response.data.success) {
        message.success({
          content: `Verification code sent to ${clientInfo?.email}!`,
          duration: 3,
          style: { marginTop: '20vh' }
        });
        setShowOTPModal(true);
      }
    } catch (error) {
      console.error('Failed to request OTP:', error);
      const errorMessage = error.response?.data?.message || 'Failed to send verification code';
      
      if (errorMessage.includes('Too many')) {
        message.error('Too many verification requests. Please wait 5 minutes and try again.');
      } else if (errorMessage.includes('No email')) {
        message.error('No email address found. Please contact support for assistance.');
      } else {
        message.error(errorMessage);
      }
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
        // Show success message
        message.success({
          content: 'Verification successful! You now have access to all your projects.',
          duration: 4,
          style: { marginTop: '20vh' }
        });
        
        // Update state
        setIsVerified(true);
        setAllowMultiJob(false); // No longer need to show verification prompt
        localStorage.setItem('portalVerified', 'true');
        
        // Close modal
        setShowOTPModal(false);
        setOtpCode('');
        
        // Update session token if provided
        if (response.data.session?.token) {
          localStorage.setItem('portalSession', response.data.session.token);
          setSessionToken(response.data.session.token);
        }
        
        // Refresh data to show all proposals/jobs
        if (activeTab === 'proposals') {
          fetchProposals();
        } else {
          fetchJobs();
        }
        
        // Show a celebration effect
        setTimeout(() => {
          message.info({
            content: `🎉 Welcome! You can now see all your projects with ${branding?.companyName}.`,
            duration: 3,
            style: { marginTop: '20vh' }
          });
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to verify OTP:', error);
      const errorMessage = error.response?.data?.message || 'Invalid verification code';
      message.error(errorMessage);
      
      // If too many attempts, close modal and suggest requesting new code
      if (errorMessage.includes('Too many') || errorMessage.includes('locked')) {
        setShowOTPModal(false);
        setOtpCode('');
        setTimeout(() => {
          message.warning('Please request a new verification code and try again.');
        }, 500);
      }
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
      width: isMobile ? 120 : 150,
      render: (text) => <Text strong className={isMobile ? 'text-xs' : ''}>{text}</Text>,
      responsive: ['xs', 'sm', 'md', 'lg']
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: isMobile ? 100 : 120,
      render: (status) => (
        <Tag color={getStatusColor(status)} className={isMobile ? 'text-xs' : ''}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: 'Job Type',
      dataIndex: 'jobType',
      key: 'jobType',
      width: 120,
      render: (type) => type || 'N/A',
      responsive: ['md', 'lg']
    },
    {
      title: 'Total Amount',
      dataIndex: 'total',
      key: 'total',
      width: isMobile ? 120 : 150,
      render: (amount) => (
        <Text strong style={{ color: '#1890ff', fontSize: isMobile ? '12px' : '14px' }}>
          ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      )
    },
    {
      title: 'Created Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date) => (
        <span className={isMobile ? 'text-xs' : ''}>
          {new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </span>
      ),
      responsive: ['sm', 'md', 'lg']
    },
   
    {
      title: 'Actions',
      key: 'actions',
      width: isMobile ? 100 : 320,
      fixed: isMobile ? undefined : 'right',
      render: (_, record) => {
        const primaryColor = branding?.primaryColor || '#1890ff';
        
        return (
          <Space size="small" wrap direction={isMobile ? 'vertical' : 'horizontal'} className={isMobile ? 'w-full' : ''}>
            <Button
              type="link"
              icon={<FiEye />}
              size={isMobile ? 'small' : 'default'}
              block={isMobile}
              onClick={() => {
                // Use new ProposalAcceptance route
                if (record.status === 'sent' || record.status === 'pending' || record.status === "viewed") {
                  navigate(`/portal/proposals/${record.id}/accept`);
                } else if (record.depositVerified && record.portalOpen && !record.selectionsComplete) {
                  navigateToSelectionsGuarded(record, `/portal/proposals/${record.id}/selections`);
                } else if (record.selectionsComplete && record.jobId) {
                  navigate(`/portal/job/${record.jobId}`);
                } else {
                  navigate(`/portal/proposals/${record.id}/accept`);
                }
              }}
            >
              View
            </Button>

            <Button
              type="link"
              icon={<FiFileText />}
              size={isMobile ? 'small' : 'default'}
              block={isMobile}
              onClick={() => navigate(`/portal/documents/${record.id}`)}
              title="View Documents"
            >
              Documents
            </Button>
            
            {(record.status === 'sent' || record.status === 'pending' || record.status === "viewed") && (
              <>
                <Button
                  type="primary"
                  size="small"
                  icon={<FiCheck />}
                  block={isMobile}
                  style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                  onClick={() => navigate(`/portal/proposals/${record.id}/accept`)}
                >
                  {isMobile ? 'Accept' : 'Review & Accept'}
                </Button>
                
                <Popconfirm
                  title="Reject this quote?"
                  onConfirm={() => handleQuickReject(record.id)}
                  okType="danger"
                >
                  <Button danger size="small" icon={<FiX />} block={isMobile}>
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
                block={isMobile}
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
                block={isMobile}
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
                block={isMobile}
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
      render: (text) => <Text strong className={isMobile ? 'text-xs' : ''}>{text}</Text>
    },
    {
      title: 'Progress',
      key: 'progress',
      width: isMobile ? 140 : 160,
      render: (_, record) => {
        const txt = computeAreaProgressText(record);
        return txt ? <Text className={isMobile ? 'text-xs' : ''}>{txt}</Text> : null;
      },
      responsive: ['sm', 'md', 'lg']
    },
    {
      title: 'Job Name',
      dataIndex: 'jobName',
      key: 'jobName',
      render: (text) => <span className={isMobile ? 'text-xs' : ''}>{text}</span>,
      responsive: ['md', 'lg']
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)} className={isMobile ? 'text-xs' : ''}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount) => (
        <Text strong style={{ color: '#1890ff', fontSize: isMobile ? '12px' : '14px' }}>
          ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space direction={isMobile ? 'vertical' : 'horizontal'} className={isMobile ? 'w-full' : ''}>
          <Button
            type="primary"
            size="small"
            block={isMobile}
            onClick={() => navigate(`/portal/job/${record.id}`)}
            style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
          >
            Track Job
          </Button>
          <Button
            type="link"
            icon={<FiEye />}
            size={isMobile ? 'small' : 'default'}
            block={isMobile}
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
        <div className="px-3 sm:px-6" style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Card className="mb-4 sm:mb-6">
            <Space direction="vertical" size={isMobile ? "middle" : "large"} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: isMobile ? '12px' : '16px' }}>
                <div className="flex-1 min-w-0">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <Title level={isMobile ? 3 : 2} style={{ margin: 0, color: primaryColor }}>
                      Welcome, {clientInfo?.name || 'Customer'}!
                    </Title>
                    {isVerified && (
                      <Tag 
                        icon={<FiShield />} 
                        color="success" 
                        style={{ 
                          fontSize: isMobile ? '11px' : '12px', 
                          padding: isMobile ? '2px 6px' : '4px 8px',
                          borderRadius: '12px'
                        }}
                      >
                        Verified
                      </Tag>
                    )}
                  </div>
                  <Paragraph type="secondary" style={{ margin: '0', fontSize: isMobile ? '13px' : '14px' }}>
                    {isVerified 
                      ? `You have full access to all your projects with ${branding?.companyName}.`
                      : 'View and manage your proposals and projects below.'
                    }
                  </Paragraph>
                </div>
                <Space direction={isMobile ? 'vertical' : 'horizontal'} className={isMobile ? 'w-full' : ''}>
                  {!isVerified && (allowMultiJob || proposals.length > 0) && (
                    <Button
                      type="default"
                      icon={<FiUnlock />}
                      onClick={requestOTP}
                      loading={otpLoading}
                      block={isMobile}
                      size={isMobile ? 'middle' : 'default'}
                      style={{ 
                        borderColor: primaryColor,
                        color: primaryColor
                      }}
                    >
                      Verify Identity
                    </Button>
                  )}
                  <Button
                    type="primary"
                    icon={<FiCalendar />}
                    onClick={() => navigate('/portal/calendar')}
                    size={isMobile ? 'middle' : 'large'}
                    block={isMobile}
                    style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                  >
                    View Calendar
                  </Button>
                </Space>
              </div>

              {!isVerified && (allowMultiJob || proposals.length > 0) && (
                <Alert
                  message="Unlock All Your Projects"
                  description={
                    <Space direction="vertical" size="small">
                      <Text>
                        You may have multiple projects with {branding?.companyName}. 
                        Verify your identity to access all of them and see your complete project history.
                      </Text>
                      <Space className='flex flex-wrap'>
                        <Button
                          type="primary"
                          icon={<FiUnlock />}
                          onClick={requestOTP}
                          loading={otpLoading}
                          style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                        >
                          Verify Identity
                        </Button>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          We'll send a code to your email
                        </Text>
                      </Space>
                    </Space>
                  }
                  type="info"
                  icon={<FiShield />}
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              )}

              {!isVerified && !allowMultiJob && filteredQuotes.length === 0 && (
                <Alert
                  message="No Proposals Found"
                  description={
                    <Space direction="vertical" size="small">
                      <Text>
                        We couldn't find any proposals for your account. This might be a session issue.
                      </Text>
                      <Text type="secondary">
                        Please try accessing your portal link again, or contact {branding?.companyName} if you continue to have issues.
                      </Text>
                      <Button
                        type="primary"
                        onClick={() => {
                          localStorage.clear();
                          navigate('/portal/access');
                        }}
                        style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                      >
                        Access Portal Again
                      </Button>
                    </Space>
                  }
                  type="warning"
                  icon={<FiAlertCircle />}
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
              size={isMobile ? 'small' : 'default'}
              items={[
                {
                  key: 'proposals',
                  label: (
                    <span className={isMobile ? 'text-xs' : ''}>
                            <FiDollarSign style={{ marginRight: '8px' }} />
                            {isMobile ? 'Proposals' : `Proposals ${filteredQuotes.length > 0 ? `(${filteredQuotes.length})` : ''}`}
                    </span>
                  ),
                  children: (
                    <div>
                      {!isVerified && (allowMultiJob || proposals.length > 0) && (
                        <Alert
                          message="Limited View"
                          description={
                            <Space className='flex flex-wrap'>
                              <Text style={{ fontSize: isMobile ? '12px' : '14px' }}>You're seeing a limited view. Verify your identity to access all your projects.</Text>
                              <Button 
                                type="link" 
                                size="small" 
                                onClick={requestOTP}
                                loading={otpLoading}
                                style={{ padding: 0, height: 'auto' }}
                              >
                                Verify Now
                              </Button>
                            </Space>
                          }
                          type="warning"
                          showIcon
                          style={{ marginBottom: isMobile ? '12px' : '16px' }}
                        />
                      )}
                      <Table
                        columns={proposalColumns}
                        dataSource={filteredQuotes}
                        loading={loading}
                        rowKey="id"
                        pagination={{ 
                          pageSize: isMobile ? 5 : 10,
                          simple: isMobile,
                          showSizeChanger: !isMobile
                        }}
                        scroll={{ x: isMobile ? 600 : 1200 }}
                        size={isMobile ? 'small' : 'default'}
                        locale={{
                          emptyText: !isVerified && (allowMultiJob || proposals.length === 0) 
                            ? (
                              <div style={{ padding: isMobile ? '20px' : '40px', textAlign: 'center' }}>
                                <div style={{ fontSize: isMobile ? '32px' : '48px', marginBottom: isMobile ? '12px' : '16px' }}>🔒</div>
                                <Title level={isMobile ? 5 : 4} type="secondary">No Proposals Visible</Title>
                                <Paragraph type="secondary" style={{ fontSize: isMobile ? '12px' : '14px' }}>
                                  You may have additional projects that require verification to view.
                                </Paragraph>
                                <Button 
                                  type="primary" 
                                  onClick={requestOTP}
                                  loading={otpLoading}
                                  block={isMobile}
                                  style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                                >
                                  Verify to See All Projects
                                </Button>
                              </div>
                            )
                            : 'No proposals found'
                        }}
                      />
                    </div>
                  )
                },
                {
                  key: 'jobs',
                  label: (
                    <span className={isMobile ? 'text-xs' : ''}>
                      <FiClock style={{ marginRight: '8px' }} />
                      {isMobile ? 'Jobs' : `Active Jobs ${filteredJobs.length > 0 ? `(${filteredJobs.length})` : ''}`}
                    </span>
                  ),
                  children: (
                    <div>
                      {!isVerified && (allowMultiJob || jobs.length > 0) && (
                        <Alert
                          message="Limited View"
                          description={
                            <Space className='flex flex-wrap'>
                              <Text style={{ fontSize: isMobile ? '12px' : '14px' }}>You're seeing a limited view. Verify your identity to access all your jobs.</Text>
                              <Button 
                                type="link" 
                                size="small" 
                                onClick={requestOTP}
                                loading={otpLoading}
                                style={{ padding: 0, height: 'auto' }}
                              >
                                Verify Now
                              </Button>
                            </Space>
                          }
                          type="warning"
                          showIcon
                          style={{ marginBottom: isMobile ? '12px' : '16px' }}
                        />
                      )}
                      <Table
                        columns={jobColumns}
                        dataSource={filteredJobs}
                        loading={loading}
                        rowKey="id"
                        pagination={{ 
                          pageSize: isMobile ? 5 : 10,
                          simple: isMobile,
                          showSizeChanger: !isMobile
                        }}
                        scroll={{ x: isMobile ? 500 : 'max-content' }}
                        size={isMobile ? 'small' : 'default'}
                        locale={{
                          emptyText: !isVerified && (allowMultiJob || jobs.length === 0)
                            ? (
                              <div style={{ padding: isMobile ? '20px' : '40px', textAlign: 'center' }}>
                                <div style={{ fontSize: isMobile ? '32px' : '48px', marginBottom: isMobile ? '12px' : '16px' }}>🔒</div>
                                <Title level={isMobile ? 5 : 4} type="secondary">No Jobs Visible</Title>
                                <Paragraph type="secondary" style={{ fontSize: isMobile ? '12px' : '14px' }}>
                                  You may have additional jobs that require verification to view.
                                </Paragraph>
                                <Button 
                                  type="primary" 
                                  onClick={requestOTP}
                                  loading={otpLoading}
                                  block={isMobile}
                                  style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                                >
                                  Verify to See All Jobs
                                </Button>
                              </div>
                            )
                            : 'No jobs found'
                        }}
                      />
                    </div>
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
            <span style={{ fontSize: isMobile ? '14px' : '16px' }}>Verify Your Identity</span>
          </Space>
        }
        open={showOTPModal}
        onOk={verifyOTP}
        onCancel={() => {
          setShowOTPModal(false);
          setOtpCode('');
        }}
        okText="Verify Code"
        cancelText="Cancel"
        confirmLoading={otpLoading}
        okButtonProps={{ 
          style: { backgroundColor: primaryColor, borderColor: primaryColor },
          disabled: otpCode.length !== 6
        }}
        width={isMobile ? '90%' : 500}
        centered={isMobile}
        style={isMobile ? { top: 20 } : {}}
      >
        <Space direction="vertical" size={isMobile ? "middle" : "large"} style={{ width: '100%' }}>
          <div style={{ textAlign: 'center', padding: isMobile ? '12px 0' : '20px 0' }}>
            <div style={{ 
              fontSize: isMobile ? '36px' : '48px', 
              color: primaryColor, 
              marginBottom: isMobile ? '8px' : '16px' 
            }}>
              📧
            </div>
            <Title level={isMobile ? 5 : 4} style={{ margin: 0, color: primaryColor }}>
              Check Your Email
            </Title>
          </div>
          
          <Paragraph style={{ textAlign: 'center', fontSize: isMobile ? '13px' : '16px' }}>
            We sent a 6-digit verification code to:
            <br />
            <Text strong style={{ fontSize: isMobile ? '14px' : '18px', wordBreak: 'break-word' }}>
              {clientInfo?.email}
            </Text>
          </Paragraph>
          
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ marginBottom: '8px', display: 'block', fontSize: isMobile ? '12px' : '14px' }}>
              Enter the code below:
            </Text>
            <Input
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              size={isMobile ? 'middle' : 'large'}
              style={{ 
                fontSize: isMobile ? '24px' : '32px',
                textAlign: 'center',
                letterSpacing: isMobile ? '4px' : '8px',
                fontWeight: 'bold',
                height: isMobile ? '48px' : '60px',
                borderRadius: '8px',
                border: `2px solid ${primaryColor}20`,
                backgroundColor: '#fafafa'
              }}
              onPressEnter={verifyOTP}
            />
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: '12px', display: 'block' }}>
              Code expires in 10 minutes
            </Text>
            <Button 
              type="link" 
              onClick={requestOTP} 
              loading={otpLoading}
              size={isMobile ? 'small' : 'default'}
              style={{ padding: 0, height: 'auto', fontSize: isMobile ? '12px' : '14px' }}
            >
              Didn't receive the code? Send again
            </Button>
          </div>
          
          <Alert
            message="Why verify?"
            description="Verification allows you to see all your projects with this contractor in one place, track job progress, and access your complete project history."
            type="info"
            showIcon
            style={{ marginTop: isMobile ? '8px' : '16px', fontSize: isMobile ? '12px' : '14px' }}
          />
        </Space>
      </Modal>
    </>
  );
}

export default MagicLinkCustomerDashboard;
