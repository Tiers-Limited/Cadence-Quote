import { Button, Space, Modal, message, Tooltip } from 'antd';
import { UnlockOutlined, LockOutlined, EyeOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { apiService } from '../services/apiService';

function ContractorPortalControls({ quote, onUpdate }) {
  const [loading, setLoading] = useState(false);

  const handleOpenPortal = async () => {
    if (!quote.depositVerified) {
      message.warning('Deposit must be verified before opening the portal');
      return;
    }

    if (!quote.finishStandardsAcknowledged) {
      Modal.confirm({
        title: 'Open Portal?',
        content: 'Customer has not acknowledged finish standards yet. The portal will open but they must acknowledge standards before making selections. Continue?',
        onOk: async () => {
          await executeOpenPortal();
        }
      });
      return;
    }

    await executeOpenPortal();
  };

  const executeOpenPortal = async () => {
    try {
      setLoading(true);
      const response = await apiService.post(`/contractor-portal/proposals/${quote.id}/open-portal`);
      
      if (response.success) {
        message.success('Portal opened successfully! Customer can now make selections.');
        onUpdate && onUpdate();
      }
    } catch (error) {
      message.error('Failed to open portal: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClosePortal = () => {
    Modal.confirm({
      title: 'Close Customer Portal?',
      content: 'Customer will not be able to make or edit selections while the portal is closed. You can reopen it later if needed.',
      okText: 'Close Portal',
      okType: 'danger',
      onOk: async () => {
        try {
          setLoading(true);
          const response = await apiService.post(`/contractor-portal/proposals/${quote.id}/close-portal`);
          
          if (response.success) {
            message.success('Portal closed successfully');
            onUpdate && onUpdate();
          }
        } catch (error) {
          message.error('Failed to close portal: ' + (error.message || 'Unknown error'));
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleViewSelections = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/contractor-portal/proposals/${quote.id}/selections`);
      
      if (response.success) {
        // Show selections in a modal
        Modal.info({
          title: 'Customer Product Selections',
          width: 800,
          content: (
            <div style={{ maxHeight: 500, overflow: 'auto' }}>
              {response.data.areas && response.data.areas.length > 0 ? (
                response.data.areas.map((area, index) => (
                  <div key={index} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #f0f0f0' }}>
                    <h4 style={{ marginBottom: 8 }}>{area.name}</h4>
                    {area.selections ? (
                      <div style={{ paddingLeft: 16 }}>
                        <p style={{ margin: '4px 0' }}><strong>Brand:</strong> {area.selections.brand || 'Not selected'}</p>
                        <p style={{ margin: '4px 0' }}><strong>Product:</strong> {area.selections.product || 'Not selected'}</p>
                        <p style={{ margin: '4px 0' }}><strong>Color:</strong> {area.selections.color || area.selections.customColor || 'Not selected'}</p>
                        <p style={{ margin: '4px 0' }}><strong>Sheen:</strong> {area.selections.sheen || 'Not selected'}</p>
                        {area.selections.selectedAt && (
                          <p style={{ margin: '4px 0', fontSize: 12, color: '#666' }}>
                            Selected: {new Date(area.selections.selectedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p style={{ paddingLeft: 16, color: '#999' }}>No selections made yet</p>
                    )}
                  </div>
                ))
              ) : (
                <p style={{ color: '#999' }}>No areas defined or selections made yet</p>
              )}
            </div>
          )
        });
      }
    } catch (error) {
      message.error('Failed to load selections: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space>
      {quote.portalOpen ? (
        <Tooltip title="Close portal to prevent customer from making changes">
          <Button
            icon={<LockOutlined />}
            onClick={handleClosePortal}
            loading={loading}
            danger
          >
            Close Portal
          </Button>
        </Tooltip>
      ) : (
        <Tooltip title={!quote.depositVerified ? 'Verify deposit first' : 'Open portal for customer selections'}>
          <Button
            type="primary"
            icon={<UnlockOutlined />}
            onClick={handleOpenPortal}
            loading={loading}
            disabled={!quote.depositVerified}
          >
            Open Portal
          </Button>
        </Tooltip>
      )}

      <Tooltip title="View customer's product selections">
        <Button
          icon={<EyeOutlined />}
          onClick={handleViewSelections}
          loading={loading}
        >
          View Selections
        </Button>
      </Tooltip>
    </Space>
  );
}

export default ContractorPortalControls;
