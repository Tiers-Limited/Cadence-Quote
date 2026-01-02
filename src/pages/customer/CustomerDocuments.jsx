import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Button, List, Typography, Space, message, Spin, Alert, Tag } from 'antd';
import { FiDownload, FiFileText } from 'react-icons/fi';
import { apiService } from '../../services/apiService';

const { Title, Text, Paragraph } = Typography;

function CustomerDocuments() {
  const { proposalId } = useParams();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    fetchProposal();
    fetchDocuments();
  }, [proposalId]);

  const fetchProposal = async () => {
    try {
      const response = await apiService.get(`/customer/proposals/${proposalId}`);
      if (response.success) {
        setProposal(response.data);
      }
    } catch (error) {
      message.error('Failed to load proposal: ' + error.message);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/customer/proposals/${proposalId}/documents`);
      if (response.success) {
        setDocuments(response.data || []);
      }
    } catch (error) {
      message.error('Failed to load documents: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (docType) => {
    try {
      setDownloading(docType);
      const response = await apiService.get(
        `/customer/proposals/${proposalId}/documents/${docType}/download`,
        { responseType: 'blob' }
      );

      // Create blob link to download
      const url = globalThis.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${docType}_${proposalId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      message.success('Document downloaded successfully');
    } catch (error) {
      message.error('Failed to download document: ' + error.message);
    } finally {
      setDownloading(null);
    }
  };

  const documentList = [
    {
      type: 'work_order',
      title: 'Work Order',
      description: 'Detailed work order with room-by-room color, product, and sheen selections',
      icon: <FiFileText />,
      available: proposal?.selectionsComplete
    },
    {
      type: 'store_order',
      title: 'Store Order Sheet',
      description: 'Material list formatted for store ordering',
      icon: <FiFileText />,
      available: proposal?.selectionsComplete
    },
    {
      type: 'material_list',
      title: 'Material List',
      description: 'Complete list of all materials needed for your project',
      icon: <FiFileText />,
      available: proposal?.selectionsComplete
    },
    {
      type: 'proposal',
      title: 'Original Proposal',
      description: 'Your accepted proposal and contract',
      icon: <FiFileText />,
      available: true
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="Loading documents..." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Card>
          <Title level={2}>Project Documents</Title>
          <Text type="secondary">
            {proposal?.projectName || 'Painting Project'} • Download your project documents
          </Text>
        </Card>

        {/* Status Alert */}
        {!proposal?.selectionsComplete && (
          <Alert
            message="Documents Not Yet Available"
            description="Work orders and material lists will be available once you complete and submit your product selections."
            type="info"
            showIcon
          />
        )}

        {/* Documents List */}
        <Card>
          <List
            itemLayout="horizontal"
            dataSource={documentList}
            renderItem={(doc) => (
              <List.Item
                key={doc.type}
                actions={[
                  <Button
                    key={`download-${doc.type}`}
                    type="primary"
                    icon={<FiDownload />}
                    onClick={() => handleDownload(doc.type)}
                    loading={downloading === doc.type}
                    disabled={!doc.available}
                  >
                    Download
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div style={{ fontSize: 24, color: '#1890ff' }}>
                      {doc.icon}
                    </div>
                  }
                  title={
                    <Space>
                      {doc.title}
                      {!doc.available && <Tag color="default">Not Available</Tag>}
                      {doc.available && <Tag color="success">Available</Tag>}
                    </Space>
                  }
                  description={doc.description}
                />
              </List.Item>
            )}
          />
        </Card>

        {/* Info Card */}
        <Card>
          <Alert
            message="Need Changes?"
            description="If you need to make changes to your selections after submission, please contact your contractor to reopen the portal."
            type="info"
            showIcon
          />
        </Card>
      </Space>
    </div>
  );
}

export default CustomerDocuments;
