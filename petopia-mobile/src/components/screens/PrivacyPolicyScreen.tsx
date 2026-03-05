import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const POLICY_VERSION = '1.0';
const EFFECTIVE_DATE = 'January 1, 2025';

const SECTIONS = [
  {
    title: '1. Introduction',
    body: 'Code Anvil Company ("Company", "we", "us") operates the Petopia mobile application ("App"). This Privacy Policy explains how we collect, use, disclose, and protect your personal information when you use our App, in accordance with Canadian federal and provincial privacy legislation.',
  },
  {
    title: '2. Information We Collect',
    body: '\u2022 Account Information: Name, email address, password (encrypted), phone number, date of birth, gender, country, and city.\n\u2022 Profile Information: Profile photo, bio, and account visibility preferences.\n\u2022 Pet Information: Pet names, species, breeds, health records, photos, and medical history.\n\u2022 Usage Data: App interaction patterns, device information, IP address, and user agent.\n\u2022 Financial Information: Processed securely by Stripe, Inc. We store only Stripe customer/account IDs \u2014 never full card numbers.\n\u2022 Communications: Messages exchanged through the in-app chat system.\n\u2022 Location Data: City/country (provided by you), not precise GPS tracking.\n\u2022 Push Notification Tokens: Device tokens for delivering notifications.',
  },
  {
    title: '3. How We Use Your Information',
    body: 'We use your personal information for the following purposes:\n\n\u2022 Account Management: Creating and maintaining your account, authentication, and verification.\n\u2022 Service Delivery: Connecting pet owners with veterinarians, groomers, and pet shops; managing appointments and bookings.\n\u2022 Payment Processing: Processing Pet Dollar transactions, top-ups, and withdrawals through Stripe.\n\u2022 Communication: Sending notifications about appointments, messages, follows, and system updates.\n\u2022 Safety & Security: Protecting against fraud, unauthorized access, and ensuring platform integrity.\n\u2022 Improvement: Analyzing usage patterns to improve the App experience (aggregated, non-identifying data only).',
  },
  {
    title: '4. Consent (PIPEDA Principle)',
    body: 'We obtain your meaningful consent before collecting, using, or disclosing your personal information. You provide express consent when you:\n\n\u2022 Create an account and accept these terms\n\u2022 Enable push notifications\n\u2022 Submit information through forms\n\nYou may withdraw consent at any time by adjusting your privacy settings, disabling notifications, or deleting your account. Withdrawal of consent may limit your ability to use certain features.',
  },
  {
    title: '5. Data Sharing & Disclosure',
    body: 'We do not sell your personal information. We may share information with:\n\n\u2022 Service Providers: Stripe (payments), MongoDB Atlas (database hosting in Canada), Cloudinary (image hosting), and email service providers.\n\u2022 Other Users: Your public profile information, posts, and reviews are visible to other users based on your privacy settings.\n\u2022 Veterinarians/Groomers: When you book an appointment, relevant pet and contact information is shared with the provider.\n\u2022 Legal Requirements: When required by Canadian law, regulation, or court order.\n\u2022 Business Transfers: In the event of a merger, acquisition, or sale of assets, your data may be transferred with prior notice.',
  },
  {
    title: '6. Data Hosting & Storage',
    body: 'Your data is stored on servers located in Canada (Montreal region) through MongoDB Atlas. Image files are stored via Cloudinary with Canadian CDN endpoints. We use industry-standard encryption (TLS 1.2+ in transit, AES-256 at rest) to protect your data.',
  },
  {
    title: '7. Data Retention',
    body: 'We retain your personal information for as long as your account is active or as needed to provide services. After account deletion:\n\n\u2022 Personal data is deleted within 30 days\n\u2022 Audit logs are retained for up to 2 years for security compliance\n\u2022 Anonymized aggregated data may be retained indefinitely\n\u2022 Financial transaction records are retained as required by Canadian tax law (7 years)',
  },
  {
    title: '8. Your Rights Under PIPEDA',
    body: 'You have the right to:\n\n\u2022 Access: Request a copy of your personal data (Settings > Privacy > Export My Data).\n\u2022 Correction: Update your profile information at any time through the App.\n\u2022 Deletion: Delete your account and associated data (Settings > Account > Delete Account).\n\u2022 Withdraw Consent: Opt out of non-essential communications and notifications.\n\u2022 Complaint: File a complaint with the Office of the Privacy Commissioner of Canada if you believe your privacy rights have been violated.',
  },
  {
    title: '9. Push Notifications & CASL Compliance',
    body: "In compliance with Canada's Anti-Spam Legislation (CASL):\n\n\u2022 We only send push notifications with your express consent\n\u2022 You can customize notification categories (likes, comments, follows, messages) in Settings\n\u2022 Your notification preferences are stored on our servers and respected across all devices\n\u2022 You may opt out of any notification category at any time\n\u2022 We do not send marketing emails without express opt-in consent",
  },
  {
    title: "10. Children's Privacy",
    body: 'Petopia is not directed at children under 13. We do not knowingly collect personal information from children under 13. If we discover that a child under 13 has provided personal information, we will delete it promptly. Users between 13 and 18 require parental consent.',
  },
  {
    title: '11. Security Measures',
    body: 'We implement robust security measures including:\n\n\u2022 Passwords hashed with bcrypt (12 rounds)\n\u2022 JWT authentication pinned to HS256\n\u2022 Rate limiting on all API endpoints\n\u2022 Input sanitization against NoSQL injection\n\u2022 HTTP security headers via Helmet\n\u2022 Audit logging of security-sensitive events\n\u2022 Encrypted data transmission (HTTPS/TLS)',
  },
  {
    title: '12. Breach Notification',
    body: 'In the event of a data breach that poses a real risk of significant harm, we will:\n\n\u2022 Notify the Privacy Commissioner of Canada\n\u2022 Notify affected users via email and in-app notification\n\u2022 Provide details about the breach and steps to protect yourself\n\u2022 Maintain a record of all breaches as required by PIPEDA',
  },
  {
    title: '13. Changes to This Policy',
    body: 'We may update this Privacy Policy periodically. Material changes will be communicated via in-app notification. Your continued use after changes constitutes acceptance. You can always view the current version in Settings > About > Privacy Policy.',
  },
  {
    title: '14. Contact & Complaints',
    body: 'Privacy Officer: Code Anvil Company\nEmail: privacy@petopia.ca\nLocation: Quebec, Canada\n\nOffice of the Privacy Commissioner of Canada:\nWebsite: www.priv.gc.ca\nToll-free: 1-800-282-1376',
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-bg-main" edges={['top']}>
      <View className="flex-row items-center px-4 py-3 border-b border-bg-alt bg-white">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center mr-3"
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={18} color="#1F2937" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text
            className="text-lg font-bold text-text-primary"
            accessibilityRole="header"
          >
            {'Privacy Policy'}
          </Text>
          <Text className="text-xs text-text-muted">
            {'Version ' +
              POLICY_VERSION +
              ' \u2014 Effective ' +
              EFFECTIVE_DATE}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-primary/10 rounded-xl p-3 mb-4">
          <Text className="text-xs text-primary-dark leading-4">
            {
              "This Privacy Policy complies with the Personal Information Protection and Electronic Documents Act (PIPEDA) and Canada's Anti-Spam Legislation (CASL). We are committed to protecting your privacy and handling your personal information responsibly."
            }
          </Text>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} className="mb-5">
            <Text
              className="text-base font-bold text-text-primary mb-2"
              accessibilityRole="header"
            >
              {section.title}
            </Text>
            <Text className="text-sm text-text-secondary leading-5">
              {section.body}
            </Text>
          </View>
        ))}

        <View className="mt-6 pt-4 border-t border-bg-alt">
          <Text className="text-xs text-text-muted text-center leading-4">
            {'Last updated: ' + EFFECTIVE_DATE + '\nVersion: ' + POLICY_VERSION}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
