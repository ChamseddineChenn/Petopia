import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { RootState, AppDispatch } from '../../store/store';
import { fetchWallet, WalletTransaction } from '../../store/slices/walletSlice';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Helpers ──
const ICON_MAP: Record<string, { name: string; color: string; bg: string }> = {
  top_up: { name: 'arrow-down-circle', color: '#10B981', bg: '#ECFDF5' },
  purchase: { name: 'cart', color: '#EF4444', bg: '#FEF2F2' },
  refund: { name: 'refresh-circle', color: '#3B82F6', bg: '#EFF6FF' },
  reward: { name: 'gift', color: '#F59E0B', bg: '#FFFBEB' },
  transfer_in: { name: 'arrow-down-circle', color: '#10B981', bg: '#ECFDF5' },
  transfer_out: { name: 'arrow-up-circle', color: '#EF4444', bg: '#FEF2F2' },
  commission: { name: 'cash-outline', color: '#8B5CF6', bg: '#F5F3FF' },
  reservation: { name: 'time-outline', color: '#F59E0B', bg: '#FFFBEB' },
  withdrawal: { name: 'arrow-up-circle', color: '#6366F1', bg: '#EEF2FF' },
};

const TYPE_LABELS: Record<string, string> = {
  top_up: 'Top Up',
  purchase: 'Purchase',
  refund: 'Refund',
  reward: 'Reward',
  transfer_in: 'Received',
  transfer_out: 'Sent',
  commission: 'Commission',
  reservation: 'Reserved',
  withdrawal: 'Withdrawal',
};

const STATUS_STYLES: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  completed: { color: '#10B981', bg: '#ECFDF5', label: 'Completed' },
  pending: { color: '#F59E0B', bg: '#FFFBEB', label: 'Pending' },
  failed: { color: '#EF4444', bg: '#FEF2F2', label: 'Failed' },
  reversed: { color: '#6B7280', bg: '#F3F4F6', label: 'Reversed' },
};

/** Concise title from transaction type + amount direction */
function getBriefTitle(item: WalletTransaction): string {
  const label = TYPE_LABELS[item.type] || item.type;
  // For purchases with items, show first product name briefly
  if (item.type === 'purchase' && item.reference?.items?.length) {
    const first = item.reference.items[0].title;
    const more = item.reference.items.length - 1;
    const short = first.length > 18 ? first.slice(0, 18) + '…' : first;
    return more > 0 ? `${short} +${more}` : short;
  }
  // For transfers, use a short label
  if (item.type === 'transfer_in') return 'Payment Received';
  if (item.type === 'transfer_out') return 'Payment Sent';
  if (item.type === 'reservation') return 'Funds Reserved';
  if (item.type === 'commission') return 'Commission Fee';
  if (item.type === 'top_up') return 'Wallet Top Up';
  if (item.type === 'refund') return 'Refund';
  if (item.type === 'reward') return 'Reward';
  if (item.type === 'withdrawal') return 'Withdrawal';
  return label;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatFullDate(dateStr: string) {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' at ' +
    d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  );
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Detail Row Component ──
const DetailRow = ({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon?: string;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    disabled={!onPress}
    onPress={onPress}
    activeOpacity={onPress ? 0.6 : 1}
    style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    }}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
      {icon && (
        <Ionicons
          name={icon as any}
          size={14}
          color="#9CA3AF"
          style={{ marginRight: 6 }}
        />
      )}
      <Text style={{ fontSize: 12, color: '#9CA3AF', fontWeight: '500' }}>
        {label}
      </Text>
    </View>
    <Text
      style={{
        fontSize: 12,
        color: onPress ? '#4DB6AC' : '#4B5563',
        fontWeight: '500',
        maxWidth: '55%',
        textAlign: 'right',
      }}
      numberOfLines={1}
    >
      {value}
    </Text>
  </TouchableOpacity>
);

