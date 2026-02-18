const express = require('express');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Configure multer for memory storage (we'll upload the buffer to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// All routes require authentication
router.use(protect);

// @route   POST /api/upload
// @desc    Upload an image to Cloudinary
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'No image file provided' });
    }

    const folder = req.body.folder || 'petopia/general';

    // Upload buffer to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      uploadStream.end(req.file.buffer);
    });

    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res
      .status(500)
      .json({ success: false, message: error.message || 'Upload failed' });
  }
});

// @route   DELETE /api/upload
// @desc    Delete an image from Cloudinary
router.delete('/', async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res
        .status(400)
        .json({ success: false, message: 'publicId is required' });
    }

    await cloudinary.uploader.destroy(publicId);
    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete image' });
  }
});

module.exports = router;
