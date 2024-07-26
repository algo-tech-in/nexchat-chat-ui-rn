import { CompressorOptions } from "react-native-compressor/lib/typescript/Image";

export const IMAGE_COMPRESS_CONFIG: CompressorOptions = {
  compressionMethod: "manual",
  maxWidth: 1080,
  maxHeight: 1080,
  quality: 0.7,
  input: "uri",
  output: "jpg",
};
