import { useState, useEffect, useRef } from 'react';
import { Card, Steps, message, Progress } from 'antd';
import {
  UserOutlined,
  HomeOutlined,
  UnorderedListOutlined,
  BgColorsOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import CustomerInfoStep from '../components/QuoteBuilder/CustomerInfoStep';
import JobTypeStep from '../components/QuoteBuilder/JobTypeStep';
import AreasStep from '../components/QuoteBuilder/AreasStep';
import ProductsStep from '../components/QuoteBuilder/ProductsStep';
import SummaryStep from '../components/QuoteBuilder/SummaryStep';
import { quoteBuilderApi } from '../services/quoteBuilderApi';
import { apiService } from '../services/apiService';

const steps = [
  { id: 0, title: 'Customer Info', icon: UserOutlined },
  { id: 1, title: 'Job Type', icon: HomeOutlined },
  { id: 2, title: 'Areas', icon: UnorderedListOutlined },
  { id: 3, title: 'Products', icon: BgColorsOutlined },
  { id: 4, title: 'Summary', icon: FileTextOutlined }
];

function QuoteBuilderPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    // Customer Info (Step 1)
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    pricingSchemeId: null,
    
    // Job Type (Step 2)
    jobType: 'interior',
    
    // Areas (Step 3)
    areas: [],
    
    // Products (Step 4)
    productStrategy: 'gbb',
    allowCustomerProductChoice: false,
    productSets: [],
    
    // Summary (Step 5)
    notes: '',
    
    // Internal
    quoteId: null,
    clientId: null,
    status: 'draft'
  });

  const [pricingSchemes, setPricingSchemes] = useState([]);
  const [detectedClient, setDetectedClient] = useState(null);
  const [loadingSchemes, setLoadingSchemes] = useState(true);

  const autoSaveInterval = useRef(null);
  const lastSaveTime = useRef(Date.now());

  // Auto-save every 30 seconds
  useEffect(() => {
    autoSaveInterval.current = setInterval(() => {
      handleAutoSave();
    }, 30000); // 30 seconds

    return () => {
      if (autoSaveInterval.current) {
        clearInterval(autoSaveInterval.current);
      }
    };
  }, [formData]);

  // Fetch pricing schemes on mount
  useEffect(() => {
    fetchPricingSchemes();
  }, []);

  // Check for existing draft on mount
  useEffect(() => {
    checkForExistingDraft();
  }, []);

  const fetchPricingSchemes = async () => {
    try {
      setLoadingSchemes(true);
      const response = await apiService.getPricingSchemes();
      if (response.success) {
        setPricingSchemes(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching pricing schemes:', error);
      message.error('Failed to load pricing schemes');
    } finally {
      setLoadingSchemes(false);
    }
  };

  const checkForExistingDraft = async () => {
    try {
      const response = await quoteBuilderApi.getDrafts();
      const drafts = response.data || [];
      
      if (drafts.length > 0) {
        // Show modal asking if user wants to continue the draft
        const latestDraft = drafts[0];
        message.info({
          content: `Found draft quote from ${new Date(latestDraft.updatedAt).toLocaleDateString()}. Loading...`,
          duration: 3
        });
        
        // Load the draft
        loadDraft(latestDraft.id);
      }
    } catch (error) {
      console.error('Error checking for drafts:', error);
    }
  };

  const loadDraft = async (quoteId) => {
    try {
      const response = await quoteBuilderApi.getQuoteById(quoteId);
      const draft = response.data;
      
      setFormData({
        ...formData,
        ...draft,
        quoteId: draft.id
      });
      
      message.success('Draft loaded successfully');
    } catch (error) {
      console.error('Error loading draft:', error);
      message.error('Failed to load draft');
    }
  };

  const handleAutoSave = async () => {
    // Only auto-save if there's meaningful data
    const hasData = formData.customerName || formData.customerEmail || formData.areas.length > 0;
    
    if (!hasData) return;

    try {
      const response = await quoteBuilderApi.saveDraft(formData);
      
      if (!formData.quoteId && response.data?.id) {
        setFormData(prev => ({ ...prev, quoteId: response.data.id }));
      }
      
      lastSaveTime.current = Date.now();
      console.log('Auto-saved successfully');
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  const handleStepDataUpdate = (stepData) => {
    setFormData(prev => ({
      ...prev,
      ...stepData
    }));
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleEdit = (stepIndex) => {
    setCurrentStep(stepIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDetectClient = async (email, phone) => {
    try {
      const response = await quoteBuilderApi.detectClient(email, phone);
      if (response.success && response.data) {
        setDetectedClient(response.data);
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error detecting client:', error);
      return null;
    }
  };

  const handleClientDetectionResponse = (useExisting) => {
    if (useExisting && detectedClient?.client) {
      // Update form data with existing client info
      setFormData(prev => ({
        ...prev,
        clientId: detectedClient.client.id,
        customerName: detectedClient.client.name,
        customerEmail: detectedClient.client.email,
        customerPhone: detectedClient.client.phone,
        street: detectedClient.client.street,
        city: detectedClient.client.city,
        state: detectedClient.client.state,
        zipCode: detectedClient.client.zip
      }));
      message.success('Loaded existing client profile');
    } else {
      // Clear clientId to create new client
      setFormData(prev => ({ ...prev, clientId: null }));
    }
    // Clear detection state
    setDetectedClient(null);
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <CustomerInfoStep
            formData={formData}
            onUpdate={handleStepDataUpdate}
            onNext={handleNext}
            pricingSchemes={pricingSchemes}
            onDetectClient={handleDetectClient}
            detectedClient={detectedClient}
            onClientDetectionResponse={handleClientDetectionResponse}
          />
        );
      
      case 1:
        return (
          <JobTypeStep
            formData={formData}
            onUpdate={handleStepDataUpdate}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        );
      
      case 2:
        return (
          <AreasStep
            formData={formData}
            onUpdate={handleStepDataUpdate}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        );
      
      case 3:
        return (
          <ProductsStep
            formData={formData}
            onUpdate={handleStepDataUpdate}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        );
      
      case 4:
        return (
          <SummaryStep
            formData={formData}
            onUpdate={handleStepDataUpdate}
            onPrevious={handlePrevious}
            onEdit={handleEdit}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl md:text-3xl font-bold">Create New Quote</h2>
            <span className="text-sm text-gray-500">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          
          <Progress percent={progress} showInfo={false} className="mb-6" />
          
          {/* Step Indicators */}
          <Steps current={currentStep} className="hidden md:flex">
            {steps.map((step) => (
              <Steps.Step
                key={step.id}
                title={step.title}
                icon={<step.icon />}
              />
            ))}
          </Steps>
        </div>

        {/* Step Content */}
        <Card>
          <div className="mb-6">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              {(() => {
                const StepIcon = steps[currentStep].icon;
                return <StepIcon className="text-blue-500" />;
              })()}
              {steps[currentStep].title}
            </h3>
          </div>

          {renderStepContent()}
        </Card>

        {/* Auto-save indicator */}
        <div className="text-center text-xs text-gray-500 mt-4">
          Auto-saving every 30 seconds
          {formData.quoteId && ` • Draft ID: ${formData.quoteId}`}
        </div>
      </div>
    </div>
  );
}

export default QuoteBuilderPage;
