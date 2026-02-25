const express = require('express');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Whitelist of allowed Cloudinary upload folders
const ALLOWED_FOLDERS = [
  'petopia/general',
  'petopia/posts',
  'petopia/profiles',
  'petopia/pets',
  'petopia/shops',
  'petopia/products',
  'petopia/vets',
  'petopia/groomers',
  'petopia/chat',
];

function sanitizeFolder(folder) {
  if (!folder || !ALLOWED_FOLDERS.includes(folder)) {
    return 'petopia/general';
  }
  return folder;
}

// ========================================
// Multer config — images up to 10 MB, videos up to 50 MB
// ========================================
const storage = multer.memoryStorage();

const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

const mediaUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB (videos are larger)
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  },
});

// All routes require authentication
router.use(protect);

// ========================================================================
//  POST /api/upload               — Single image upload (existing behavior)
// ========================================================================
router.post('/', imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'No image file provided' });
    }

    const folder = sanitizeFolder(req.body.folder);

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
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// ========================================================================
//  POST /api/upload/media          — Multi-file upload (carousel / video)
//  Accepts up to 10 files via field name "media"
//  Returns an array of { url, publicId, type, width, height, duration, thumbnail }
// ========================================================================
router.post('/media', mediaUpload.array('media', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: 'No media files provided' });
    }

    const folder = sanitizeFolder(req.body.folder);
    const results = [];

    for (const file of req.files) {
      const isVideo = file.mimetype.startsWith('video/');
      const resourceType = isVideo ? 'video' : 'image';

      const uploadOptions = {
        folder,
        resource_type: resourceType,
      };

      // Image-specific transforms
      if (!isVideo) {
        uploadOptions.transformation = [
          { width: 1080, height: 1080, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ];
      } else {
        // Video: auto quality, limit duration for free tier
        uploadOptions.transformation = [{ quality: 'auto' }];
        // Generate thumbnail from first frame
        uploadOptions.eager = [
          { width: 480, height: 480, crop: 'limit', format: 'jpg' },
        ];
        uploadOptions.eager_async = false;
      }

      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
        uploadStream.end(file.buffer);
      });

      const mediaItem = {
        url: result.secure_url,
        publicId: result.public_id,
        type: isVideo ? 'video' : 'image',
        width: result.width || null,
        height: result.height || null,
        duration: isVideo ? Math.round(result.duration || 0) : null,
        thumbnail:
          isVideo && result.eager?.[0] ? result.eager[0].secure_url : null,
      };

      results.push(mediaItem);
    }

    res.json({ success: true, media: results });
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// ========================================================================
//  DELETE /api/upload              — Delete from Cloudinary
// ========================================================================
router.delete('/', async (req, res) => {
  try {
    const { publicId, resourceType } = req.body;
    if (!publicId) {
      return res
        .status(400)
        .json({ success: false, message: 'publicId is required' });
    }

    // Validate publicId belongs to petopia namespace — prevent deleting other resources
    if (typeof publicId !== 'string' || !publicId.startsWith('petopia/')) {
      return res
        .status(403)
        .json({
          success: false,
          message: 'Not authorized to delete this resource',
        });
    }

    const allowedTypes = ['image', 'video'];
    const safeType = allowedTypes.includes(resourceType)
      ? resourceType
      : 'image';

    await cloudinary.uploader.destroy(publicId, {
      resource_type: safeType,
    });
    res.json({ success: true, message: 'Media deleted' });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete media' });
  }
});

module.exports = router;
