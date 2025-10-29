import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Form, Input, Button, Select, message, Checkbox, InputNumber, Radio, Steps, Progress, Result, Spin, Upload } from 'antd'
import { FiSend, FiCheckCircle, FiUser, FiHome, FiArrowRight, FiArrowLeft, FiUpload } from 'react-icons/fi'
import { apiService } from '../services/apiService'
import { uploadMultipleImagesToCloudinary, isCloudinaryConfigured } from '../utils/cloudinaryUpload'

const { TextArea } = Input
const { Option } = Select
const { Step } = Steps

function PublicLeadFormPage() {
  const { publicUrl } = useParams()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [leadForm, setLeadForm] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState({})
  const [ballparkQuote, setBallparkQuote] = useState(null)
  const [quoteRange, setQuoteRange] = useState(null)
  const [quoteMessage, setQuoteMessage] = useState(null)
  const [fileList, setFileList] = useState([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [cloudinaryUrls, setCloudinaryUrls] = useState([])

  useEffect(() => {
    fetchLeadForm()
  }, [publicUrl])

  const fetchLeadForm = async () => {
    setLoading(true)
    try {
      const response = await apiService.get(`/lead-forms/public/${publicUrl}`)
      if (response.success) {
        setLeadForm(response.data)
      } else {
        message.error('Lead form not found')
      }
    } catch (error) {
      message.error('Failed to load form: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      await form.validateFields()
      const values = form.getFieldsValue()
      const allData = { ...formData, ...values }
      
      setSubmitting(true)

      // Upload images to Cloudinary if any
      let photoUrls = cloudinaryUrls; // Use already uploaded URLs
      
      // If there are files not yet uploaded to Cloudinary
      const filesToUpload = fileList
        .filter(file => file.originFileObj && !cloudinaryUrls.includes(file.url))
        .map(file => file.originFileObj);
      
      if (filesToUpload.length > 0 && isCloudinaryConfigured()) {
        try {
          setUploadingImages(true);
          message.loading('Uploading images...', 0);
          const uploadedUrls = await uploadMultipleImagesToCloudinary(filesToUpload);
          photoUrls = [...cloudinaryUrls, ...uploadedUrls];
          setCloudinaryUrls(photoUrls);
          message.destroy();
          message.success(`${uploadedUrls.length} image(s) uploaded successfully!`);
        } catch (uploadError) {
          message.destroy();
          message.error('Failed to upload images. Please try again.');
          console.error('Cloudinary upload error:', uploadError);
          setSubmitting(false);
          setUploadingImages(false);
          return;
        } finally {
          setUploadingImages(false);
        }
      }

      // Get UTM parameters from URL
      const urlParams = new URLSearchParams(window.location.search)
      const utmData = {
        utmSource: urlParams.get('utm_source'),
        utmMedium: urlParams.get('utm_medium'),
        utmCampaign: urlParams.get('utm_campaign')
      }

      const payload = {
        firstName: allData.firstName,
        lastName: allData.lastName,
        email: allData.email,
        phone: allData.phone,
        address: allData.address,
        zipCode: allData.zipCode,
        homeSize: allData.homeSize,
        roomCount: allData.roomCount,
        projectType: allData.projectType,
        projectDetails: allData.projectDetails,
        photoUrls: photoUrls.length > 0 ? JSON.stringify(photoUrls) : null,
        preferredContactMethod: allData.preferredContactMethod,
        bestTimeToContact: allData.bestTimeToContact,
        timeline: allData.timeline,
        paintPreference: allData.paintPreference,
        referralSource: allData.referralSource,
        agreedToTerms: allData.agreedToTerms,
        ...utmData,
        formData: allData
      }

      const response = await apiService.post(`/lead-forms/public/${publicUrl}/submit`, payload)
      
      if (response.success) {
        setSubmitted(true)
        setBallparkQuote(response.data?.ballparkQuote)
        setQuoteRange(response.data?.quoteRange)
        setQuoteMessage(response.data?.quoteMessage)
        form.resetFields()
        setFileList([])
        setCloudinaryUrls([])
        message.success('Thank you! We\'ll be in touch soon.')
      }
    } catch (error) {
      message.error('Failed to submit form: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = async () => {
    try {
      await form.validateFields()
      const values = form.getFieldsValue()
      setFormData({ ...formData, ...values })
      setCurrentStep(currentStep + 1)
    } catch (error) {
      console.log('Validation failed:', error)
    }
  }

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1)
  }

  const getProgress = () => {
    return ((currentStep + 1) / 3) * 100
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <Spin size="large" tip="Loading form..." />
      </div>
    )
  }

  if (!leadForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
        <Result
          status="404"
          title="Form Not Found"
          subTitle="This lead capture form is no longer available or has been deactivated."
        />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <Result
            status="success"
            title="Thank You for Your Request!"
            subTitle={
              leadForm.thankYouMessage ||
              "We've received your information and will contact you within 15 minutes."
            }
            extra={[
              <div key="details" className="text-left space-y-4 mt-6">
                {ballparkQuote && quoteRange && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-green-900 mb-2">
                      Your Ballpark Estimate
                    </h3>
                    <div className="text-3xl font-bold text-green-600">
                      ${quoteRange.low.toLocaleString()} - ${quoteRange.high.toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      {quoteMessage || 'Based on your zip code and project size'}
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3">
                    What Happens Next:
                  </h3>
                  <ol className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-semibold">1.</span>
                      <span>Our team will review your project details</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-semibold">2.</span>
                      <span>We'll contact you to schedule a free estimate</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-semibold">3.</span>
                      <span>Receive your detailed quote within 24 hours</span>
                    </li>
                  </ol>
                </div>

                <div className="text-center pt-4">
                  <Button
                    type="primary"
                    size="large"
                    onClick={() => window.location.reload()}
                  >
                    Submit Another Request
                  </Button>
                </div>
              </div>
            ]}
          />
        </Card>
      </div>
    )
  }

  const steps = [
    {
      title: 'Contact Info',
      icon: <FiUser />
    },
    {
      title: 'Project Details',
      icon: <FiHome />
    },
    {
      title: 'Preferences',
      icon: <FiCheckCircle />
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            {leadForm.formTitle}
          </h1>
          {leadForm.formDescription && (
            <p className="text-lg text-gray-600">
              {leadForm.formDescription}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress
            percent={getProgress()}
            showInfo={false}
            strokeColor="#1890ff"
            className="mb-2"
          />
          <div className="text-center text-sm text-gray-600">
            Step {currentStep + 1} of 3
          </div>
        </div>

        {/* Form */}
        <Card>
          {/* Steps Indicator */}
          <Steps current={currentStep} className="mb-8">
            {steps.map((step, index) => (
              <Step key={index} title={step.title} icon={step.icon} />
            ))}
          </Steps>

          <Form form={form} layout="vertical" initialValues={formData} size="large">
            {/* Step 1: Contact Information */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Form.Item
                    label="First Name"
                    name="firstName"
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <Input placeholder="John" />
                  </Form.Item>

                  <Form.Item
                    label="Last Name"
                    name="lastName"
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <Input placeholder="Doe" />
                  </Form.Item>
                </div>

                <Form.Item
                  label="Email Address"
                  name="email"
                  rules={[
                    { required: true, message: 'Required' },
                    { type: 'email', message: 'Please enter valid email' }
                  ]}
                >
                  <Input placeholder="john@example.com" />
                </Form.Item>

                <Form.Item
                  label="Phone Number"
                  name="phone"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <Input placeholder="(555) 123-4567" />
                </Form.Item>
              </div>
            )}

            {/* Step 2: Project Details */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold mb-4">Project Details</h2>
                
                <Form.Item label="Property Address" name="address">
                  <Input placeholder="123 Main Street, City, State" />
                </Form.Item>

                <Form.Item
                  label="Zip Code"
                  name="zipCode"
                  rules={[{ required: true, message: 'Required for pricing estimate' }]}
                >
                  <Input placeholder="90210" maxLength={10} />
                </Form.Item>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Form.Item label="Home Size (sq ft)" name="homeSize">
                    <InputNumber
                      placeholder="2,500"
                      style={{ width: '100%' }}
                      min={0}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/\$\s?|(,*)/g, '')}
                    />
                  </Form.Item>

                  <Form.Item label="Number of Rooms" name="roomCount">
                    <InputNumber placeholder="5" style={{ width: '100%' }} min={1} />
                  </Form.Item>
                </div>

                <Form.Item
                  label="Project Type"
                  name="projectType"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <Select placeholder="Select project type">
                    <Option value="interior">Interior Painting</Option>
                    <Option value="exterior">Exterior Painting</Option>
                    <Option value="trim">Trim/Baseboards</Option>
                    <Option value="cabinets">Cabinet Painting</Option>
                    <Option value="whole_house">Whole House</Option>
                    <Option value="other">Other</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="Tell us what you need"
                  name="projectDetails"
                  rules={[{ required: true, message: 'Please describe your project' }]}
                >
                  <TextArea rows={4} placeholder="Please describe your painting project in detail..." />
                </Form.Item>

                <Form.Item
                  label="Project Photos (Optional)"
                  name="photos"
                  extra={
                    isCloudinaryConfigured() 
                      ? "Upload photos to help us understand your project better. Max 5 photos, max 5MB each."
                      : "⚠️ Image upload is not configured. Contact administrator to set up Cloudinary."
                  }
                >
                  <Upload
                    listType="picture-card"
                    fileList={fileList}
                    onChange={({ fileList: newFileList }) => setFileList(newFileList)}
                    beforeUpload={(file) => {
                      const isImage = file.type.startsWith('image/');
                      if (!isImage) {
                        message.error('You can only upload image files!');
                        return Upload.LIST_IGNORE;
                      }
                      const isLt5M = file.size / 1024 / 1024 < 5;
                      if (!isLt5M) {
                        message.error('Image must be smaller than 5MB!');
                        return Upload.LIST_IGNORE;
                      }
                      
                      if (!isCloudinaryConfigured()) {
                        message.warning('Image upload is not configured');
                        return Upload.LIST_IGNORE;
                      }
                      
                      return false; // Prevent auto upload - we'll upload on form submit
                    }}
                    maxCount={5}
                    onPreview={(file) => {
                      const url = file.url || file.thumbUrl || (file.originFileObj && URL.createObjectURL(file.originFileObj));
                      if (url) {
                        window.open(url, '_blank');
                      }
                    }}
                    onRemove={(file) => {
                      // Remove from Cloudinary URLs if it was uploaded
                      if (file.url && cloudinaryUrls.includes(file.url)) {
                        setCloudinaryUrls(cloudinaryUrls.filter(url => url !== file.url));
                      }
                    }}
                    disabled={!isCloudinaryConfigured()}
                  >
                    {fileList.length >= 5 ? null : (
                      <div>
                        <FiUpload style={{ fontSize: '24px', marginBottom: '8px' }} />
                        <div style={{ marginTop: 8 }}>Upload Photo</div>
                      </div>
                    )}
                  </Upload>
                </Form.Item>
              </div>
            )}

            {/* Step 3: Preferences */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold mb-4">Preferences</h2>

                <Form.Item label="Preferred Contact Method" name="preferredContactMethod">
                  <Radio.Group>
                    <Radio value="phone">Phone Call</Radio>
                    <Radio value="email">Email</Radio>
                    <Radio value="text">Text Message</Radio>
                  </Radio.Group>
                </Form.Item>

                <Form.Item label="Best Time to Reach You" name="bestTimeToContact">
                  <Input placeholder="e.g., Weekday mornings, Anytime" />
                </Form.Item>

                <Form.Item label="When do you hope to start?" name="timeline">
                  <Select placeholder="Select timeline">
                    <Option value="asap">ASAP</Option>
                    <Option value="1month">Within 1 month</Option>
                    <Option value="1-3months">1-3 months</Option>
                    <Option value="3-6months">3-6 months</Option>
                    <Option value="exploring">Just exploring options</Option>
                  </Select>
                </Form.Item>

                <Form.Item label="What needs painting?" name="paintPreference">
                  <Select placeholder="Select preference">
                    <Option value="walls">Just walls</Option>
                    <Option value="whole_house">Whole house</Option>
                    <Option value="cabinets">Cabinets</Option>
                    <Option value="accent">Accent wall</Option>
                    <Option value="not_sure">Not sure yet</Option>
                  </Select>
                </Form.Item>

                <Form.Item label="How did you hear about us?" name="referralSource">
                  <Select placeholder="Select source">
                    <Option value="google">Google Search</Option>
                    <Option value="social">Social Media</Option>
                    <Option value="friend">Friend/Family</Option>
                    <Option value="saw_work">Saw your work</Option>
                    <Option value="ad">Advertisement</Option>
                    <Option value="other">Other</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="agreedToTerms"
                  valuePropName="checked"
                  rules={[
                    {
                      validator: (_, value) =>
                        value
                          ? Promise.resolve()
                          : Promise.reject(new Error('You must agree to continue'))
                    }
                  ]}
                >
                  <Checkbox>
                    I agree to the privacy policy and terms of service
                  </Checkbox>
                </Form.Item>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              {currentStep > 0 && (
                <Button size="large" icon={<FiArrowLeft />} onClick={handlePrevious}>
                  Previous
                </Button>
              )}

              <div className="flex-1" />

              {currentStep < 2 ? (
                <Button
                  type="primary"
                  size="large"
                  icon={<FiArrowRight />}
                  iconPosition="end"
                  onClick={handleNext}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  icon={<FiCheckCircle />}
                  iconPosition="end"
                  onClick={handleSubmit}
                  loading={submitting || uploadingImages}
                  disabled={submitting || uploadingImages}
                >
                  {uploadingImages ? 'Uploading Images...' : submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              )}
            </div>
          </Form>
        </Card>

        {/* Trust Indicators */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>🔒 Your information is secure and will never be shared</p>
          <p className="mt-1">⚡ We typically respond within 15 minutes</p>
        </div>

        {/* Footer */}
        <div className="text-center mt-4 text-sm text-gray-400">
          <p>Powered by Cadence Quote</p>
        </div>
      </div>
    </div>
  )
}

export default PublicLeadFormPage
