import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, List, Typography, Space, message, Spin, Alert, Tag, Modal } from 'antd';
import { DownloadOutlined, EyeOutlined, FileTextOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { magicLinkApiService } from '../../services/magicLinkApiService';

const { Title, Text } = Typography;

function CustomerDocuments() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    fetchProposal();
    fetchDocuments();
  }, [proposalId]);

  const fetchProposal = async () => {
    try {
      const response = await magicLinkApiService.get(`/api/customer-portal/proposals/${proposalId}`);
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
      const response = await magicLinkApiService.get(`/api/customer-portal/proposals/${proposalId}/documents`);
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

      // Prefer API download via session token
      const sessionToken = localStorage.getItem('portalSession');
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001';
      const apiBase = baseURL.replace('/api/v1', '');

      if (!sessionToken) {
        // No active session — try to extract magic link token from current URL or previewUrl
        const pageToken = new URL(window.location.href).searchParams.get('token') || (previewUrl ? new URL(previewUrl).searchParams.get('token') : null);
        if (pageToken) {
          // Open direct download link with token in a new tab to trigger browser download
          const direct = `${apiBase}/api/customer-portal/proposals/${proposalId}/documents/${docType}/download?token=${pageToken}`;
          window.open(direct, '_blank');
          message.info('Opening document in a new tab for download');
          return;
        }

        throw new Error('No active session. Please access your portal link to download documents.');
      }

      const axiosResp = await magicLinkApiService.get(
        `/api/customer-portal/proposals/${proposalId}/documents/${docType}/download`,
        null,
        { responseType: 'blob' }
      );

      // axiosResp contains headers and data (blob)
      const blobData = axiosResp.data || axiosResp;
      const blob = new Blob([blobData], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Get filename from response headers or use default
      const contentDisposition = (axiosResp.headers && axiosResp.headers['content-disposition']) || '';
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `${docType}_${proposalId}.pdf`;

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('Document downloaded successfully');
    } catch (error) {
      message.error('Failed to download document: ' + (error.response?.data?.message || error.message));
    } finally {
      setDownloading(null);
    }
  };

  const handleView = async (docType) => {
    try {
      setViewing(docType);
      setPreviewVisible(true);

      // Generate view URL
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001';
      const apiBase = baseURL.replace('/api/v1', '');
      const sessionToken = localStorage.getItem('portalSession') || new URL(window.location.href).searchParams.get('token');
      console.log("SessionToken", sessionToken);
      if (sessionToken == null) {
        message.error('No active session token found. Please access your portal link to preview documents.');
        setPreviewVisible(false);
        return;
      }

      const viewUrl = `${apiBase}/api/customer-portal/proposals/${proposalId}/documents/${docType}/view?token=${sessionToken}`;

      // For iframe viewing, we need to set the URL
      setPreviewUrl(viewUrl);
    } catch (error) {
      message.error('Failed to load document: ' + error.message);
      setPreviewVisible(false);
      setViewing(null);
    } finally {
      setViewing(null);
    }
  };

  const getDocumentIcon = (type) => {
    const icons = {
      invoice: '📄',
      work_order: '📋',
      product_order: '🎨',
      material_list: '📦',
      proposal: '📃'
    };
    return icons[type] || '📄';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="Loading documents..." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Card>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/portal/dashboard')}
              style={{ marginBottom: 16 }}
            >
              Back to Dashboard
            </Button>
            <Title level={2} style={{ margin: 0 }}>Project Documents</Title>
            <Text type="secondary">
              {proposal?.jobTitle || proposal?.quoteNumber || 'Project'} • View and download your project documents
            </Text>
          </Space>
        </Card>

        {/* Status Alert */}
        {!proposal?.selectionsComplete && proposal?.status !== 'deposit_paid' && (
          <Alert
            message="Some Documents Not Yet Available"
            description="Work order, product order form, and material list will be available once your product selections are complete and the deposit is paid."
            type="info"
            showIcon
          />
        )}

        {/* Documents List */}
        <Card>
          <List
            itemLayout="horizontal"
            dataSource={documents}
            renderItem={(doc) => (
              <List.Item
                key={doc.type}
                actions={[
                  // <Button
                  //   key={`view-${doc.type}`}
                  //   type="default"
                  //   icon={<EyeOutlined />}
                  //   onClick={() => handleView(doc.type)}
                  //   loading={viewing === doc.type}
                  //   disabled={!doc.available}
                  // >
                  //   View
                  // </Button>,
                  <Button
                    key={`download-${doc.type}`}
                    type="primary"
                    icon={<DownloadOutlined />}
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
                    <div style={{ fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48 }}>
                      {getDocumentIcon(doc.type)}
                    </div>
                  }
                  title={
                    <Space>
                      {doc.title}
                      {!doc.available && <Tag color="default">Not Available</Tag>}
                      {doc.available && <Tag color="success">Available</Tag>}
                    </Space>
                  }
                  description={doc.description || 'Project document'}
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

      {/* PDF Preview Modal */}
      <Modal
        title="Document Preview"
        open={previewVisible}
        onCancel={() => {
          setPreviewVisible(false);
          setPreviewUrl(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setPreviewVisible(false);
            setPreviewUrl(null);
          }}>
            Close
          </Button>,
          previewUrl && (
            <Button
              key="download"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                // Extract docType from URL
                const match = previewUrl.match(/\/documents\/([^\/]+)\/view/);
                if (match) {
                  handleDownload(match[1]);
                }
              }}
            >
              Download
            </Button>
          )
        ]}
        width="90%"
        style={{ top: 20 }}
        bodyStyle={{ height: 'calc(100vh - 200px)', padding: 0 }}
      >
        {previewUrl && (
          <iframe
            src={previewUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            title="Document Preview"
          />
        )}
      </Modal>
    </div>
  );
}

export default CustomerDocuments;
