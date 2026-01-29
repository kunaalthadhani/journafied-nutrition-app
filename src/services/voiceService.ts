
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { config } from '../config/env';

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

      // Create new recording with optimized settings for speech recognition
      // Using mono channel and 16kHz sample rate (optimal for speech)
      // Create new recording with optimized settings for speech recognition
      // Using mono channel and 16kHz sample rate (optimal for speech)
      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: 2, // Audio.RECORDING_FORMAT_MPEG_4
          audioEncoder: 3, // Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: 'mp4', // IOSOutputFormat.MPEG4
          audioQuality: 0x7F, // IOSAudioQuality.MAX
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 64000,
        },
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);

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
      console.log('Transcribing audio from URI:', audioUri);

      // Check if API key is configured
      if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here') {
        console.warn('OpenAI API key not configured, using fallback');
        return await this.mockTranscription();
      }

      // Use OpenAI Whisper API for transcription
      return await this.transcribeWithOpenAI(audioUri);

    } catch (error) {
      console.error('Transcription failed:', error);
      // Fallback to mock if real transcription fails
      try {
        return await this.mockTranscription();
      } catch (fallbackError) {
        return 'Sorry, I could not transcribe your audio. Please try typing instead.';
      }
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
      console.log('Starting OpenAI Whisper transcription...');

      // Read the audio file
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }

      // Create FormData for multipart/form-data upload
      const formData = new FormData();

      // For React Native, we need to append the file differently
      // The file needs to be in a format that React Native's FormData understands
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      } as any);

      formData.append('model', 'whisper-1');
      formData.append('language', 'en'); // Optional: specify language for better accuracy

      console.log('Sending request to OpenAI Whisper API...');
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
          // Don't set Content-Type header - let fetch set it with boundary for multipart/form-data
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText} `);
      }

      const result = await response.json();
      const transcription = result.text || 'Could not transcribe audio';

      console.log('Transcription successful:', transcription);
      return transcription;

    } catch (error) {
      console.error('OpenAI transcription failed:', error);
      throw error; // Re-throw to let caller handle fallback
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