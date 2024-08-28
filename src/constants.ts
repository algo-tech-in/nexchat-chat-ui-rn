import { Platform } from 'react-native';
import { CompressorOptions } from 'react-native-compressor/lib/typescript/Image';
import { Dimensions } from 'react-native';

export const IMAGE_COMPRESS_CONFIG: CompressorOptions = {
  compressionMethod: 'manual',
  maxWidth: 1080,
  maxHeight: 1080,
  quality: 0.7,
  input: 'uri',
  output: 'jpg',
};

export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';

export const SCREEN_WIDTH = Dimensions.get('screen').width;
export const SCREEN_HEIGHT = Dimensions.get('screen').height;

export const URL_PREVIEW_API = 'https://nexchat-link-preview.deno.dev';

export const MIME_TYPES = {
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  JPG: 'image/jpg',
  WEBP: 'image/webp',
  MP4: 'video/mp4',
};
