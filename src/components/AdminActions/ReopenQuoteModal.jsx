// components/AdminActions/ReopenQuoteModal.jsx
// Modal for contractor admin to reopen rejected/declined quotes

import React, { useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { adminStatusService } from '../../services/adminStatusService';

const { TextArea } = Input;

function ReopenQuoteModal({ visible, onCancel, onSuccess, quote }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const response = await adminStatusService.reopenQuote(quote.id, {
        reason: values.reason || null
      });

      if (response.success) {
        message.success('Quote reopened successfully');
        form.resetFields();
        onSuccess?.();
        onCancel();
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to reopen quote');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <span>
          <ReloadOutlined style={{ marginRight: 8 }} />
          Reopen Quote
        </span>
      }
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnClose
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item label="Quote Number">
          <Input value={quote?.quoteNumber} disabled />
        </Form.Item>

        <Form.Item label="Current Status">
          <Input value={quote?.status?.toUpperCase()} disabled />
        </Form.Item>

        <Form.Item label="Customer Name">
          <Input value={quote?.customerName} disabled />
        </Form.Item>

        <Form.Item
          name="reason"
          label="Reason for Reopening (Optional)"
        >
          <TextArea
            rows={4}
            placeholder="Explain why this quote is being reopened..."
          />
        </Form.Item>

        <div style={{ 
          padding: '12px', 
          backgroundColor: '#FFF7E6', 
          borderRadius: '4px',
          marginTop: '8px'
        }}>
          <strong>Note:</strong> Reopening this quote will change its status back to "Sent" 
          and the customer will be able to view and respond to it again.
        </div>
      </Form>
    </Modal>
  );
}

export default ReopenQuoteModal;

