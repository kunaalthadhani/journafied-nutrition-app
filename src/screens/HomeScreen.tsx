import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { TopNavigationBar } from '../components/TopNavigationBar';
import { DateSelector } from '../components/DateSelector';
import { StatCardsSection } from '../components/StatCardsSection';
import { BottomInputBar } from '../components/BottomInputBar';
import { SidebarMenu } from '../components/SidebarMenu';
import { SetGoalsScreen } from './SetGoalsScreen';
import { WeightTrackerScreen } from './WeightTrackerScreen';
import { NutritionAnalysisScreen } from './NutritionAnalysisScreen';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { MacroData } from '../types';
import { FoodLogSection, Meal } from '../components/FoodLogSection';
import { PhotoOptionsModal } from '../components/PhotoOptionsModal';
import { ImageUploadStatus } from '../components/ImageUploadStatus';
import { parseFoodInput, calculateTotalNutrition, ParsedFood } from '../utils/foodNutrition';
import { analyzeFoodWithChatGPT, analyzeFoodFromImage } from '../services/openaiService';
import { voiceService } from '../services/voiceService';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../constants/theme';

export const HomeScreen: React.FC = () => {
  const theme = useTheme();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [showSetGoals, setShowSetGoals] = useState(false);
  const [showWeightTracker, setShowWeightTracker] = useState(false);
  const [showNutritionAnalysis, setShowNutritionAnalysis] = useState(false);
  const [dailyCalories, setDailyCalories] = useState(1500);
  const [savedGoals, setSavedGoals] = useState({
    calories: 1500,
    proteinPercentage: 30,
    carbsPercentage: 45,
    fatPercentage: 25,
    proteinGrams: 113, // (1500 * 30%) / 4 cal/g = 112.5 ≈ 113
    carbsGrams: 169,   // (1500 * 45%) / 4 cal/g = 168.75 ≈ 169
    fatGrams: 42,      // (1500 * 25%) / 9 cal/g = 41.67 ≈ 42
  });
  // Store meals by date (YYYY-MM-DD format)
  const [mealsByDate, setMealsByDate] = useState<Record<string, Meal[]>>({});
  const [isAnalyzingFood, setIsAnalyzingFood] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [hasUserTyped, setHasUserTyped] = useState(false);
  const [uploadStatusVisible, setUploadStatusVisible] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'completed' | 'failed' | 'analyzing'>('uploading');
  const uploadIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isOpeningCameraRef = React.useRef(false);
  const pendingActionRef = React.useRef<'camera' | 'library' | null>(null);
  
  // Helper to get date key
  const getDateKey = (date: Date) => format(date, 'yyyy-MM-dd');
  
  // Get meals for current selected date
  const currentDateKey = getDateKey(selectedDate);
  const currentDayMeals = mealsByDate[currentDateKey] || [];
  
  // Calculate all foods from current day's meals for nutrition totals
  const allLoggedFoods = currentDayMeals.flatMap(meal => meal.foods);
  // Calculate current nutrition from current day's foods
  const currentNutrition = calculateTotalNutrition(allLoggedFoods);
  
  // Generate macro data from saved goals with current values
  const macrosData: MacroData = {
    carbs: { current: currentNutrition.totalCarbs, target: savedGoals.carbsGrams, unit: 'g' },
    protein: { current: currentNutrition.totalProtein, target: savedGoals.proteinGrams, unit: 'g' },
    fat: { current: currentNutrition.totalFat, target: savedGoals.fatGrams, unit: 'g' }
  };
  // Calories card data (Food, Exercise, Remaining)
  const macros2Data: MacroData = {
    carbs: { current: currentNutrition.totalCalories, target: 0, unit: 'cal' }, // Food calories
    protein: { current: 0, target: 0, unit: 'cal' }, // Exercise calories
    fat: { current: dailyCalories - currentNutrition.totalCalories, target: 0, unit: 'cal' } // Remaining calories
  };

  const handleMenuPress = () => {
    setMenuVisible(true);
  };

  const handleSetGoals = () => {
    setShowSetGoals(true);
  };

  const handleGoalsBack = () => {
    setShowSetGoals(false);
  };

  const handleWeightTracker = () => {
    setShowWeightTracker(true);
  };

  const handleNutritionAnalysis = () => {
    setShowNutritionAnalysis(true);
  };

  const handleNutritionAnalysisBack = () => {
    setShowNutritionAnalysis(false);
  };

  const handleWeightTrackerBack = () => {
    setShowWeightTracker(false);
  };

  const handleGoalsSave = (goals: any) => {
    console.log('Goals saved:', goals);
    setDailyCalories(goals.calories);
    setSavedGoals(goals);
    // TODO: Update app state with new goals
  };

  const handleCalendarPress = () => {
    setShowWeightTracker(true);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    console.log('Date selected:', format(date, 'yyyy-MM-dd'));
  };

  const handleInputSubmit = async (text: string) => {
    console.log('Input submitted:', text);
    
    if (!text.trim()) return;
    
    setIsAnalyzingFood(true);
    
    try {
      // Use ChatGPT for real-time food analysis
      const parsedFoods = await analyzeFoodWithChatGPT(text);
      
      if (parsedFoods.length > 0) {
        // Create a new meal entry with the prompt and foods
        const newMeal: Meal = {
          id: `meal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          prompt: text.trim(),
          foods: parsedFoods,
          timestamp: Date.now()
        };
        
        // Add meal to the current selected date
        setMealsByDate(prev => ({
          ...prev,
          [currentDateKey]: [...(prev[currentDateKey] || []), newMeal]
        }));
        console.log('ChatGPT parsed foods:', parsedFoods);
      } else {
        console.log('No foods recognized by ChatGPT:', text);
        // TODO: Show message to user that no foods were recognized
      }
    } catch (error) {
      console.error('Error processing food input:', error);
      // TODO: Show error message to user
    } finally {
      setIsAnalyzingFood(false);
    }
  };

  const handleRemoveFood = (foodId: string) => {
    setMealsByDate(prev => {
      const currentMeals = prev[currentDateKey] || [];
      const updatedMeals = currentMeals
        .map(meal => ({
          ...meal,
          foods: meal.foods.filter(food => food.id !== foodId)
        }))
        .filter(meal => meal.foods.length > 0); // Remove meals with no foods
      
      return {
        ...prev,
        [currentDateKey]: updatedMeals
      };
    });
  };

  const handlePlusPress = () => {
    setPhotoModalVisible(true);
  };

  const handleMicPress = async () => {
    if (isRecording) {
      // Stop recording and transcribe
      setIsRecording(false);
      setIsTranscribing(true);
      
      try {
        const transcription = await voiceService.stopRecording();
        if (transcription) {
          setTranscribedText(transcription);
          console.log('Transcription received:', transcription);
        } else {
          console.log('No transcription received');
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // Start recording
      try {
        const success = await voiceService.startRecording();
        if (success) {
          setIsRecording(true);
          console.log('Recording started successfully');
        } else {
          console.log('Failed to start recording');
          // TODO: Show error message to user
        }
      } catch (error) {
        console.error('Error starting recording:', error);
        // TODO: Show error message to user
      }
    }
  };

  const handleTakePhoto = () => {
    if (isOpeningCameraRef.current || pendingActionRef.current) {
      console.log('Already processing, ignoring duplicate call');
      return;
    }
    
    console.log('handleTakePhoto called - setting pending action');
    pendingActionRef.current = 'camera';
    setPhotoModalVisible(false);
  };

  const handleUploadPhoto = () => {
    if (isOpeningCameraRef.current || pendingActionRef.current) {
      console.log('Already processing, ignoring duplicate call');
      return;
    }
    
    console.log('handleUploadPhoto called - setting pending action');
    pendingActionRef.current = 'library';
    setPhotoModalVisible(false);
  };

  const resetUploadState = () => {
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }
    setUploadedImage(null);
    setUploadFileName('');
    setUploadProgress(0);
    setUploadStatus('uploading');
    setUploadStatusVisible(false);
  };

  const simulateUpload = async (imageUri: string) => {
    // Clear any existing interval
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
    }
    
    // Simulate upload progress
    let progress = 0;
    uploadIntervalRef.current = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        setUploadProgress(100);
        setUploadStatus('completed');
        if (uploadIntervalRef.current) {
          clearInterval(uploadIntervalRef.current);
          uploadIntervalRef.current = null;
        }
        
        // Wait a moment, then start analyzing
        setTimeout(() => {
          setUploadStatus('analyzing');
          analyzeUploadedImage(imageUri);
        }, 500);
      } else {
        setUploadProgress(Math.round(progress));
      }
    }, 300);
  };

  const analyzeUploadedImage = async (imageUri?: string) => {
    const uriToAnalyze = imageUri || uploadedImage;
    if (!uriToAnalyze) {
      console.log('No uploaded image to analyze, imageUri:', imageUri, 'uploadedImage:', uploadedImage);
      return;
    }

    try {
      setIsAnalyzingFood(true);
      console.log('Starting image analysis for URI:', uriToAnalyze);
      
      // Add timeout to prevent infinite hanging
      const analysisPromise = analyzeFoodFromImage(uriToAnalyze);
      const timeoutPromise = new Promise<ParsedFood[]>((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timeout after 30 seconds')), 30000)
      );
      
      // Analyze the image using OpenAI Vision API
      const parsedFoods = await Promise.race([analysisPromise, timeoutPromise]);
      
      console.log('Analysis complete, parsed foods:', parsedFoods);
      
      if (parsedFoods.length > 0) {
        // Get current date key at the time of analysis
        const dateKey = getDateKey(selectedDate);
        
        // Create a new meal entry with the image and parsed foods
        const newMeal: Meal = {
          id: `meal_image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          prompt: `Image`,
          foods: parsedFoods,
          timestamp: Date.now(),
          imageUri: uriToAnalyze
        };
        
        // Add meal to the current selected date
        setMealsByDate(prev => ({
          ...prev,
          [dateKey]: [...(prev[dateKey] || []), newMeal]
        }));
        
        console.log('Meal added to date:', dateKey);
        
        // Update status to completed and close modal immediately
        setUploadStatus('completed');
        setTimeout(() => {
          setUploadStatusVisible(false);
          resetUploadState();
        }, 1000);
      } else {
        console.log('No foods recognized in image');
        setUploadStatus('completed');
        setTimeout(() => {
          setUploadStatusVisible(false);
          resetUploadState();
        }, 1500);
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      setUploadStatus('failed');
      alert(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Keep modal open so user can retry
    } finally {
      setIsAnalyzingFood(false);
    }
  };

  const handleRetryUpload = async () => {
    if (uploadStatus === 'failed' && uploadedImage) {
      // Retry analysis
      await analyzeUploadedImage(uploadedImage);
    } else if (uploadedImage) {
      // Retry upload
      setUploadProgress(0);
      setUploadStatus('uploading');
      simulateUpload(uploadedImage);
    }
  };

  const handleClosePhotoModal = () => {
    console.log('Closing photo modal');
    setPhotoModalVisible(false);
    // Don't reset upload state here - only reset if user explicitly closes
    // resetUploadState();
  };

  // Handle modal dismissal
  const handleModalDismiss = () => {
    console.log('Modal dismissed, pending action:', pendingActionRef.current);
    if (pendingActionRef.current) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      
      // Wait a moment to ensure modal is fully unmounted
      setTimeout(() => {
        if (action === 'camera') {
          openCameraAfterModalClose();
        } else if (action === 'library') {
          openLibraryAfterModalClose();
        }
      }, 300);
    }
  };

  // Fallback: Open camera/library after modal closes (if onDismiss doesn't fire)
  React.useEffect(() => {
    if (!photoModalVisible && pendingActionRef.current) {
      // Give onDismiss a chance to fire first
      const timer = setTimeout(() => {
        if (pendingActionRef.current) {
          const action = pendingActionRef.current;
          pendingActionRef.current = null;
          
          console.log('Fallback: Opening after modal close');
          if (action === 'camera') {
            openCameraAfterModalClose();
          } else if (action === 'library') {
            openLibraryAfterModalClose();
          }
        }
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [photoModalVisible]);

  const openCameraAfterModalClose = async () => {
    if (isOpeningCameraRef.current) return;
    isOpeningCameraRef.current = true;
    
    try {
      console.log('Opening camera after modal close...');
      // Check if we already have permissions
      const existingPermission = await ImagePicker.getCameraPermissionsAsync();
      console.log('Existing camera permission:', existingPermission);
      
      let permissionResult;
      if (existingPermission.status === 'granted') {
        permissionResult = existingPermission;
      } else if (existingPermission.status === 'denied' && !existingPermission.canAskAgain) {
        // Permissions permanently denied - show alert
        alert('Camera access is denied. Please enable it in Settings to take photos.');
        isOpeningCameraRef.current = false;
        return;
      } else {
        console.log('Requesting camera permissions...');
        // Add timeout to prevent hanging
        const permissionPromise = ImagePicker.requestCameraPermissionsAsync();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Permission request timed out')), 10000)
        );
        
        try {
          permissionResult = await Promise.race([permissionPromise, timeoutPromise]) as typeof existingPermission;
          console.log('Permission result:', permissionResult);
        } catch (timeoutError) {
          console.error('Permission request timeout:', timeoutError);
          alert('Permission request timed out. Please try again.');
          isOpeningCameraRef.current = false;
          return;
        }
      }
      
      if (permissionResult.status !== 'granted') {
        alert('Sorry, we need camera permissions to take a photo!');
        isOpeningCameraRef.current = false;
        return;
      }

      console.log('Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      console.log('Camera result:', result);
      isOpeningCameraRef.current = false;

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
        
        if (uploadIntervalRef.current) {
          clearInterval(uploadIntervalRef.current);
          uploadIntervalRef.current = null;
        }
        
        setUploadedImage(asset.uri);
        setUploadFileName(fileName);
        setUploadProgress(0);
        setUploadStatus('uploading');
        setUploadStatusVisible(true);
        
        // Pass the URI directly to avoid state timing issues
        simulateUpload(asset.uri);
      } else {
        console.log('Camera was canceled');
        resetUploadState();
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      isOpeningCameraRef.current = false;
      alert(`Failed to take photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
      resetUploadState();
    }
  };

  const openLibraryAfterModalClose = async () => {
    if (isOpeningCameraRef.current) return;
    isOpeningCameraRef.current = true;
    
    try {
      console.log('Opening library after modal close...');
      // Check if we already have permissions
      const existingPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
      console.log('Existing library permission:', existingPermission);
      
      let permissionResult;
      if (existingPermission.status === 'granted') {
        permissionResult = existingPermission;
      } else if (existingPermission.status === 'denied' && !existingPermission.canAskAgain) {
        // Permissions permanently denied - show alert
        alert('Photo library access is denied. Please enable it in Settings to upload photos.');
        isOpeningCameraRef.current = false;
        return;
      } else {
        console.log('Requesting media library permissions...');
        // Add timeout to prevent hanging
        const permissionPromise = ImagePicker.requestMediaLibraryPermissionsAsync();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Permission request timed out')), 10000)
        );
        
        try {
          permissionResult = await Promise.race([permissionPromise, timeoutPromise]) as typeof existingPermission;
          console.log('Permission result:', permissionResult);
        } catch (timeoutError) {
          console.error('Permission request timeout:', timeoutError);
          alert('Permission request timed out. Please try again.');
          isOpeningCameraRef.current = false;
          return;
        }
      }
      
      if (permissionResult.status !== 'granted') {
        alert('Sorry, we need media library permissions to upload a photo!');
        isOpeningCameraRef.current = false;
        return;
      }

      console.log('Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      console.log('Image picker result:', result);
      isOpeningCameraRef.current = false;

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = asset.fileName || asset.uri.split('/').pop() || `image_${Date.now()}.jpg`;
        
        if (uploadIntervalRef.current) {
          clearInterval(uploadIntervalRef.current);
          uploadIntervalRef.current = null;
        }
        
        setUploadedImage(asset.uri);
        setUploadFileName(fileName);
        setUploadProgress(0);
        setUploadStatus('uploading');
        setUploadStatusVisible(true);
        
        // Pass the URI directly to avoid state timing issues
        simulateUpload(asset.uri);
      } else {
        console.log('Image picker was canceled');
        resetUploadState();
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      isOpeningCameraRef.current = false;
      alert(`Failed to upload photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
      resetUploadState();
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
      }
    };
  }, []);

  const formattedDate = format(selectedDate, 'MMMM d, yyyy');

  if (showSetGoals) {
    return (
      <SetGoalsScreen 
        onBack={handleGoalsBack}
        onSave={handleGoalsSave}
        initialGoals={savedGoals}
      />
    );
  }

  if (showWeightTracker) {
    return (
      <WeightTrackerScreen 
        onBack={handleWeightTrackerBack}
      />
    );
  }

  if (showNutritionAnalysis) {
    return (
      <NutritionAnalysisScreen 
        onBack={handleNutritionAnalysisBack}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Fixed Top Navigation */}
        <TopNavigationBar
          selectedDate={formattedDate}
          onMenuPress={handleMenuPress}
          onCalendarPress={handleCalendarPress}
          onWeightTrackerPress={handleWeightTracker}
          onNutritionAnalysisPress={handleNutritionAnalysis}
        />

        {/* Scrollable Content (vertical only). Only DateSelector has horizontal scroll. */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        >
          {/* Date Selector (horizontal scroll/pan within the bar only) */}
          <DateSelector
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />

          {/* Stat Cards */}
          <StatCardsSection
            macrosData={macrosData}
            macros2Data={macros2Data}
            dailyCalories={dailyCalories}
            onScrollEnable={setScrollEnabled}
          />

          {/* Food Log Section */}
          <FoodLogSection 
            meals={currentDayMeals}
            onRemoveFood={handleRemoveFood}
            dailyCalories={dailyCalories}
            savedGoals={savedGoals}
          />

          {/* Motivational Text - only show if no meals logged for current day */}
          {currentDayMeals.length === 0 && !hasUserTyped && (
            <View style={styles.motivationalTextContainer}>
              <Text style={styles.motivationalTitle}>
                Ready when you are!
              </Text>
              <Text style={styles.motivationalText}>
                Type what you've eaten and I'll handle the rest
              </Text>
            </View>
          )}

          {/* Bottom spacing to account for fixed input bar */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Fixed Bottom Input Bar */}
        <BottomInputBar
          onSubmit={handleInputSubmit}
          onPlusPress={handlePlusPress}
          onMicPress={handleMicPress}
          isLoading={isAnalyzingFood}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          transcribedText={transcribedText}
          onTranscribedTextChange={setTranscribedText}
          onUserTyping={() => setHasUserTyped(true)}
          placeholder={
            isAnalyzingFood ? "Analyzing your food..." : 
            isRecording ? "Recording..." : 
            isTranscribing ? "Transcribing..." : 
            "What did you eat or exercise?"
          }
        />

        <SidebarMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onSetGoals={handleSetGoals}
          onWeightTracker={handleWeightTracker}
          onNutritionAnalysis={handleNutritionAnalysis}
          onLogin={() => {
            // TODO: Implement login
            console.log('Login pressed');
          }}
          onSettings={() => {
            // TODO: Implement settings
            console.log('Settings pressed');
          }}
          onAbout={() => {
            // TODO: Implement about
            console.log('About pressed');
          }}
        />
        
        <PhotoOptionsModal
          visible={photoModalVisible}
          onClose={handleClosePhotoModal}
          onTakePhoto={handleTakePhoto}
          onUploadPhoto={handleUploadPhoto}
          onModalDismiss={handleModalDismiss}
        />

        <ImageUploadStatus
          visible={uploadStatusVisible}
          imageUri={uploadedImage}
          fileName={uploadFileName}
          progress={uploadProgress}
          status={uploadStatus}
          onClose={() => {
            setUploadStatusVisible(false);
            resetUploadState();
          }}
          onRetry={handleRetryUpload}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  motivationalTextContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    minHeight: 200,
  },
  motivationalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  motivationalText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.normal,
    color: Colors.secondaryText,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.md,
  },
  bottomSpacer: {
    height: 120, // Space for bottom input bar + safe area
  },
});