import { URL_PREVIEW_API } from './constants';
import { LinkPreviewResponse } from './types';

export const isSameDate = (dateOne: string, dateTwo: string) => {
  const date1 = new Date(dateOne);
  const date2 = new Date(dateTwo);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export const fetchUrlsToPreview = (
  urls: Array<string>
): Promise<LinkPreviewResponse[] | []> => {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(URL_PREVIEW_API, {
        method: 'POST',
        body: JSON.stringify({ urls }),
      });
      const json = (await response.json()) as LinkPreviewResponse[];
      resolve(json);
    } catch (e) {
      reject([]);
    }
  });
};
