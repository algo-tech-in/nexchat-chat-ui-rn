export type SendMessageProps = {
  text?: string;
  externalUserId?: string;
  urlPreview?: {url: string};
  attachments?: Array<{
    fileId: string;
    mimeType: string;
  }>;
};
