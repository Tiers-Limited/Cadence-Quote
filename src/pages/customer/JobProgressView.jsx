// pages/customer/JobProgressView.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, List, Tag, Space, Spin, message, Button, Progress } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { magicLinkApiService } from '../../services/magicLinkApiService';
import BrandedPortalHeader from '../../components/CustomerPortal/BrandedPortalHeader';

const { Title, Text } = Typography;

function JobProgressView() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [proposal, setProposal] = useState(null);

  useEffect(() => {
    fetchJobProgress();
  }, [proposalId]);

  const fetchJobProgress = async () => {
    try {
      setLoading(true);
      
      // Fetch proposal first (includes areas)
      const proposalResponse = await magicLinkApiService.get(`/api/customer-portal/proposals/${proposalId}`);
      if (proposalResponse.success) {
        const payload = proposalResponse.data || {};
        setProposal(payload);
        // If backend included job data, use it
        if (payload.job) setJob(payload.job);
      }
      
    } catch (error) {
      message.error('Failed to load job progress: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      'not_started': 'Not Started',
      'prepped': 'Prepped',
      'in_progress': 'In Progress',
      'touch_ups': 'Touch-Ups',
      'completed': 'Completed'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'not_started': 'default',
      'prepped': 'blue',
      'in_progress': 'processing',
      'touch_ups': 'warning',
      'completed': 'success'
    };
    return colors[status] || 'default';
  };

  const getAreaStatus = (areaId) => {
    if (!job?.areaProgress) return 'not_started';
    // areaProgress keys may be strings or numbers - normalize
    const key = String(areaId);
    const entry = job.areaProgress[key] || job.areaProgress[areaId] || null;
    return entry?.status || 'not_started';
  };

  const calculateOverallProgress = () => {
    if (!proposal?.areas || !job?.areaProgress) return 0;
    
    const completedAreas = proposal.areas.filter(area => {
      const status = getAreaStatus(area.id);
      return status === 'completed';
    });
    
    return Math.round((completedAreas.length / proposal.areas.length) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="Loading job progress..." />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <Title level={3}>Job Not Found</Title>
          <Button onClick={() => navigate('/portal')}>Back to Portal</Button>
        </Card>
      </div>
    );
  }

  const areas = proposal.areas || [];
  const overallProgress = calculateOverallProgress();

  return (
   
      <div className="p-6  mx-auto">
     
      

      <div className="mb-6">
        <Title level={2}>Your Project Progress</Title>
        <Text type="secondary">Track the status of each area in your project</Text>
      </div>

      {/* Overall Progress */}
      <Card className="mb-4">
        <div className="mb-2">
          <Text strong style={{ fontSize: 16 }}>Overall Project Progress</Text>
        </div>
        <Progress
          percent={overallProgress}
          status={overallProgress === 100 ? 'success' : 'active'}
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
        />
        <div className="mt-2">
          <Text type="secondary">
            {areas.filter(a => getAreaStatus(a.id) === 'completed').length} of {areas.length} areas completed
          </Text>
        </div>
      </Card>

      {/* Job Info */}
      <Card className="mb-4">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div className="flex justify-between">
            <Text strong>Job Status:</Text>
            <Tag color="blue">{job?.status || 'In Progress'}</Tag>
          </div>
          {job?.scheduledStartDate && (
            <div className="flex justify-between">
              <Text strong>Start Date:</Text>
              <Text>{new Date(job.scheduledStartDate).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}</Text>
            </div>
          )}
          {job?.scheduledEndDate && (
            <div className="flex justify-between">
              <Text strong>Expected Completion:</Text>
              <Text>{new Date(job.scheduledEndDate).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}</Text>
            </div>
          )}
        </Space>
      </Card>

      {/* Area Progress */}
      <Card title="Progress by Area">
        <List
          dataSource={areas}
          renderItem={(area) => {
            const status = getAreaStatus(area.id);
            const isCompleted = status === 'completed';
            
            return (
              <List.Item
                style={{
                  backgroundColor: isCompleted ? '#f6ffed' : 'transparent',
                  border: isCompleted ? '1px solid #b7eb8f' : 'none',
                  borderRadius: 4,
                  marginBottom: 12,
                  padding: 16
                }}
              >
                <div style={{ width: '100%' }}>
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <Space>
                      {isCompleted && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />}
                      <div>
                        <Text strong style={{ fontSize: 16 }}>{area.name || area.surfaceType}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {area.quantity} {area.unit}
                        </Text>
                      </div>
                    </Space>
                    
                    <Tag color={getStatusColor(status)} style={{ fontSize: 14, padding: '4px 12px' }}>
                      {getStatusLabel(status)}
                    </Tag>
                  </div>
                  
                  {area.description && (
                    <div className="mt-2">
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {area.description}
                      </Text>
                    </div>
                  )}
                </div>
              </List.Item>
            );
          }}
        />
      </Card>

      {areas.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <Text type="secondary">No areas defined for this project</Text>
          </div>
        </Card>
      )}
    </div>
  );
}

export default JobProgressView;
