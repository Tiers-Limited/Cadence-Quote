import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Checkbox, Typography, Space, Divider, message, Spin, Alert } from 'antd';
import { FiArrowRight } from 'react-icons/fi';
import { apiService } from '../../services/apiService';

const { Title, Text, Paragraph } = Typography;

function FinishStandardsAcknowledgement() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [proposal, setProposal] = useState(null);

  useEffect(() => {
    fetchProposal();
  }, [proposalId]);

  const fetchProposal = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/customer/proposals/${proposalId}`);
      if (response.success) {
        setProposal(response.data);
        
        // If already acknowledged, redirect to color selections
        if (response.data.finishStandardsAcknowledged) {
          navigate(`/portal/colors/${proposalId}`);
        }
      }
    } catch (error) {
      message.error('Failed to load proposal: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!acknowledged) {
      message.warning('Please acknowledge that you understand the finish standards');
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiService.post(`/customer/proposals/${proposalId}/acknowledge-finish-standards`);
      
      if (response.success) {
        message.success('Finish standards acknowledged successfully');
        navigate(`/portal/colors/${proposalId}`);
      }
    } catch (error) {
      message.error('Failed to acknowledge: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div className="text-center">
            <Title level={2}>Understanding Our Finish Standards</Title>
            <Paragraph type="secondary">
              Before we begin, here is how we define finish quality and surface preparation.
            </Paragraph>
          </div>

          <Divider />

          {/* GOOD Tier */}
          <Card className="bg-gray-50">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Title level={4} className="text-blue-600">GOOD – Clean and Functional</Title>
              <Paragraph>
                Basic preparation focused on repainting the space cleanly. Spot patching only. 
                Minor imperfections may remain and may be visible under certain lighting. 
                Best for rentals, budget refreshes, and low expectation spaces.
              </Paragraph>
              <div className="pl-4">
                <ul className="list-disc">
                  <li>Spot patching of holes and cracks</li>
                  <li>Basic surface cleaning</li>
                  <li>Standard primer and paint application</li>
                  <li>Minor imperfections may be visible</li>
                </ul>
              </div>
            </Space>
          </Card>

          {/* BETTER Tier */}
          <Card className="bg-blue-50">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Title level={4} className="text-green-600">BETTER – Smooth and Consistent</Title>
              <Paragraph>
                Expanded surface preparation including feather sanding. Designed for a uniform 
                appearance in normal lighting conditions. Recommended for most owner occupied homes.
              </Paragraph>
              <div className="pl-4">
                <ul className="list-disc">
                  <li>Extended patching and feather sanding</li>
                  <li>Surface smoothing for uniform appearance</li>
                  <li>Premium primer and paint application</li>
                  <li>Consistent finish in normal lighting</li>
                </ul>
              </div>
            </Space>
          </Card>

          {/* BEST Tier */}
          <Card className="bg-green-50">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Title level={4} className="text-purple-600">BEST – High End Finish</Title>
              <Paragraph>
                Advanced surface correction including skim coating where required. Designed for 
                close inspection and areas with strong or directional lighting. Best for luxury 
                spaces and premium finishes.
              </Paragraph>
              <div className="pl-4">
                <ul className="list-disc">
                  <li>Comprehensive skim coating</li>
                  <li>Advanced surface correction</li>
                  <li>Premium materials and techniques</li>
                  <li>Flawless finish for close inspection</li>
                </ul>
              </div>
            </Space>
          </Card>

          <Divider />

          <Alert
            message="Important Information"
            description="Finish quality affects surface preparation, labor time, pricing, and final appearance. If you later request additional preparation, smoother walls, or higher finish expectations that exceed your selected tier, a change order will be required."
            type="info"
            showIcon
          />

          <Card className="bg-yellow-50 border-yellow-300">
            <Checkbox
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              style={{ fontSize: '16px' }}
            >
              <Text strong>
                I understand that finish quality affects surface preparation, labor time, 
                pricing, and final appearance.
              </Text>
            </Checkbox>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button
              onClick={() => navigate(`/portal/proposal/${proposalId}`)}
            >
              Back to Proposal
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<FiArrowRight />}
              onClick={handleSubmit}
              loading={submitting}
              disabled={!acknowledged}
            >
              Continue to Product Selection
            </Button>
          </div>
        </Space>
      </Card>
    </div>
  );
}

export default FinishStandardsAcknowledgement;