// ── Transaction Card Component ──
const TransactionCard = ({
  item,
  isExpanded,
  onToggle,
  userRole,
}: {
  item: WalletTransaction;
  isExpanded: boolean;
  onToggle: () => void;
  userRole?: string;
}) => {
  const isServiceProvider =
    userRole === 'vet' || userRole === 'groomer' || userRole === 'pet_shop';
  const isCredit = item.amount > 0;
  const icon = ICON_MAP[item.type] || ICON_MAP.purchase;
  const statusStyle = STATUS_STYLES[item.status] || STATUS_STYLES.completed;

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      style={{
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isExpanded ? '#E0F2F1' : '#F3F4F6',
        overflow: 'hidden',
      }}
    >
      {/* ── Collapsed row ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 13,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: icon.bg,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons name={icon.name as any} size={20} color={icon.color} />
        </View>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text
            style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}
            numberOfLines={1}
          >
            {getBriefTitle(item)}
          </Text>
          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', marginRight: 4 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: isCredit ? '#10B981' : '#EF4444',
            }}
          >
            {isCredit ? '+' : ''}P${Math.abs(item.amount).toFixed(2)}
          </Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#D1D5DB"
          style={{ marginLeft: 2 }}
        />
      </View>

      {/* ── Expanded details ── */}
      {isExpanded && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: '#F3F4F6',
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 14,
            backgroundColor: '#FAFAF7',
          }}
        >
          {/* Status badge + type */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <View
              style={{
                backgroundColor: statusStyle.bg,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                marginRight: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: statusStyle.color,
                }}
              >
                {statusStyle.label}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#F3F4F6',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
              }}
            >
              <Text
                style={{ fontSize: 11, fontWeight: '500', color: '#6B7280' }}
              >
                {TYPE_LABELS[item.type] || item.type}
              </Text>
            </View>
          </View>

          {/* Description */}
          <Text
            style={{
              fontSize: 13,
              color: '#4B5563',
              lineHeight: 18,
              marginBottom: 10,
            }}
          >
            {item.description}
          </Text>

          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: '#E5E7EB',
              marginBottom: 8,
            }}
          />

          {/* Core details */}
          <DetailRow
            label="Date"
            value={formatFullDate(item.createdAt)}
            icon="calendar-outline"
          />
          <DetailRow
            label="Balance After"
            value={`P$${item.balanceAfter.toFixed(2)}`}
            icon="wallet-outline"
          />
          <DetailRow
            label="Transaction ID"
            value={item._id.slice(-8).toUpperCase()}
            icon="finger-print-outline"
          />

          {/* Reference entity type */}
          {item.reference?.entityType && (
            <DetailRow
              label="Category"
              value={capitalizeFirst(
                item.reference.entityType.replace(/_/g, ' '),
              )}
              icon="pricetag-outline"
            />
          )}

          {/* Items breakdown for purchases */}
          {item.reference?.items && item.reference.items.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: '#6B7280',
                  marginBottom: 6,
                }}
              >
                Items
              </Text>
              {item.reference.items.map((product, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#fff',
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderRadius: 8,
                    marginBottom: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#4B5563',
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {product.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: '#9CA3AF',
                      marginHorizontal: 8,
                    }}
                  >
                    x{product.quantity}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: '#1F2937',
                    }}
                  >
                    P${(product.price * product.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Stripe payment details */}
          {item.stripeDetails && (
            <View style={{ marginTop: 8 }}>
              <View
                style={{
                  height: 1,
                  backgroundColor: '#E5E7EB',
                  marginBottom: 8,
                }}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: '#6B7280',
                  marginBottom: 4,
                }}
              >
                Payment Details
              </Text>
              {item.stripeDetails.cardBrand && item.stripeDetails.cardLast4 && (
                <DetailRow
                  label="Card"
                  value={`${capitalizeFirst(item.stripeDetails.cardBrand)} •••• ${item.stripeDetails.cardLast4}`}
                  icon="card-outline"
                />
              )}
              {item.stripeDetails.amountCharged != null && (
                <DetailRow
                  label="Charged"
                  value={`$${(item.stripeDetails.amountCharged / 100).toFixed(2)} ${(item.stripeDetails.currency || 'cad').toUpperCase()}`}
                  icon="cash-outline"
                />
              )}
              {item.stripeDetails.stripeFee != null && (
                <DetailRow
                  label="Processing Fee"
                  value={`$${(item.stripeDetails.stripeFee / 100).toFixed(2)}`}
                  icon="remove-circle-outline"
                />
              )}
              {item.stripeDetails.receiptUrl && (
                <DetailRow
                  label="Receipt"
                  value="View Receipt →"
                  icon="receipt-outline"
                  onPress={() =>
                    Linking.openURL(item.stripeDetails!.receiptUrl!)
                  }
                />
              )}
            </View>
          )}

          {/* Commission details — only for service providers */}
          {isServiceProvider &&
            item.commission &&
            (item.commission.platformAmount != null ||
              item.commission.sellerAmount != null) && (
              <View style={{ marginTop: 8 }}>
                <View
                  style={{
                    height: 1,
                    backgroundColor: '#E5E7EB',
                    marginBottom: 8,
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: '#6B7280',
                    marginBottom: 4,
                  }}
                >
                  Commission Breakdown
                </Text>
                {item.commission.rate != null && (
                  <DetailRow
                    label="Rate"
                    value={`${(item.commission.rate * 100).toFixed(0)}%`}
                    icon="analytics-outline"
                  />
                )}
                {item.commission.platformAmount != null && (
                  <DetailRow
                    label="Platform Fee"
                    value={`P$${Math.abs(item.commission.platformAmount).toFixed(2)}`}
                    icon="business-outline"
                  />
                )}
                {item.commission.sellerAmount != null && (
                  <DetailRow
                    label="Seller Received"
                    value={`P$${item.commission.sellerAmount.toFixed(2)}`}
                    icon="person-outline"
                  />
                )}
              </View>
            )}
        </View>
      )}
    </TouchableOpacity>
  );
};

