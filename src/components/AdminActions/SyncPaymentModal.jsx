// components/AdminActions/SyncPaymentModal.jsx
// Modal for contractor admin to sync payment status

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, message, Descriptions, Tag } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { adminStatusService } from '../../services/adminStatusService';

function SyncPaymentModal({ visible, onCancel, onSuccess, quote }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(null);

  useEffect(() => {
    if (visible && quote) {
      // Load current payment status
      loadPaymentStatus();
    }
  }, [visible, quote]);

  const loadPaymentStatus = async () => {
    try {
      const response = await adminStatusService.syncPaymentStatus(quote.id);
      if (response.success && response.data) {
        setPaymentInfo(response.data);
      }
    } catch (error) {
      console.error('Error loading payment status:', error);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const response = await adminStatusService.syncPaymentStatus(quote.id, {
        paymentIntentId: values.paymentIntentId || null
      });

      if (response.success) {
        if (response.data?.quote) {
          message.success('Payment status synced successfully - Deposit marked as paid');
        } else {
          message.info('Payment status retrieved');
          setPaymentInfo(response.data);
        }
        onSuccess?.();
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to sync payment status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <span>
          <SyncOutlined style={{ marginRight: 8 }} />
          Sync Payment Status
        </span>
      }
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnClose
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item label="Quote Number">
          <Input value={quote?.quoteNumber} disabled />
        </Form.Item>

        {paymentInfo && (
          <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Current Status">
              <Tag color={paymentInfo.depositVerified ? 'green' : 'orange'}>
                {paymentInfo.depositVerified ? 'Verified' : 'Not Verified'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Deposit Verified At">
              {paymentInfo.depositVerifiedAt 
                ? new Date(paymentInfo.depositVerifiedAt).toLocaleString()
                : 'N/A'
              }
            </Descriptions.Item>
            <Descriptions.Item label="Transaction ID">
              {paymentInfo.depositTransactionId || 'N/A'}
            </Descriptions.Item>
          </Descriptions>
        )}

        <Form.Item
          name="paymentIntentId"
          label="Stripe Payment Intent ID (Optional)"
          help="Enter a Stripe payment intent ID to verify payment. Leave empty to just check current status."
        >
          <Input
            placeholder="pi_xxxxxxxxxxxxx"
            allowClear
          />
        </Form.Item>

        <div style={{ 
          padding: '12px', 
          backgroundColor: '#E6F7FF', 
          borderRadius: '4px',
          marginTop: '8px'
        }}>
          <strong>Note:</strong> If you enter a Payment Intent ID, the system will verify it with Stripe 
          and automatically mark the deposit as paid if the payment succeeded.
        </div>
      </Form>
    </Modal>
  );
}

export default SyncPaymentModal;

