export interface FulfilledLinkPreview {
  url: string;
  title: string;
  siteName: string;
  description: string;
  mediaType: string;
  contentType: string;
  images: string[];
  videos: string[];
  favicons: string[];
  charset: string;
  originalUrl: string;
  source: 'store' | 'api';
}
interface RejectedLinkPreviewReason {
  message: string;
  type: 'system' | 'other';
}
export interface LinkPreviewResponse {
  status: 'fulfilled' | 'rejected';
  value?: FulfilledLinkPreview;
  reason?: RejectedLinkPreviewReason;
}
