const express = require('express');
const router = express.Router();
const PetShop = require('../models/PetShop');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

// ──────────────────────────────────────────
// SHOP CRUD
// ──────────────────────────────────────────

// POST /api/shops — Create or update my shop
router.post('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      shopName,
      description,
      logo,
      phone,
      email,
      address,
      categories,
      location,
    } = req.body;

    let shop = await PetShop.findOne({ owner: userId });

    if (shop) {
      // Update existing
      if (shopName !== undefined) shop.shopName = shopName;
      if (description !== undefined) shop.description = description;
      if (logo !== undefined) shop.logo = logo;
      if (phone !== undefined) shop.phone = phone;
      if (email !== undefined) shop.email = email;
      if (address !== undefined) shop.address = address;
      if (categories !== undefined) shop.categories = categories;
      if (location !== undefined) shop.location = location;
      await shop.save();
    } else {
      // Create new
      shop = await PetShop.create({
        owner: userId,
        shopName: shopName || 'My Pet Shop',
        description,
        logo,
        phone,
        email,
        address,
        categories,
        location,
      });
    }

    res.json({ success: true, shop });
  } catch (error) {
    console.error('Create/update shop error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/shops/mine — Get my shop
router.get('/mine', protect, async (req, res) => {
  try {
    const shop = await PetShop.findOne({ owner: req.user.id });
    if (!shop) {
      return res.json({ success: true, shop: null });
    }
    res.json({ success: true, shop });
  } catch (error) {
    console.error('Get my shop error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/shops — Browse all active shops
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category, city } = req.query;
    const filter = { isActive: true };

    if (typeof search === 'string' && search.trim()) {
      filter.$text = { $search: search };
    }
    if (typeof category === 'string') {
      filter.categories = category;
    }
    if (city) {
      const escapedCity =
        typeof city === 'string'
          ? city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          : '';
      filter['address.city'] = new RegExp(escapedCity, 'i');
    }

    const total = await PetShop.countDocuments(filter);
    const shops = await PetShop.find(filter)
      .populate('owner', 'name profileImage')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      shops,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      total,
    });
  } catch (error) {
    console.error('Browse shops error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/shops/:id — Get shop detail
router.get('/:id', protect, async (req, res) => {
  try {
    const shop = await PetShop.findById(req.params.id).populate(
      'owner',
      'name profileImage',
    );
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: 'Shop not found' });
    }
    res.json({ success: true, shop });
  } catch (error) {
    console.error('Get shop error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/shops — Delete my shop
router.delete('/', protect, async (req, res) => {
  try {
    const shop = await PetShop.findOneAndDelete({ owner: req.user.id });
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: 'Shop not found' });
    }
    // Also delete all products
    await Product.deleteMany({ owner: req.user.id });
    res.json({ success: true, message: 'Shop and products deleted' });
  } catch (error) {
    console.error('Delete shop error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────
// PRODUCT CRUD
// ──────────────────────────────────────────

// POST /api/shops/products — Create product
router.post('/products', protect, async (req, res) => {
  try {
    const shop = await PetShop.findOne({ owner: req.user.id });
    if (!shop) {
      return res
        .status(400)
        .json({ success: false, message: 'Create a shop first' });
    }

    const {
      title,
      description,
      category,
      price,
      compareAtPrice,
      quantity,
      images,
      attributes,
      petType,
    } = req.body;

    const product = await Product.create({
      shop: shop._id,
      owner: req.user.id,
      title,
      description,
      category,
      price,
      compareAtPrice,
      quantity,
      images: images || [],
      attributes: attributes || {},
      petType,
    });

    // Increment shop product count
    shop.productsCount = (shop.productsCount || 0) + 1;
    await shop.save();

    res.status(201).json({ success: true, product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/shops/products/:productId — Update product
router.put('/products/:productId', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found' });
    }
    if (product.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    const updateFields = [
      'title',
      'description',
      'category',
      'price',
      'compareAtPrice',
      'quantity',
      'images',
      'attributes',
      'petType',
      'isActive',
    ];

    updateFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/shops/products/:productId — Delete product
router.delete('/products/:productId', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found' });
    }
    if (product.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    await product.deleteOne();

    // Decrement shop product count
    await PetShop.findByIdAndUpdate(product.shop, {
      $inc: { productsCount: -1 },
    });

    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/shops/products/mine — Get my products
router.get('/products/mine', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    const filter = { owner: req.user.id };
    if (typeof category === 'string') filter.category = category;

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      products,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      total,
    });
  } catch (error) {
    console.error('Get my products error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/shops/:shopId/products — Get products by shop
router.get('/:shopId/products', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search, sort } = req.query;
    const filter = { shop: req.params.shopId, isActive: true };
    if (typeof category === 'string') filter.category = category;
    if (typeof search === 'string' && search.trim()) {
      filter.$text = { $search: search };
    }

    let sortObj = { createdAt: -1 };
    if (sort === 'price_asc') sortObj = { price: 1 };
    if (sort === 'price_desc') sortObj = { price: -1 };
    if (sort === 'popular') sortObj = { soldCount: -1 };

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort(sortObj)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      products,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      total,
    });
  } catch (error) {
    console.error('Get shop products error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/shops/products/:productId — Get single product
router.get('/products/:productId', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId).populate({
      path: 'shop',
      select: 'shopName logo owner',
      populate: { path: 'owner', select: 'name profileImage' },
    });
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/shops/products/browse/all — Browse all products across shops
router.get('/products/browse/all', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search, sort, petType } = req.query;
    const filter = { isActive: true };
    if (typeof category === 'string') filter.category = category;
    if (typeof petType === 'string') filter.petType = { $in: [petType, 'all'] };
    if (typeof search === 'string' && search.trim()) {
      filter.$text = { $search: search };
    }

    let sortObj = { createdAt: -1 };
    if (sort === 'price_asc') sortObj = { price: 1 };
    if (sort === 'price_desc') sortObj = { price: -1 };
    if (sort === 'popular') sortObj = { soldCount: -1 };

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate({
        path: 'shop',
        select: 'shopName logo',
      })
      .sort(sortObj)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      products,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      total,
    });
  } catch (error) {
    console.error('Browse products error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
