import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const TERMS_VERSION = '1.0';
const EFFECTIVE_DATE = 'January 1, 2025';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By creating an account or using the Petopia mobile application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the App. These Terms constitute a legally binding agreement between you and Code Anvil Company ("Company", "we", "us", "our"), a Canadian-registered business.',
  },
  {
    title: '2. Eligibility',
    body: 'You must be at least 13 years of age to use Petopia. If you are under 18, you must have parental or guardian consent. By using the App, you represent that you meet these requirements.',
  },
  {
    title: '3. User Accounts',
    body: 'You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate. You may not share your account with others or create multiple accounts. We reserve the right to suspend or terminate accounts that violate these Terms.',
  },
  {
    title: '4. User Roles & Services',
    body: 'Petopia offers different account roles: Pet Owners, Veterinarians, Groomers, and Pet Shops. Service providers (Vets, Groomers, Pet Shops) must ensure they hold all required licenses and permits under applicable Canadian law (federal, provincial, and municipal). Petopia does not verify professional credentials and is not responsible for the quality of services provided by third-party service providers.',
  },
  {
    title: '5. Pet Dollar (P$) Wallet System',
    body: 'Pet Dollars (P$) are a digital wallet currency used within Petopia at a fixed rate of 1 P$ = 1 CAD. P$ can be purchased ("topped up") via Stripe-powered credit/debit card transactions. Service providers may withdraw earned P$ to their linked bank account via Stripe Connect. A platform commission of 7% is deducted from service payments. Stripe processing fees (3.5% on top-up) are borne by the user. P$ are not legal tender, are non-transferable outside the App, and carry no interest. We reserve the right to modify the commission rate or fees with 30 days\' notice.',
  },
  {
    title: '6. Payments & Refunds',
    body: "All payments are processed securely through Stripe, Inc. Appointment payments are reservation-based: funds are held in the customer's wallet and transferred to the provider upon service completion. Refund policies for cancelled appointments are handled on a case-by-case basis. Disputed charges should be reported to support@petopia.ca.",
  },
  {
    title: '7. Acceptable Use',
    body: "You agree not to:\n\u2022 Upload harmful, offensive, or illegal content\n\u2022 Harass, bully, or threaten other users\n\u2022 Impersonate another person or entity\n\u2022 Use the App for any unlawful purpose\n\u2022 Attempt to gain unauthorized access to other accounts or systems\n\u2022 Scrape, crawl, or data-mine the App's content\n\u2022 Interfere with the App's operation or security",
  },
  {
    title: '8. Content & Intellectual Property',
    body: "You retain ownership of content you upload (photos, posts, comments). By posting content, you grant Petopia a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content within the App. You must not upload content that infringes on any third party's intellectual property rights. We may remove content that violates these Terms.",
  },
  {
    title: '9. Privacy',
    body: 'Your use of the App is also governed by our Privacy Policy, which describes how we collect, use, and protect your personal information in compliance with the Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable provincial privacy legislation. By using the App, you consent to the practices described in the Privacy Policy.',
  },
  {
    title: '10. Health Records',
    body: "Petopia allows pet owners and authorized veterinarians to manage pet health records. Health record data is stored on secure, Canadian-hosted servers. Petopia is not a substitute for professional veterinary advice. Always consult a licensed veterinarian for your pet's health needs.",
  },
  {
    title: '11. Limitation of Liability',
    body: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, PETOPIA AND CODE ANVIL COMPANY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE APP. Our total liability shall not exceed the amount you have paid to us in the 12 months preceding the claim.',
  },
  {
    title: '12. Indemnification',
    body: 'You agree to indemnify and hold harmless Code Anvil Company, its officers, directors, employees, and agents from any claims, damages, or expenses arising from your use of the App or violation of these Terms.',
  },
  {
    title: '13. Modifications',
    body: 'We may update these Terms from time to time. We will notify you of material changes via in-app notification or email. Continued use of the App after changes constitutes acceptance of the updated Terms. If you do not agree with the changes, you must stop using the App and delete your account.',
  },
  {
    title: '14. Termination',
    body: 'We reserve the right to suspend or terminate your account at any time for violation of these Terms. You may delete your account at any time through Settings > Account > Delete Account. Upon deletion, your data will be removed in accordance with our Privacy Policy.',
  },
  {
    title: '15. Governing Law',
    body: 'These Terms are governed by the laws of Canada and the Province of Quebec. Any disputes shall be resolved in the courts of competent jurisdiction in Quebec, Canada.',
  },
  {
    title: '16. Contact Us',
    body: 'If you have questions about these Terms, please contact us at:\nEmail: support@petopia.ca\nCompany: Code Anvil Company\nLocation: Quebec, Canada',
  },
];

export default function TermsOfServiceScreen() {
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
            {'Terms of Service'}
          </Text>
          <Text className="text-xs text-text-muted">
            {'Version ' + TERMS_VERSION + ' \u2014 Effective ' + EFFECTIVE_DATE}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
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
            {'Last updated: ' + EFFECTIVE_DATE + '\nVersion: ' + TERMS_VERSION}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
