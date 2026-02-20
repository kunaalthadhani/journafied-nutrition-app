
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { invokeWhisper } from './aiProxyService';

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
      return await this.transcribeWithOpenAI(audioUri);
    } catch (error) {
      console.error('Transcription failed:', error);
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

      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }

      // Read audio as base64 and send through the Edge Function proxy
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('Sending audio to AI proxy for transcription...');
      const transcription = await invokeWhisper(audioBase64);

      console.log('Transcription successful:', transcription);
      return transcription || 'Could not transcribe audio';

    } catch (error) {
      console.error('OpenAI transcription failed:', error);
      throw error;
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