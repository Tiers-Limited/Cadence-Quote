import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Spin, Alert } from 'antd';
import { apiService } from '../../services/apiService';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const SendQuoteEmailModal = ({
  visible,
  loading = false,
  customerEmail,
  customerName,
  quoteId,
  onSend,
  onCancel
}) => {
  const [form] = Form.useForm();
  const [sending, setSending] = useState(false);
  const [defaultSettings, setDefaultSettings] = useState(null);
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [emailBodyHtml, setEmailBodyHtml] = useState('');

  useEffect(() => {
    if (visible) {
      fetchDefaultEmailSettings();
    }
  }, [visible]);

  const fetchDefaultEmailSettings = async () => {
    setLoadingDefaults(true);
    try {
      const response = await apiService.get('/settings');
      if (response.success && response.data.tenant?.defaultEmailMessage) {
        const { subject, body } = response.data.tenant.defaultEmailMessage;
        setDefaultSettings({ subject, body });
        form.setFieldsValue({
          emailSubject: subject || 'Your Quote is Ready',
          emailBody: body || ''
        });
        setEmailBodyHtml(body || '');
      } else {
        // Set fallback defaults
        form.setFieldsValue({
          emailSubject: 'Your Quote is Ready',
          emailBody: ''
        });
        setEmailBodyHtml('');
      }
    } catch (error) {
      console.error('Error fetching email settings:', error);
      message.error('Failed to load email settings');
    } finally {
      setLoadingDefaults(false);
    }
  };

  const handleSend = async (values) => {
    setSending(true);
    try {
      await onSend({
        emailSubject: values.emailSubject,
        emailBody: values.emailBody || emailBodyHtml,
        quoteId
      });
      form.resetFields();
    } catch (error) {
      console.error('Error sending email:', error);
      message.error(error.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      title='Send Quote to Customer'
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={700}
    >
      {loadingDefaults ? (
        <div className='flex items-center justify-center py-8'>
          <Spin tip='Loading email settings...' />
        </div>
      ) : (
        <Form
          form={form}
          layout='vertical'
          onFinish={handleSend}
          className='space-y-12'
        >
          <Alert
            message='Customer Information'
            description={`Email will be sent to: ${customerEmail} (${customerName || 'Customer'})`}
            type='info'
            showIcon
            className='mb-4'
          />

          <Form.Item
            label='Email Subject'
            name='emailSubject'
            rules={[{ required: true, message: 'Please enter email subject' }]}
          >
            <Input placeholder='Your Quote is Ready' />
          </Form.Item>


          <Form.Item
            label='Email Body'
            name='emailBody'
            rules={[{ required: true, message: 'Please enter email body' }]}
            help={
              <div className='text-sm mt-5'>
                <p>Write your email message with headings, lists, and emphasis.</p>
                <p className='mt-1 text-gray-600'>Your company logo and contact signature will be automatically appended.</p>
              </div>
            }
          >
            <ReactQuill
              theme='snow'
              value={form.getFieldValue('emailBody') ?? emailBodyHtml}
              className='min-h-32 '
              onChange={(val) => {
                setEmailBodyHtml(val);
                form.setFieldsValue({ emailBody: val });
              }}
              placeholder='Write your email message...'
              modules={{
                toolbar: [
                  [{ header: [1, 2, 3, false] }],
                  ['bold', 'italic', 'underline', 'strike'],
                  [{ list: 'ordered' }, { list: 'bullet' }],
                  [{ align: [] }],
                  ['blockquote', 'code-block'],
                  ['clean']
                ]
              }}
            />
          </Form.Item>

          <Alert
            message='Signature'
            description='Your company logo (if set), name, title, company name, phone, and email will be automatically added to the end of this message.'
            type='success'
            showIcon
          />

          <div className='flex gap-3 justify-end pt-4'>
            <Button onClick={onCancel} disabled={sending}>
              Cancel
            </Button>
            <Button
              type='primary'
              htmlType='submit'
              loading={sending}
              disabled={loadingDefaults}
            >
              Send Quote Email
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default SendQuoteEmailModal;
