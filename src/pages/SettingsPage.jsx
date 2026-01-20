import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Segmented,
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  message,
  Spin,
  Popconfirm,
  Switch,
  Tabs,
  Select,
  Alert,
  Upload,
  Tooltip
} from 'antd'
import '../styles/cards.css'
import {
  FiSave,
  FiSettings,
  FiLock,
  FiUpload
} from 'react-icons/fi'
import { apiService } from '../services/apiService'
import { uploadImageToCloudinary } from '../utils/cloudinaryUpload'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

const { TextArea } = Input
const { TabPane } = Tabs
const { Option } = Select

function SettingsPage () {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('company')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState(null)

  // Form instances
  const [companyForm] = Form.useForm()
  const [portalForm] = Form.useForm()
  const [emailForm] = Form.useForm()
  const [logoUrl, setLogoUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [emailBodyHtml, setEmailBodyHtml] = useState('')



  useEffect(() => {
    fetchAllSettings()
  }, [])

  const fetchAllSettings = async () => {
    setLoading(true)
    try {
      // Fetch contractor settings and company info
      const settingsData = await apiService.get('/settings')
      if (settingsData.success) {
        const { data } = settingsData

        // Populate company form
        if (data.Tenant) {
          companyForm.setFieldsValue({
            companyName: data.Tenant.companyName,
            email: data.Tenant.email,
            phone: data.Tenant.phoneNumber,
            businessAddress: data.Tenant.businessAddress,
            tradeType: data.Tenant.tradeType
          })
          // Set logo if exists
          if (data.Tenant.companyLogoUrl) {
            setLogoUrl(data.Tenant.companyLogoUrl)
          }
        }

        // Populate email message form from tenant defaults
        if (data.Tenant?.defaultEmailMessage) {
          const { subject, body } = data.Tenant.defaultEmailMessage
          emailForm.setFieldsValue({
            emailSubject: subject || 'Your Quote is Ready',
            emailBody: body || ''
          })
          setEmailBodyHtml(body || '')
        }

        // Populate portal settings form
        portalForm.setFieldsValue({
          portalDurationDays: data.portalDurationDays || 14,
          portalAutoLock: data.portalAutoLock !== false, // Default to true
          portalLinkExpiryDays: data.portalLinkExpiryDays || 7,
          portalLinkMaxExpiryDays: data.portalLinkMaxExpiryDays || 30,
          portalAutoCleanup: data.portalAutoCleanup !== false, // Default to true
          portalAutoCleanupDays: data.portalAutoCleanupDays || 30,
          portalRequireOTPForMultiJob: data.portalRequireOTPForMultiJob !== false, // Default to true
        })
      }

      // Fetch 2FA status
      const twoFactorData = await apiService.get('/auth/2fa-status')
      if (twoFactorData.success) {
        setTwoFactorEnabled(twoFactorData.data.twoFactorEnabled || false)
      }
    } catch (error) {
      message.error('Failed to load settings: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCompanyInfo = async values => {
    setSaving(true)
    try {
      const payload = {
        companyName: values.companyName,
        email: values.email,
        phoneNumber: values.phone,
        businessAddress: values.businessAddress,
        tradeType: values.tradeType,
        companyLogoUrl: logoUrl
      }

      const response = await apiService.put('/settings/company', payload)
      if (response.success) {
        message.success('Company information updated successfully')
      }
    } catch (error) {
      message.error('Failed to update company info: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (file) => {
    setUploading(true)
    try {
      const url = await uploadImageToCloudinary(file)
      setLogoUrl(url)
      message.success('Logo uploaded successfully')
      return false // Prevent automatic upload
    } catch (error) {
      message.error('Failed to upload logo: ' + error.message)
    } finally {
      setUploading(false)
    }
    return false
  }

  const handleSaveEmailSettings = async values => {
    setSaving(true)
    try {
      const payload = {
        defaultEmailMessage: {
          subject: values.emailSubject,
          body: values.emailBody || emailBodyHtml
        }
      }

      const response = await apiService.put('/settings', payload)
      if (response.success) {
        message.success('Email settings updated successfully')
      }
    } catch (error) {
      message.error('Failed to update email settings: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEnable2FA = async () => {
    setSaving(true)
    try {
      const response = await apiService.post('/auth/enable-2fa', {})
      if (response.success) {
        setTwoFactorEnabled(true)
        setQrCodeUrl(response.data.qrCodeUrl)
        message.success(
          'Two-factor authentication enabled. Scan the QR code with your authenticator app.'
        )
      }
    } catch (error) {
      message.error('Failed to enable 2FA: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDisable2FA = async () => {
    setSaving(true)
    try {
      const response = await apiService.post('/auth/disable-2fa')
      if (response.success) {
        setTwoFactorEnabled(false)
        setQrCodeUrl(null)
        message.success('Two-factor authentication disabled.')
      }
    } catch (error) {
      message.error('Failed to disable 2FA: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <Spin size='large' tip='Loading settings...' />
      </div>
    )
  }

  return (
    <div className=''>
      <div className='max-w-6xl mx-auto'>
        {/* Header */}
        <div className='mb-6'>
          <div className='flex items-center gap-3 mb-2'>
            <FiSettings className='text-3xl text-blue-600' />
            <h1 className='text-3xl font-bold text-gray-900'>Settings</h1>
          </div>
          <p className='text-gray-600'>
            Manage your company information, pricing defaults, and system
            preferences
          </p>
        </div>

        {/* Tabs */}
        <Card>
          <div className='mb-4'>
            <Segmented
              value={activeTab}
              onChange={val => setActiveTab(val)}
              options={[
                { label: 'Company', value: 'company' },
                { label: 'Email', value: 'email' },
                { label: 'Customer Portal', value: 'portal' },
                { label: 'Account', value: 'account' }
              ]}
              className='ant-segmented--rounded'
              block
            />
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type='card'
            size='large'
            tabBarStyle={{ display: 'none' }}
          >
            {/* Company Info Tab */}
            <TabPane
              tab={
                <span className='flex items-center gap-2'>
                  <FiSettings />
                  Company Info
                </span>
              }
              key='company'
            >
              <div className='py-4'>
                <h3 className='text-lg font-semibold mb-4'>
                  Company Information
                </h3>
                <Form
                  form={companyForm}
                  layout='vertical'
                  onFinish={handleSaveCompanyInfo}
                  className='max-w-2xl space-y-8'
                >
                  <Form.Item
                    label='Company Name'
                    name='companyName'
                    rules={[
                      { required: true, message: 'Please enter company name' }
                    ]}
                  >
                    <Input size='large' placeholder='Your Company Name' />
                  </Form.Item>

                  <Form.Item
                    label='Email'
                    name='email'
                    
                    rules={[
                      { required: true, message: 'Please enter email' },
                      { type: 'email', message: 'Please enter a valid email' }
                    ]}
                  >
                    <Input size='large' placeholder='company@example.com' readOnly disabled />
                  </Form.Item>

                  <Form.Item label='Phone' name='phone'>
                    <Input size='large' placeholder='(555) 123-4567' />
                  </Form.Item>

                  <Form.Item label='Business Address' name='businessAddress'>
                    <TextArea
                      rows={3}
                      placeholder='123 Main Street, City, State, ZIP'
                    />
                  </Form.Item>

                  <Form.Item
                    label='Trade Type'
                    name='tradeType'
                    rules={[
                      { required: true, message: 'Please select a trade type' }
                    ]}
                  >
                    <Select size='large' placeholder='Select your trade type'>
                      <Option value='painter'>Painter</Option>
                      <Option value='drywall'>Drywall</Option>
                      <Option value='pressure_washing'>Pressure Washing</Option>
                      <Option value='plumbing'>Plumbing</Option>
                      <Option value='electrical'>Electrical</Option>
                      <Option value='hvac'>HVAC</Option>
                      <Option value='roofing'>Roofing</Option>
                      <Option value='landscaping'>Landscaping</Option>
                      <Option value='other'>Other</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item label='Company Logo' help='Upload your company logo to display in emails and proposals'>
                    <div className='flex items-center gap-4'>
                      {logoUrl && (
                        <div className='flex flex-col items-center gap-2'>
                          <img
                            src={logoUrl}
                            alt='Company Logo'
                            className='h-20 w-auto border border-gray-300 rounded'
                          />
                          <Button
                            type='text'
                            danger
                            size='small'
                            onClick={() => setLogoUrl(null)}
                          >
                            Remove Logo
                          </Button>
                        </div>
                      )}
                      <Upload
                        maxCount={1}
                        accept='.jpg,.png,.jpeg'
                        beforeUpload={handleLogoUpload}
                        showUploadList={false}
                        disabled={uploading}
                      >
                        <Button
                          icon={<FiUpload />}
                          loading={uploading}
                          disabled={uploading}
                        >
                          {logoUrl ? 'Change Logo' : 'Upload Logo'}
                        </Button>
                      </Upload>
                    </div>
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type='primary'
                      htmlType='submit'
                      icon={<FiSave />}
                      loading={saving}
                      size='large'
                    >
                      Save Company Info
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            </TabPane>

            {/* Email Settings Tab */}
            <TabPane
              tab={
                <span className='flex items-center gap-2'>
                  <FiSettings />
                  Email
                </span>
              }
              key='email'
            >
              <div className='py-4'>
                <h3 className='text-lg font-semibold mb-4'>Default Email Message</h3>
                <p className='text-gray-600 mb-6'>
                  Set the default email subject and message body that will be sent with quotes. 
                  Your company signature with logo will be automatically appended.
                </p>
                <Form
                  form={emailForm}
                  layout='vertical'
                  onFinish={handleSaveEmailSettings}
                  className='max-w-3xl space-y-12'
                >
                  <Form.Item
                    label='Email Subject'
                    name='emailSubject'
                    rules={[
                      { required: true, message: 'Please enter email subject' },
                      { max: 100, message: 'Subject must be 100 characters or less' }
                    ]}
                    help='The subject line of the email. Keep it professional and concise.'
                  >
                    <Input 
                      size='large' 
                      placeholder='Your Quote is Ready'
                      maxLength={100}
                    />
                  </Form.Item>

                  <Form.Item
                    label='Email Body'
                    name='emailBody'
                    rules={[
                      { required: true, message: 'Please enter email body' }
                    ]}
                    help='Write your message with headings, lists, and emphasis. Your signature will be added automatically. Do not include pricing, CTAs, or promotional content.'
                  >
                    <ReactQuill
                      theme='snow'
                      value={emailForm.getFieldValue('emailBody') ?? emailBodyHtml}
                      
                      onChange={(val) => {
                        setEmailBodyHtml(val)
                        emailForm.setFieldsValue({ emailBody: val })
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
                    message='Preview'
                    description='This message will be sent to customers with your company logo and contact information appended as your signature.'
                    type='info'
                    showIcon
                    className='mb-6'
                  />

                  <Form.Item>
                    <Button
                      type='primary'
                      htmlType='submit'
                      icon={<FiSave />}
                      loading={saving}
                      size='large'
                    >
                      Save Email Settings
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            </TabPane>

            {/* Customer Portal Tab - Magic Link Configuration */}
            <TabPane
              tab={
                <span className='flex items-center gap-2'>
                  <FiSettings />
                  Customer Portal
                </span>
              }
              key='portal'
            >
              <div className='py-4'>
                <h3 className='text-lg font-semibold mb-4'>Magic Link Portal Settings</h3>
                <p className='text-gray-600 mb-6'>
                  Configure magic link expiry, authentication, and automatic maintenance for customer portals
                </p>
                <Form
                  form={portalForm}
                  layout='vertical'
                  className='max-w-2xl space-y-6'
                  onFinish={async (values) => {
                    setSaving(true);
                    try {
                      const response = await apiService.put('/settings', values);
                      if (response.success) {
                        message.success('Portal settings saved successfully');
                        // Reload settings to get updated values
                        fetchAllSettings();
                      }
                    } catch (error) {
                      message.error(error.message || 'Failed to save portal settings');
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <Card>
                    <h4 className='font-semibold mb-4'>Link Expiry Configuration</h4>
                    <div className='space-y-4'>
                      <Form.Item
                        label='Default Link Expiry (Days)'
                        name='portalLinkExpiryDays'
                        rules={[
                          { required: true, message: 'Please enter default expiry' },
                          { type: 'number', min: 1, max: 365, message: 'Must be between 1 and 365 days' }
                        ]}
                        help='Default number of days before customer magic links expire'
                      >
                        <InputNumber 
                          size='large' 
                          min={1} 
                          max={365}
                          style={{ width: '100%' }}
                          addonAfter='days'
                        />
                      </Form.Item>

                      <Form.Item
                        label='Maximum Link Expiry (Days)'
                        name='portalLinkMaxExpiryDays'
                        rules={[
                          { required: true, message: 'Please enter maximum expiry' },
                          { type: 'number', min: 1, max: 365, message: 'Must be between 1 and 365 days' }
                        ]}
                        help='Maximum number of days when sending magic links to customers'
                      >
                        <InputNumber 
                          size='large' 
                          min={1} 
                          max={365}
                          style={{ width: '100%' }}
                          addonAfter='days'
                        />
                      </Form.Item>
                    </div>
                  </Card>

                  <Card>
                    <h4 className='font-semibold mb-4'>Automatic Cleanup</h4>
                    <div className='space-y-4'>
                      <Form.Item
                        label='Enable Auto-Cleanup'
                        name='portalAutoCleanup'
                        valuePropName='checked'
                        help='Automatically delete expired links and sessions (runs daily at 2 AM)'
                      >
                        <Switch 
                          checkedChildren='Enabled' 
                          unCheckedChildren='Disabled'
                        />
                      </Form.Item>

                      <Form.Item
                        label='Cleanup Retention Period (Days)'
                        name='portalAutoCleanupDays'
                        rules={[
                          { type: 'number', min: 1, max: 365, message: 'Must be between 1 and 365 days' }
                        ]}
                        help='Keep expired data for this many days before deletion'
                      >
                        <InputNumber 
                          size='large' 
                          min={1} 
                          max={365}
                          style={{ width: '100%' }}
                          addonAfter='days'
                        />
                      </Form.Item>
                    </div>
                  </Card>

                  <Card>
                    <h4 className='font-semibold mb-4'>Portal Authentication</h4>
                    <div className='space-y-4'>
                      <Form.Item
                        label='Require OTP for Multi-Project Access'
                        name='portalRequireOTPForMultiJob'
                        valuePropName='checked'
                        help='Require email verification (OTP) when accessing multiple projects'
                      >
                        <Switch 
                          checkedChildren='Required' 
                          unCheckedChildren='Optional'
                        />
                      </Form.Item>
                    </div>
                  </Card>

                  <Card className='bg-gray-50'>
                    <h4 className='font-semibold mb-4'>Legacy Portal Settings</h4>
                    <p className='text-gray-600 text-sm mb-4'>
                      For traditional portals opened after deposit payment
                    </p>
                    <div className='space-y-4'>
                      <Form.Item
                        label='Portal Duration (Days)'
                        name='portalDurationDays'
                        rules={[
                          { required: true, message: 'Please enter portal duration' },
                          { type: 'number', min: 1, max: 365, message: 'Duration must be between 1 and 365 days' }
                        ]}
                        help='How long customers can access the portal after deposit payment'
                      >
                        <InputNumber 
                          size='large' 
                          min={1} 
                          max={365}
                          style={{ width: '100%' }}
                          addonAfter='days'
                        />
                      </Form.Item>

                      <Form.Item
                        label='Auto-Lock Portal'
                        name='portalAutoLock'
                        valuePropName='checked'
                        help='Automatically lock portal when duration expires'
                      >
                        <Switch 
                          checkedChildren='Enabled' 
                          unCheckedChildren='Disabled'
                        />
                      </Form.Item>
                    </div>
                  </Card>

                  <Alert
                    message='Magic Link Portal Features'
                    description={
                      <ul className='list-disc pl-5 mt-2 space-y-1'>
                        <li>Customers access via secure magic link (no password required)</li>
                        <li>Links automatically expire after configured days</li>
                        <li>Multi-project access requires OTP verification</li>
                        <li>Expired data automatically cleaned up based on retention period</li>
                        <li>3-day warning emails sent before expiry</li>
                      </ul>
                    }
                    type='info'
                    showIcon
                    className='mb-6'
                  />

                  <Form.Item>
                    <Button
                      type='primary'
                      htmlType='submit'
                      icon={<FiSave />}
                      loading={saving}
                      size='large'
                    >
                      Save Portal Settings
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            </TabPane>

            {/* Account Tab */}
            <TabPane
              tab={
                <span className='flex items-center gap-2'>
                  <FiSettings />
                  Account
                </span>
              }
              key='account'
            >
              <div className='py-4'>
                <h3 className='text-lg font-semibold mb-4'>Account Settings</h3>
                <div className='max-w-2xl space-y-4'>
                  <Card>
                    <h4 className='font-semibold mb-2'>Password</h4>
                    <p className='text-gray-600 text-sm mb-3'>
                      Change your account password
                    </p>
                    <Button
                      onClick={() =>
                        message.info('Password change - Coming soon')
                      }
                    >
                      Change Password
                    </Button>
                  </Card>

                  <Card>
                    <h4 className='font-semibold mb-2'>
                      Two-Factor Authentication
                    </h4>
                    <p className='text-gray-600 text-sm mb-3'>
                      {twoFactorEnabled
                        ? 'Two-factor authentication is enabled. You will receive a code via email on login.'
                        : 'Enable two-factor authentication to add an extra layer of security to your account.'}
                    </p>
                    {twoFactorEnabled ? (
                      <>
                        {qrCodeUrl && (
                          <div className='mb-4'>
                            <p className='text-gray-600 text-sm mb-2'>
                              Scan this QR code with your authenticator app to
                              set up 2FA:
                            </p>
                            <img
                              src={qrCodeUrl}
                              alt='2FA QR Code'
                              className='w-48 h-48 mx-auto'
                            />
                          </div>
                        )}
                        <Popconfirm
                          title='Disable two-factor authentication?'
                          description='This will remove 2FA from your account, making it less secure.'
                          onConfirm={handleDisable2FA}
                          okText='Disable'
                          cancelText='Cancel'
                        >
                          <Button
                            type='primary'
                            danger
                            icon={<FiLock />}
                            loading={saving}
                          >
                            Disable 2FA
                          </Button>
                        </Popconfirm>
                      </>
                    ) : (
                      <Button
                        type='primary'
                        icon={<FiLock />}
                        onClick={handleEnable2FA}
                        loading={saving}
                      >
                        Enable 2FA
                      </Button>
                    )}
                  </Card>

                  <Card>
                    <h4 className='font-semibold mb-2'>Subscription</h4>
                    <p className='text-gray-600 text-sm mb-3'>
                      Manage your subscription and billing
                    </p>
                    <Button
                      onClick={() =>
                        message.info('Subscription management - Coming soon')
                      }
                    >
                      Manage Subscription
                    </Button>
                  </Card>

                  <Card className='border-red-200'>
                    <h4 className='font-semibold text-red-600 mb-2'>
                      Danger Zone
                    </h4>
                    <p className='text-gray-600 text-sm mb-3'>
                      Permanently delete your account and all data
                    </p>
                    <Button
                      danger
                      onClick={() =>
                        message.warning(
                          'Account deletion requires confirmation'
                        )
                      }
                    >
                      Delete Account
                    </Button>
                  </Card>
                </div>
              </div>
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}

export default SettingsPage
