import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export interface VoiceRecordingResult {
  transcription: string;
  audioUri?: string;
}

class VoiceService {
  private recording: Audio.Recording | null = null;
  private isRecording: boolean = false;

  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        return true; // Web permissions are handled differently
      }
      
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }

  async startRecording(): Promise<boolean> {
    try {
      if (this.isRecording) {
        console.warn('Already recording');
        return false;
      }

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Audio permission not granted');
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create new recording
      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_FORMAT_MPEG_4,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      this.recording = recording;
      this.isRecording = true;
      
      console.log('Recording started');
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }

  async stopRecording(): Promise<string | null> {
    try {
      if (!this.recording || !this.isRecording) {
        console.warn('No recording in progress');
        return null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      // Reset recording state
      this.recording = null;
      this.isRecording = false;

      console.log('Recording stopped, URI:', uri);
      
      // Transcribe the audio
      if (uri) {
        const transcription = await this.transcribeAudio(uri);
        return transcription;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.recording = null;
      this.isRecording = false;
      return null;
    }
  }

  private async transcribeAudio(audioUri: string): Promise<string> {
    try {
      // For now, we'll use a mock transcription service
      // In a real app, you would integrate with services like:
      // - OpenAI Whisper API
      // - Google Speech-to-Text API
      // - Azure Speech Services
      // - AWS Transcribe
      
      console.log('Transcribing audio from URI:', audioUri);
      
      // Mock transcription - replace with actual API call
      return await this.mockTranscription();
      
    } catch (error) {
      console.error('Transcription failed:', error);
      return 'Sorry, I could not transcribe your audio. Please try typing instead.';
    }
  }

  private async mockTranscription(): Promise<string> {
    // Mock delay to simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Return mock transcription
    const mockResponses = [
      "I had a chicken salad for lunch with some vegetables",
      "I ate two eggs and toast for breakfast",
      "Had a protein shake after my workout",
      "I had pizza and soda for dinner",
      "Ate an apple and some nuts as a snack"
    ];
    
    return mockResponses[Math.floor(Math.random() * mockResponses.length)];
  }

  async transcribeWithOpenAI(audioUri: string): Promise<string> {
    try {
      // This would be the real implementation using OpenAI Whisper
      // You need to implement file upload and API call
      
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      } as any);
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const result = await response.json();
      return result.text || 'Could not transcribe audio';
      
    } catch (error) {
      console.error('OpenAI transcription failed:', error);
      return 'Sorry, transcription failed. Please try typing instead.';
    }
  }

  getRecordingStatus(): boolean {
    return this.isRecording;
  }

  async cancelRecording(): Promise<void> {
    if (this.recording && this.isRecording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (error) {
        console.error('Error canceling recording:', error);
      } finally {
        this.recording = null;
        this.isRecording = false;
      }
    }
  }
}

export const voiceService = new VoiceService();