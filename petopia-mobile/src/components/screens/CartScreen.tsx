import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAlert } from '../ui/CustomAlert';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { RootState, AppDispatch } from '../../store/store';
import {
  fetchCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  checkout,
  CartItem,
} from '../../store/slices/cartSlice';
import { fetchBalance, setBalance } from '../../store/slices/walletSlice';

export const CartScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const { cart, loading } = useSelector((state: RootState) => state.cart);
  const walletBalance = useSelector((state: RootState) => state.wallet.balance);

  useEffect(() => {
    dispatch(fetchCart());
    dispatch(fetchBalance());
  }, [dispatch]);

  const handleUpdateQty = useCallback(
    (productId: string, quantity: number) => {
      dispatch(updateCartItem({ productId, quantity }));
    },
    [dispatch],
  );

  const handleRemove = useCallback(
    (productId: string, title: string) => {
      showAlert({
        title: 'Remove Item',
        message: `Remove "${title}" from cart?`,
        variant: 'confirm',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => dispatch(removeFromCart(productId)),
          },
        ],
      });
    },
    [dispatch, showAlert],
  );

  const handleClearCart = () => {
    showAlert({
      title: 'Clear Cart',
      message: 'Remove all items?',
      variant: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => dispatch(clearCart()),
        },
      ],
    });
  };

  const handleCheckout = async () => {
    if (walletBalance < cart.total) {
      showAlert({
        title: 'Insufficient Pet Dollars',
        message: `You need P$${cart.total.toFixed(2)} but only have P$${walletBalance.toFixed(2)}.\n\nWould you like to top up your wallet?`,
        variant: 'warning',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Top Up', onPress: () => router.push('/top-up' as any) },
        ],
      });
      return;
    }

    try {
      const result = await dispatch(checkout()).unwrap();
      // Update wallet balance from checkout response
      if (result.balance !== undefined) {
        dispatch(setBalance(result.balance));
      }
      showAlert({
        title: 'Order Placed! 🎉',
        message: `P$${result.total.toFixed(2)} has been deducted from your Pet Dollar wallet.\n\nRemaining balance: P$${result.balance?.toFixed(2) ?? '—'}\n\nThank you for shopping with Petopia!`,
        variant: 'success',
        buttons: [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ],
      });
    } catch (err: any) {
      showAlert({
        title: 'Checkout Failed',
        message: err || 'Something went wrong',
        variant: 'error',
      });
    }
  };

  const renderItem = ({ item }: { item: CartItem }) => {
    const product = item.product;
    if (!product) return null;

    return (
      <View
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
          {/* Image */}
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/product-detail',
                params: { productId: product._id },
              })
            }
          >
            {product.images?.[0] ? (
              <Image
                source={{ uri: product.images[0] }}
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
                <Ionicons name="cube-outline" size={28} color="#D1D5DB" />
              </View>
            )}
          </TouchableOpacity>

          {/* Info */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}
              numberOfLines={2}
            >
              {product.title}
            </Text>
            {item.shop && (
              <Text
                style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}
                numberOfLines={1}
              >
                {item.shop.shopName}
              </Text>
            )}
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: '#4DB6AC',
                marginTop: 4,
              }}
            >
              P${(product.price * item.quantity).toFixed(2)}
            </Text>
          </View>

          {/* Remove */}
          <TouchableOpacity
            onPress={() => handleRemove(product._id, product.title)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ paddingLeft: 8, justifyContent: 'flex-start' }}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Quantity stepper */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingHorizontal: 12,
            paddingBottom: 10,
          }}
        >
          <Text style={{ fontSize: 13, color: '#6B7280', marginRight: 8 }}>
            P${product.price.toFixed(2)} each
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <TouchableOpacity
              onPress={() =>
                item.quantity > 1
                  ? handleUpdateQty(product._id, item.quantity - 1)
                  : handleRemove(product._id, product.title)
              }
              style={{
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={item.quantity > 1 ? 'remove' : 'trash-outline'}
                size={16}
                color={item.quantity > 1 ? '#4B5563' : '#EF4444'}
              />
            </TouchableOpacity>
            <Text
              style={{
                width: 28,
                textAlign: 'center',
                fontSize: 14,
                fontWeight: '600',
                color: '#1F2937',
              }}
            >
              {item.quantity}
            </Text>
            <TouchableOpacity
              onPress={() =>
                handleUpdateQty(
                  product._id,
                  Math.min(product.quantity, item.quantity + 1),
                )
              }
              style={{
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={16} color="#4B5563" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF7' }}>
      {/* Header */}
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
          Shopping Cart
        </Text>
        {cart.items.length > 0 && (
          <TouchableOpacity onPress={handleClearCart} activeOpacity={0.7}>
            <Text style={{ fontSize: 13, color: '#EF4444', fontWeight: '500' }}>
              Clear All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Cart items */}
      <FlatList
        data={cart.items}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', paddingTop: 80 }}>
              <Ionicons name="cart-outline" size={64} color="#D1D5DB" />
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '600',
                  color: '#6B7280',
                  marginTop: 16,
                }}
              >
                Your cart is empty
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#9CA3AF',
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                Browse pet shops and add items to get started!
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/pet-shop-list' as any)}
                style={{
                  marginTop: 20,
                  backgroundColor: '#4DB6AC',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 10,
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}
                >
                  Browse Shops
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ paddingTop: 40, alignItems: 'center' }}>
              <ActivityIndicator color="#4DB6AC" size="large" />
            </View>
          )
        }
      />

      {/* Bottom checkout bar */}
      {cart.items.length > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          {/* Summary */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <Text style={{ fontSize: 14, color: '#6B7280' }}>
              {cart.itemCount} item{cart.itemCount !== 1 ? 's' : ''}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937' }}>
              P${cart.total.toFixed(2)}
            </Text>
          </View>

          {/* Wallet balance row */}
          <TouchableOpacity
            onPress={() => router.push('/wallet' as any)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              backgroundColor:
                walletBalance >= cart.total ? '#ECFDF5' : '#FEF2F2',
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons
                name="wallet"
                size={16}
                color={walletBalance >= cart.total ? '#10B981' : '#EF4444'}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '500',
                  color: walletBalance >= cart.total ? '#10B981' : '#EF4444',
                  marginLeft: 6,
                }}
              >
                Pet Dollar Balance: P${walletBalance.toFixed(2)}
              </Text>
            </View>
            {walletBalance < cart.total && (
              <TouchableOpacity
                onPress={() => router.push('/top-up' as any)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: '600', color: '#4DB6AC' }}
                >
                  Top Up
                </Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Checkout button */}
          <TouchableOpacity
            onPress={handleCheckout}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#4DB6AC',
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>
              Checkout
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};