export const WalletScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { user } = useSelector((state: RootState) => state.auth);
  const { balance, transactions, loading, pagination } = useSelector(
    (state: RootState) => state.wallet,
  );
  const isServiceProvider =
    user?.role === 'vet' ||
    user?.role === 'groomer' ||
    user?.role === 'pet_shop';
  const loadingMore = useRef(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchWallet({ page: 1 }));
  }, [dispatch]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore.current || loading || pagination.page >= pagination.pages)
      return;
    loadingMore.current = true;
    dispatch(fetchWallet({ page: pagination.page + 1 })).finally(() => {
      loadingMore.current = false;
    });
  }, [dispatch, loading, pagination]);

  const handleRefresh = useCallback(() => {
    dispatch(fetchWallet({ page: 1 }));
  }, [dispatch]);

  const toggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        250,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity,
      ),
    );
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const renderTransaction = useCallback(
    ({ item }: { item: WalletTransaction }) => (
      <TransactionCard
        item={item}
        isExpanded={expandedId === item._id}
        onToggle={() => toggleExpand(item._id)}
        userRole={user?.role}
      />
    ),
    [expandedId, toggleExpand],
  );

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
          Pet Dollar Wallet
        </Text>
      </View>

      {/* Balance card */}
      <View
        style={{
          margin: 16,
          borderRadius: 20,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            backgroundColor: '#4DB6AC',
            padding: 28,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <MaterialCommunityIcons
              name="wallet"
              size={22}
              color="rgba(255,255,255,0.8)"
            />
            <Text
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.8)',
                fontWeight: '500',
                marginLeft: 6,
              }}
            >
              Available Balance
            </Text>
          </View>
          <Text
            style={{
              fontSize: 40,
              fontWeight: '800',
              color: '#fff',
              letterSpacing: -1,
            }}
          >
            P${balance.toFixed(2)}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.65)',
              marginTop: 4,
            }}
          >
            Pet Dollars
          </Text>
        </View>

        {/* Action buttons */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#fff',
            borderWidth: 1,
            borderTopWidth: 0,
            borderColor: '#E5E7EB',
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
          }}
        >
          <TouchableOpacity
            onPress={() => router.push('/top-up' as any)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              borderRightWidth: 1,
              borderRightColor: '#E5E7EB',
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color="#4DB6AC" />
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#4DB6AC',
                marginLeft: 6,
              }}
            >
              Top Up
            </Text>
          </TouchableOpacity>
          {isServiceProvider && (
            <TouchableOpacity
              onPress={() => router.push('/withdraw' as any)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 14,
                borderRightWidth: 1,
                borderRightColor: '#E5E7EB',
              }}
            >
              <Ionicons
                name="arrow-up-circle-outline"
                size={20}
                color="#6366F1"
              />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#6366F1',
                  marginLeft: 6,
                }}
              >
                Withdraw
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push('/pet-shop-list' as any)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
            }}
          >
            <Ionicons name="storefront-outline" size={20} color="#4DB6AC" />
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#4DB6AC',
                marginLeft: 6,
              }}
            >
              Shop
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Transactions header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingBottom: 8,
        }}
      >
        <Text
          style={{ fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1 }}
        >
          Transaction History
        </Text>
        <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
          {pagination.total} transaction{pagination.total !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Transaction list */}
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshing={loading && pagination.page === 1}
        onRefresh={handleRefresh}
        extraData={expandedId}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <MaterialCommunityIcons
                name="wallet-outline"
                size={56}
                color="#D1D5DB"
              />
              <Text style={{ fontSize: 16, color: '#6B7280', marginTop: 12 }}>
                No transactions yet
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: '#9CA3AF',
                  marginTop: 4,
                  textAlign: 'center',
                  paddingHorizontal: 40,
                }}
              >
                Top up your wallet to start using Pet Dollars across the app
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/top-up' as any)}
                activeOpacity={0.7}
                style={{
                  marginTop: 20,
                  backgroundColor: '#4DB6AC',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 24,
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}
                >
                  Top Up Now
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading && pagination.page > 1 ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator color="#4DB6AC" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};
