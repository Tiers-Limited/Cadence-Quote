// components/LostJobReasonModal.jsx
import { useState } from 'react';
import { Modal, Radio, Input, Button, Space, message, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { jobsService } from '../services/jobsService';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

function LostJobReasonModal({ visible, onCancel, onSuccess, jobId, jobNumber }) {
  const [selectedReason, setSelectedReason] = useState(null);
  const [otherDetails, setOtherDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const lostReasons = [
    { value: 'budget_mismatch', label: "Budget didn't align with expectations" },
    { value: 'chose_competitor', label: 'Chose a different contractor' },
    { value: 'timing_changed', label: 'Timing or priorities changed' },
    { value: 'scope_misalignment', label: "Scope or details weren't fully aligned" },
    { value: 'confidence_issues', label: 'Needed more confidence before moving forward' },
    { value: 'project_paused', label: 'Decided to pause the project' },
    { value: 'other', label: 'Other' }
  ];

  const handleSubmit = async () => {
    if (!selectedReason) {
      message.warning('Please select a reason');
      return;
    }

    if (selectedReason === 'other' && !otherDetails.trim()) {
      message.warning('Please provide details for "Other"');
      return;
    }

    try {
      setSubmitting(true);
      
      const details = selectedReason === 'other' ? otherDetails : null;
      const response = await jobsService.recordLostJobReason(jobId, selectedReason, details);
      
      if (response.success) {
        message.success('Lost job reason recorded successfully');
        handleClose();
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      message.error('Failed to record reason: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setOtherDetails('');
    onCancel();
  };

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#faad14' }} />
          <span>Record Lost Job Reason</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!selectedReason}
        >
          Submit
        </Button>
      ]}
    >
      <div className="mb-4">
        <Paragraph>
          Job <Text strong>{jobNumber}</Text> was not approved. Understanding why helps improve future quotes and conversions.
        </Paragraph>
        <Text type="secondary" style={{ fontSize: 12 }}>
          This information is for internal use only and helps track business insights.
        </Text>
      </div>

      <div className="mb-4">
        <Text strong>Which factor most influenced the decision?</Text>
      </div>

      <Radio.Group
        onChange={(e) => setSelectedReason(e.target.value)}
        value={selectedReason}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {lostReasons.map((reason) => (
            <Radio key={reason.value} value={reason.value} style={{ width: '100%', padding: '8px 0' }}>
              {reason.label}
            </Radio>
          ))}
        </Space>
      </Radio.Group>

      {selectedReason === 'other' && (
        <div className="mt-4">
          <Text strong>Please provide details:</Text>
          <TextArea
            rows={4}
            value={otherDetails}
            onChange={(e) => setOtherDetails(e.target.value)}
            placeholder="Describe the reason..."
            className="mt-2"
          />
        </div>
      )}
    </Modal>
  );
}

export default LostJobReasonModal;
