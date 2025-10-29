/**
 * Cloudinary Upload Utility
 * Uploads images directly to Cloudinary and returns URLs
 */

// Cloudinary configuration - These should be environment variables in production
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'YOUR_CLOUD_NAME';
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'YOUR_UPLOAD_PRESET';

/**
 * Upload a single image to Cloudinary
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} - The secure URL of the uploaded image
 */
export const uploadImageToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'cadence-leads'); // Organize uploads in a folder

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.secure_url; // Return the secure URL
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

/**
 * Upload multiple images to Cloudinary
 * @param {Array<File>} files - Array of image files to upload
 * @returns {Promise<Array<string>>} - Array of secure URLs
 */
export const uploadMultipleImagesToCloudinary = async (files) => {
  const uploadPromises = files.map(file => uploadImageToCloudinary(file));
  return Promise.all(uploadPromises);
};

/**
 * Validate if Cloudinary is configured
 * @returns {boolean} - True if configured
 */
export const isCloudinaryConfigured = () => {
  return (
    CLOUDINARY_CLOUD_NAME !== 'YOUR_CLOUD_NAME' &&
    CLOUDINARY_UPLOAD_PRESET !== 'YOUR_UPLOAD_PRESET'
  );
};
