import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Types ───────────────────────────────────────────────
type AlertVariant = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => any;
}

interface AlertConfig {
  title: string;
  message?: string;
  variant?: AlertVariant;
  buttons?: AlertButton[];
  icon?: keyof typeof Ionicons.glyphMap;
  autoDismiss?: number; // ms — auto-close after this duration
}

interface AlertContextValue {
  showAlert: (config: AlertConfig) => void;
}

// ─── Context ─────────────────────────────────────────────
const AlertContext = React.createContext<AlertContextValue>({
  showAlert: () => {},
});

export const useAlert = () => useContext(AlertContext);

// ─── Variant styling ─────────────────────────────────────
const VARIANT_MAP: Record<
  AlertVariant,
  {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBg: string;
    accentColor: string;
  }
> = {
  success: {
    icon: 'checkmark-circle',
    iconColor: '#10B981',
    iconBg: '#ECFDF5',
    accentColor: '#10B981',
  },
  error: {
    icon: 'close-circle',
    iconColor: '#EF4444',
    iconBg: '#FEF2F2',
    accentColor: '#EF4444',
  },
  warning: {
    icon: 'warning',
    iconColor: '#F59E0B',
    iconBg: '#FFFBEB',
    accentColor: '#F59E0B',
  },
  info: {
    icon: 'information-circle',
    iconColor: '#3B82F6',
    iconBg: '#EFF6FF',
    accentColor: '#3B82F6',
  },
  confirm: {
    icon: 'help-circle',
    iconColor: '#00897B',
    iconBg: '#E0F2F1',
    accentColor: '#00897B',
  },
};

// ─── Provider ────────────────────────────────────────────
export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconBounce = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAlert = useCallback((cfg: AlertConfig) => {
    setConfig(cfg);
    setVisible(true);
  }, []);

  const dismiss = useCallback(
    (callback?: () => any) => {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
        setConfig(null);
        if (callback) callback();
      });
    },
    [scaleAnim, opacityAnim],
  );

  // Animate in when visible
  useEffect(() => {
    if (visible && config) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      iconBounce.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 15,
          stiffness: 200,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        // Icon bounces instantly alongside the modal
        Animated.sequence([
          Animated.timing(iconBounce, {
            toValue: 1.2,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(iconBounce, {
            toValue: 1,
            damping: 8,
            stiffness: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Auto dismiss
      if (config.autoDismiss) {
        timerRef.current = setTimeout(() => dismiss(), config.autoDismiss);
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, config]);

  if (!config) {
    return (
      <AlertContext.Provider value={{ showAlert }}>
        {children}
      </AlertContext.Provider>
    );
  }

  const variant = config.variant || 'info';
  const vs = VARIANT_MAP[variant];
  const iconName = config.icon || vs.icon;
  const buttons = config.buttons?.length
    ? config.buttons
    : [{ text: 'OK', style: 'default' as const }];

  const hasCancel = buttons.some((b) => b.style === 'cancel');

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal
        transparent
        visible={visible}
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => dismiss()}
      >
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={() => dismiss()}>
          <Animated.View
            style={[styles.backdropOverlay, { opacity: opacityAnim }]}
          />
        </Pressable>

        {/* Dialog */}
        <View style={styles.center} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.dialog,
              {
                borderWidth: 2,
                borderColor: vs.accentColor,
                opacity: opacityAnim,
                transform: [
                  {
                    scale: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.7, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Icon */}
            <Animated.View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: vs.iconBg,
                  transform: [{ scale: iconBounce }],
                },
              ]}
            >
              <Ionicons name={iconName} size={32} color={vs.iconColor} />
            </Animated.View>

            {/* Title */}
            <Text style={styles.title}>{config.title}</Text>

            {/* Message */}
            {config.message ? (
              <Text style={styles.message}>{config.message}</Text>
            ) : null}

            {/* Buttons */}
            <View
              style={[
                styles.buttonRow,
                buttons.length === 1 && styles.buttonRowSingle,
              ]}
            >
              {buttons.map((btn, i) => {
                const isCancel = btn.style === 'cancel';
                const isDestructive = btn.style === 'destructive';
                const isPrimary =
                  !isCancel && !isDestructive && (!hasCancel || i > 0);

                return (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.75}
                    onPress={() => dismiss(btn.onPress)}
                    style={[
                      styles.button,
                      buttons.length > 1 && styles.buttonFlex,
                      isCancel && styles.buttonCancel,
                      isDestructive && styles.buttonDestructive,
                      isPrimary && !isDestructive && styles.buttonPrimary,
                      i > 0 && { marginLeft: 10 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isCancel && styles.buttonTextCancel,
                        isDestructive && styles.buttonTextDestructive,
                        isPrimary && !isDestructive && styles.buttonTextPrimary,
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
};

// ─── Styles ──────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DIALOG_WIDTH = Math.min(SCREEN_WIDTH - 48, 340);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  dialog: {
    width: DIALOG_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: 20,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginHorizontal: 24,
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
    marginHorizontal: 24,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    width: '100%',
  },
  buttonRowSingle: {
    justifyContent: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  buttonFlex: {
    flex: 1,
  },
  buttonPrimary: {
    backgroundColor: '#00897B',
  },
  buttonCancel: {
    backgroundColor: '#F3F4F6',
  },
  buttonDestructive: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  buttonTextCancel: {
    color: '#6B7280',
  },
  buttonTextDestructive: {
    color: '#EF4444',
  },
});
