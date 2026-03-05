import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchMyShop,
  createOrUpdateShop,
  fetchMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  Product,
} from '../../store/slices/shopSlice';
import { pickImage, uploadImage } from '../../services/ImageService';
import { useAlert } from '../ui/CustomAlert';

// ────────────────────────────────────────
// Constants
// ────────────────────────────────────────
const PRODUCT_CATEGORIES = [
  { value: 'food', label: 'Food' },
  { value: 'treats', label: 'Treats' },
  { value: 'toys', label: 'Toys' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'grooming', label: 'Grooming' },
  { value: 'health', label: 'Health' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'crates_carriers', label: 'Crates & Carriers' },
  { value: 'aquarium', label: 'Aquarium' },
  { value: 'other', label: 'Other' },
];

const PET_TYPE_OPTIONS = [
  { value: 'all', label: 'All Pets' },
  { value: 'dog', label: 'Dogs' },
  { value: 'cat', label: 'Cats' },
  { value: 'bird', label: 'Birds' },
  { value: 'fish', label: 'Fish' },
  { value: 'small_animal', label: 'Small Animals' },
  { value: 'reptile', label: 'Reptiles' },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c.value, c.label]),
);

// ────────────────────────────────────────
// ManagePetShopScreen
// ────────────────────────────────────────
export const ManagePetShopScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { token } = useSelector((state: RootState) => state.auth);
  const { myShop, myShopLoading, myProducts, myProductsLoading } = useSelector(
    (state: RootState) => state.shop,
  );

  const [tab, setTab] = useState<'shop' | 'products'>('shop');
  const [saving, setSaving] = useState(false);

  // Shop form
  const [shopName, setShopName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateField, setStateField] = useState('');
  const [country, setCountry] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Product form modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pTitle, setPTitle] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pCategory, setPCategory] = useState('food');
  const [pPrice, setPPrice] = useState('');
  const [pComparePrice, setPComparePrice] = useState('');
  const [pQuantity, setPQuantity] = useState('');
  const [pImages, setPImages] = useState<string[]>([]);
  const [pPetType, setPPetType] = useState('all');
  const [pBrand, setPBrand] = useState('');
  const [pWeight, setPWeight] = useState('');
  const [pSize, setPSize] = useState('');
  const [pColor, setPColor] = useState('');
  const [pMaterial, setPMaterial] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // ── Load data ──
  useEffect(() => {
    dispatch(fetchMyShop());
    dispatch(fetchMyProducts({}));
  }, [dispatch]);

  // ── Populate shop form ──
  useEffect(() => {
    if (myShop) {
      setShopName(myShop.shopName || '');
      setDescription(myShop.description || '');
      setPhone(myShop.phone || '');
      setEmail(myShop.email || '');
      setLogo(myShop.logo);
      setStreet(myShop.address?.street || '');
      setCity(myShop.address?.city || '');
      setStateField(myShop.address?.state || '');
      setCountry(myShop.address?.country || '');
      setSelectedCategories(myShop.categories || []);
    }
  }, [myShop]);

  // ── Save shop ──
  const handleSaveShop = async () => {
    if (!shopName.trim()) {
      showAlert({
        title: 'Error',
        message: 'Shop name is required',
        variant: 'warning',
      });
      return;
    }
    setSaving(true);
    try {
      await dispatch(
        createOrUpdateShop({
          shopName: shopName.trim(),
          description: description.trim(),
          phone: phone.trim(),
          email: email.trim(),
          logo: logo || undefined,
          address: {
            street: street.trim(),
            city: city.trim(),
            state: stateField.trim(),
            country: country.trim(),
          },
          categories: selectedCategories,
        }),
      ).unwrap();
      showAlert({
        title: 'Success',
        message: 'Shop saved!',
        variant: 'success',
      });
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Failed to save shop',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Logo picker ──
  const handlePickLogo = async () => {
    try {
      const uri = await pickImage();
      if (!uri || !token) return;
      setUploadingImage(true);
      const result = await uploadImage(uri, 'shops', token);
      setLogo(result.url);
    } catch {
      showAlert({
        title: 'Error',
        message: 'Failed to upload logo',
        variant: 'error',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  // ── Product modal helpers ──
  const openAddProduct = () => {
    setEditingProduct(null);
    setPTitle('');
    setPDesc('');
    setPCategory('food');
    setPPrice('');
    setPComparePrice('');
    setPQuantity('');
    setPImages([]);
    setPPetType('all');
    setPBrand('');
    setPWeight('');
    setPSize('');
    setPColor('');
    setPMaterial('');
    setShowProductModal(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setPTitle(product.title);
    setPDesc(product.description);
    setPCategory(product.category);
    setPPrice(String(product.price));
    setPComparePrice(
      product.compareAtPrice ? String(product.compareAtPrice) : '',
    );
    setPQuantity(String(product.quantity));
    setPImages(product.images || []);
    setPPetType(product.petType || 'all');
    setPBrand(product.attributes?.brand || '');
    setPWeight(product.attributes?.weight || '');
    setPSize(product.attributes?.size || '');
    setPColor(product.attributes?.color || '');
    setPMaterial(product.attributes?.material || '');
    setShowProductModal(true);
  };

  const handleSaveProduct = async () => {
    if (!pTitle.trim()) {
      showAlert({
        title: 'Error',
        message: 'Title is required',
        variant: 'warning',
      });
      return;
    }
    if (!pPrice || isNaN(Number(pPrice)) || Number(pPrice) < 0) {
      showAlert({
        title: 'Error',
        message: 'Valid price is required',
        variant: 'warning',
      });
      return;
    }
    if (!pQuantity || isNaN(Number(pQuantity)) || Number(pQuantity) < 0) {
      showAlert({
        title: 'Error',
        message: 'Valid quantity is required',
        variant: 'warning',
      });
      return;
    }

    setSavingProduct(true);
    try {
      const data = {
        title: pTitle.trim(),
        description: pDesc.trim(),
        category: pCategory,
        price: Number(pPrice),
        compareAtPrice: pComparePrice ? Number(pComparePrice) : undefined,
        quantity: Number(pQuantity),
        images: pImages,
        petType: pPetType,
        attributes: {
          brand: pBrand.trim(),
          weight: pWeight.trim(),
          size: pSize.trim(),
          color: pColor.trim(),
          material: pMaterial.trim(),
        },
      };

      if (editingProduct) {
        await dispatch(
          updateProduct({ productId: editingProduct._id, ...data }),
        ).unwrap();
      } else {
        await dispatch(createProduct(data)).unwrap();
      }
      setShowProductModal(false);
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err || 'Failed to save product',
        variant: 'error',
      });
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = (product: Product) => {
    showAlert({
      title: 'Delete Product',
      message: `Delete "${product.title}"?`,
      variant: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => dispatch(deleteProduct(product._id)),
        },
      ],
    });
  };

  const handleAddProductImage = async () => {
    try {
      const uri = await pickImage();
      if (!uri || !token) return;
      setUploadingImage(true);
      const result = await uploadImage(uri, 'products', token);
      setPImages((prev) => [...prev, result.url]);
    } catch {
      showAlert({
        title: 'Error',
        message: 'Failed to upload image',
        variant: 'error',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  // ── Loading ──
  if (myShopLoading && !myShop) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: '#FAFAF7' }}
      >
        <ActivityIndicator size="large" color="#4DB6AC" />
      </SafeAreaView>
    );
  }

  // ── Render Product Card ──
  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      onPress={() => openEditProduct(item)}
      activeOpacity={0.7}
      style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', padding: 12 }}>
        {item.images?.[0] ? (
          <Image
            source={{ uri: item.images[0] }}
            style={{ width: 72, height: 72, borderRadius: 8 }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 8,
              backgroundColor: '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="cube-outline" size={28} color="#9CA3AF" />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
          <Text
            style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
            {CATEGORY_LABELS[item.category] || item.category} • Qty:{' '}
            {item.quantity}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#4DB6AC' }}>
              P${item.price.toFixed(2)}
            </Text>
            {item.compareAtPrice ? (
              <Text
                style={{
                  fontSize: 13,
                  color: '#9CA3AF',
                  marginLeft: 8,
                  textDecorationLine: 'line-through',
                }}
              >
                P${item.compareAtPrice.toFixed(2)}
              </Text>
            ) : null}
            {!item.isActive && (
              <View
                style={{
                  marginLeft: 8,
                  backgroundColor: '#FEF2F2',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}
              >
                <Text style={{ fontSize: 11, color: '#EF4444' }}>Inactive</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteProduct(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ justifyContent: 'center', paddingLeft: 8 }}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF7' }}>
      {/* ── Header ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            marginLeft: 12,
            fontSize: 18,
            fontWeight: '700',
            color: '#1F2937',
          }}
        >
          My Pet Shop
        </Text>
      </View>

      {/* ── Tabs ── */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
      >
        {(['shop', 'products'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: tab === t ? '#4DB6AC' : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: tab === t ? '#4DB6AC' : '#6B7280',
              }}
            >
              {t === 'shop' ? 'Shop Info' : `Products (${myProducts.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab content ── */}
      {tab === 'shop' ? (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <TouchableOpacity
            onPress={handlePickLogo}
            style={{ alignSelf: 'center', marginBottom: 20 }}
          >
            {logo ? (
              <Image
                source={{ uri: logo }}
                style={{ width: 96, height: 96, borderRadius: 48 }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: '#E5E7EB',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="storefront-outline" size={36} color="#9CA3AF" />
                <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
                  Add Logo
                </Text>
              </View>
            )}
            {uploadingImage && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 48,
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          {/* Form fields */}
          <FormField
            label="Shop Name *"
            value={shopName}
            onChangeText={setShopName}
          />
          <FormField
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <FormField
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          {/* Address */}
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#374151',
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            Address
          </Text>
          <FormField label="Street" value={street} onChangeText={setStreet} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <FormField label="City" value={city} onChangeText={setCity} />
            </View>
            <View style={{ flex: 1 }}>
              <FormField
                label="State"
                value={stateField}
                onChangeText={setStateField}
              />
            </View>
          </View>
          <FormField
            label="Country"
            value={country}
            onChangeText={setCountry}
          />

          {/* Categories */}
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#374151',
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            Shop Categories
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PRODUCT_CATEGORIES.map((cat) => {
              const selected = selectedCategories.includes(cat.value);
              return (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => toggleCategory(cat.value)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: selected ? '#4DB6AC' : '#F3F4F6',
                    borderWidth: 1,
                    borderColor: selected ? '#4DB6AC' : '#E5E7EB',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: selected ? '#fff' : '#4B5563',
                    }}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Save */}
          <TouchableOpacity
            onPress={handleSaveShop}
            disabled={saving}
            activeOpacity={0.8}
            style={{
              marginTop: 24,
              marginBottom: 40,
              backgroundColor: '#4DB6AC',
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>
                {myShop ? 'Update Shop' : 'Create Shop'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* ── Products Tab ── */
        <View style={{ flex: 1 }}>
          <FlatList
            data={myProducts}
            renderItem={renderProduct}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              !myProductsLoading ? (
                <View style={{ alignItems: 'center', paddingTop: 60 }}>
                  <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
                  <Text
                    style={{
                      fontSize: 15,
                      color: '#6B7280',
                      marginTop: 12,
                    }}
                  >
                    No products yet
                  </Text>
                </View>
              ) : null
            }
          />
          {/* FAB */}
          <TouchableOpacity
            onPress={openAddProduct}
            activeOpacity={0.8}
            style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: '#4DB6AC',
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 4,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
            }}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Product Modal ── */}
      <Modal
        visible={showProductModal}
        animationType="slide"
        onRequestClose={() => setShowProductModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF7' }}>
          {/* Modal Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: '#fff',
              borderBottomWidth: 1,
              borderBottomColor: '#E5E7EB',
            }}
          >
            <TouchableOpacity
              onPress={() => setShowProductModal(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text
              style={{
                flex: 1,
                marginLeft: 12,
                fontSize: 18,
                fontWeight: '700',
                color: '#1F2937',
              }}
            >
              {editingProduct ? 'Edit Product' : 'New Product'}
            </Text>
            <TouchableOpacity
              onPress={handleSaveProduct}
              disabled={savingProduct}
              activeOpacity={0.7}
            >
              {savingProduct ? (
                <ActivityIndicator color="#4DB6AC" size="small" />
              ) : (
                <Text
                  style={{ fontSize: 15, fontWeight: '600', color: '#4DB6AC' }}
                >
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Images */}
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#374151',
                marginBottom: 8,
              }}
            >
              Images
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
            >
              {pImages.map((uri, idx) => (
                <View key={idx} style={{ marginRight: 8 }}>
                  <Image
                    source={{ uri }}
                    style={{ width: 80, height: 80, borderRadius: 8 }}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    onPress={() =>
                      setPImages((prev) => prev.filter((_, i) => i !== idx))
                    }
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: '#EF4444',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={handleAddProductImage}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#D1D5DB',
                  borderStyle: 'dashed',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {uploadingImage ? (
                  <ActivityIndicator color="#4DB6AC" size="small" />
                ) : (
                  <Ionicons name="camera-outline" size={24} color="#9CA3AF" />
                )}
              </TouchableOpacity>
            </ScrollView>

            <FormField
              label="Title *"
              value={pTitle}
              onChangeText={setPTitle}
            />
            <FormField
              label="Description"
              value={pDesc}
              onChangeText={setPDesc}
              multiline
            />

            {/* Category chips */}
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: '#374151',
                marginBottom: 6,
              }}
            >
              Category *
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
            >
              {PRODUCT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => setPCategory(cat.value)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    marginRight: 8,
                    backgroundColor:
                      pCategory === cat.value ? '#4DB6AC' : '#F3F4F6',
                    borderWidth: 1,
                    borderColor:
                      pCategory === cat.value ? '#4DB6AC' : '#E5E7EB',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: pCategory === cat.value ? '#fff' : '#4B5563',
                    }}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Pet type */}
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: '#374151',
                marginBottom: 6,
              }}
            >
              For Pet Type
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
            >
              {PET_TYPE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setPPetType(opt.value)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    marginRight: 8,
                    backgroundColor:
                      pPetType === opt.value ? '#4DB6AC' : '#F3F4F6',
                    borderWidth: 1,
                    borderColor: pPetType === opt.value ? '#4DB6AC' : '#E5E7EB',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: pPetType === opt.value ? '#fff' : '#4B5563',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Price / qty */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Price *"
                  value={pPrice}
                  onChangeText={setPPrice}
                  keyboardType="decimal-pad"
                  prefix="P$"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Compare At"
                  value={pComparePrice}
                  onChangeText={setPComparePrice}
                  keyboardType="decimal-pad"
                  prefix="P$"
                />
              </View>
            </View>
            <FormField
              label="Quantity *"
              value={pQuantity}
              onChangeText={setPQuantity}
              keyboardType="number-pad"
            />

            {/* Attributes */}
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#374151',
                marginTop: 12,
                marginBottom: 8,
              }}
            >
              Attributes (optional)
            </Text>
            <FormField label="Brand" value={pBrand} onChangeText={setPBrand} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Weight"
                  value={pWeight}
                  onChangeText={setPWeight}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Size" value={pSize} onChangeText={setPSize} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Color"
                  value={pColor}
                  onChangeText={setPColor}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Material"
                  value={pMaterial}
                  onChangeText={setPMaterial}
                />
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// ────────────────────────────────────────
// FormField helper
// ────────────────────────────────────────
const FormField: React.FC<{
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  keyboardType?: any;
  prefix?: string;
}> = ({ label, value, onChangeText, multiline, keyboardType, prefix }) => (
  <View style={{ marginBottom: 12 }}>
    <Text
      style={{
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 4,
      }}
    >
      {label}
    </Text>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 12,
      }}
    >
      {prefix && (
        <Text style={{ fontSize: 15, color: '#6B7280', marginRight: 4 }}>
          {prefix}
        </Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        style={{
          flex: 1,
          paddingVertical: 10,
          fontSize: 15,
          color: '#1F2937',
          ...(multiline ? { minHeight: 80, textAlignVertical: 'top' } : {}),
        }}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  </View>
);
