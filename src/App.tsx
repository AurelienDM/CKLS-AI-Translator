import { useState, useEffect } from 'react';
import { AppProvider } from '@/contexts/AppContext';
import { Stepper } from '@/components/Stepper';
import { StepContainer } from '@/components/StepContainer';
import { Step1 } from '@/components/Step1';
import { Step2 } from '@/components/Step2';
import { Step3 } from '@/components/Step3';
import { SidepanelNotification } from '@/components/SidepanelNotification';
import { getCurrentPageContext, PageContext } from '@/utils/pageDetection';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';

interface NotificationData {
  type: 'success' | 'info' | 'error';
  icon: string;
  title: string;
  message?: string;
  actionLabel?: string;
  action?: string;
}

interface NotificationMessage {
  type: string;
  data?: NotificationData;
}

function AppContent() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [step1Complete, setStep1Complete] = useState(false);
  const [step2Complete, setStep2Complete] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  
  // Notification state
  const [notification, setNotification] = useState<{
    visible: boolean;
    type: 'success' | 'info' | 'error';
    icon: string;
    title: string;
    message?: string;
    actionLabel?: string;
    action?: string;
  }>({
    visible: false,
    type: 'info',
    icon: '📄',
    title: ''
  });

  const handleNext = () => {
    if (currentStep < 3) {
      // Mark current step as completed
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps([...completedSteps, currentStep]);
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
  };

  const handleStep1Complete = () => {
    setStep1Complete(true);
  };

  const handleStep1Incomplete = () => {
    setStep1Complete(false);
    // Remove step 1 from completed steps if present
    setCompletedSteps(prev => prev.filter(s => s !== 1));
  };

  const handleStep2Complete = () => {
    setStep2Complete(true);
  };

  // Detect current page context
  useEffect(() => {
    getCurrentPageContext().then(context => {
      setPageContext(context);
    });
  }, []);

  // Listen for sidebar notifications
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;

    const handleMessage = (message: NotificationMessage) => {
      if (message.type === 'SHOW_SIDEBAR_NOTIFICATION' && message.data) {
        setNotification({
          visible: true,
          ...message.data
        });

        // Auto-dismiss after 10 seconds
        const timer = setTimeout(() => {
          setNotification(prev => ({ ...prev, visible: false }));
        }, 10000);

        return () => clearTimeout(timer);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Handle notification actions
  const handleNotificationAction = () => {
    if (!notification.action) return;

    if (notification.action === 'LOAD_TEXT_CONTENT') {
      // Trigger text content load - send message to Step1
      chrome.runtime.sendMessage({ type: 'CHECK_AUTO_LOADED_TEXT' });
    } else if (notification.action === 'LOAD_FILE_CONTENT') {
      // Trigger file load
      chrome.runtime.sendMessage({ type: 'CHECK_AUTO_LOADED_FILE' });
    }

    // Dismiss notification after action
    setNotification(prev => ({ ...prev, visible: false }));
  };

  const handleDismissNotification = () => {
    setNotification(prev => ({ ...prev, visible: false }));
  };

  // Show loading state while detecting page
  if (!pageContext) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* ContextBanner removed - no longer showing file info in header */}
      
      <Stepper 
        currentStep={currentStep} 
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
      />
      
      {/* Sidepanel Notification */}
      <SidepanelNotification
        visible={notification.visible}
        type={notification.type}
        icon={notification.icon}
        title={notification.title}
        message={notification.message}
        actionLabel={notification.actionLabel}
        onAction={handleNotificationAction}
        onDismiss={handleDismissNotification}
      />
      
      <div className="flex-1 overflow-hidden">
        {currentStep === 1 && (
          <StepContainer
            step={1}
            onNext={handleNext}
            canGoNext={step1Complete}
          >
            <Step1 onComplete={handleStep1Complete} onIncomplete={handleStep1Incomplete} pageContext={pageContext} />
          </StepContainer>
        )}
        
        {currentStep === 2 && (
          <StepContainer
            step={2}
            onNext={handleNext}
            onBack={handleBack}
            canGoNext={step2Complete}
          >
            <Step2 onComplete={handleStep2Complete} />
          </StepContainer>
        )}
        
        {currentStep === 3 && (
          <StepContainer
            step={3}
            onBack={handleBack}
            canGoNext={false}
          >
            <Step3 onResetToStep1={() => setCurrentStep(1)} />
          </StepContainer>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
      <Toaster />
    </AppProvider>
  );
}

export default App;
