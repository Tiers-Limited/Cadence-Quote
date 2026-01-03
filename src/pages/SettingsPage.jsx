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
  Alert
} from 'antd'
import '../styles/cards.css'
import {
  FiSave,
  FiSettings,
  FiLock
} from 'react-icons/fi'
import { apiService } from '../services/apiService'

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
        if (data.tenant) {
          companyForm.setFieldsValue({
            companyName: data.tenant.companyName,
            email: data.tenant.email,
            phone: data.tenant.phoneNumber,
            businessAddress: data.tenant.businessAddress,
            tradeType: data.tenant.tradeType
          })
        }

        // Populate portal settings form
        portalForm.setFieldsValue({
          portalDurationDays: data.portalDurationDays || 14,
          portalAutoLock: data.portalAutoLock !== false // Default to true
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
        tradeType: values.tradeType
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
                  className='max-w-2xl'
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
                    <Input size='large' placeholder='company@example.com' />
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

            {/* Customer Portal Tab */}
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
                <h3 className='text-lg font-semibold mb-4'>Customer Portal Settings</h3>
                <p className='text-gray-600 mb-6'>
                  Configure how long customer portals remain open after deposit payment
                </p>
                <Form
                  form={portalForm}
                  layout='vertical'
                  className='max-w-2xl'
                  onFinish={async (values) => {
                    setSaving(true);
                    try {
                      const response = await apiService.put('/settings', {
                        portalDurationDays: values.portalDurationDays,
                        portalAutoLock: values.portalAutoLock
                      });
                      if (response.success) {
                        message.success('Portal settings updated successfully');
                      }
                    } catch (error) {
                      message.error('Failed to update settings: ' + error.message);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <Form.Item
                    label='Portal Duration (Days)'
                    name='portalDurationDays'
                    rules={[
                      { required: true, message: 'Please enter portal duration' },
                      { type: 'number', min: 1, max: 365, message: 'Duration must be between 1 and 365 days' }
                    ]}
                    help='Number of days the customer portal remains open after deposit payment'
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
                    help='Automatically lock portal when duration expires. If disabled, portal stays open until manually closed.'
                  >
                    <Switch 
                      checkedChildren='Enabled' 
                      unCheckedChildren='Disabled'
                    />
                  </Form.Item>

                  <Alert
                    message='Portal Access Rules'
                    description={
                      <ul className='list-disc pl-5 mt-2 space-y-1'>
                        <li>Portal opens automatically after deposit payment is verified</li>
                        <li>Customer can make product selections during the portal duration</li>
                        <li>Portal locks automatically when customer submits all selections</li>
                        <li>Contractors can manually reopen portal if changes are needed</li>
                        <li>If auto-lock is disabled, contractors must manually close portals</li>
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
