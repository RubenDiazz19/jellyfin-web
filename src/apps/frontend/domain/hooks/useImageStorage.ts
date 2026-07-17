import { getImage, setImage } from '../../data/stores/imageStorage';

export function useImageStorage() {
  return { getImage, setImage };
}
