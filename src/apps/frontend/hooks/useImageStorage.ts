import { getImage, setImage } from '../stores/imageStorage';

export function useImageStorage() {
  return { getImage, setImage };
}
