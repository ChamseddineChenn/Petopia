import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export interface UploadResult {
  url: string;
  publicId: string;
}

/**
 * Pick an image from the device library
 */
export const pickImage = async (): Promise<string | null> => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Gallery permission is required to pick an image.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
};

/**
 * Take a photo with the camera
 */
export const takePhoto = async (): Promise<string | null> => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Camera permission is required to take a photo.');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
};

/**
 * Upload an image URI to our backend (which forwards to Cloudinary)
 */
export const uploadImage = async (
  uri: string,
  folder: string,
  token: string,
): Promise<UploadResult> => {
  const formData = new FormData();

  // Get the file extension
  const uriParts = uri.split('.');
  const fileType = uriParts[uriParts.length - 1] || 'jpg';

  formData.append('image', {
    uri,
    name: `upload.${fileType}`,
    type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
  } as any);
  formData.append('folder', folder);

  const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });

  return {
    url: response.data.url,
    publicId: response.data.publicId,
  };
};
