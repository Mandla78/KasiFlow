import { LegalDocument } from './types';

export const TERMS_OF_USE: LegalDocument = {
  version: '0.1-draft',
  title: 'Terms of Use',
  effectiveDate: '24 September 2026',
  draftNotice: 'Draft for review. These terms must be checked by a legal professional before Akayza launches to the public.',
  sections: [
    {
      heading: '1. About these terms',
      paragraphs: [
        'These terms are an agreement between you and Akayza when you use the Akayza app. By creating an account you agree to them and to our Privacy Policy.',
      ],
    },
    {
      heading: '2. Who can use Akayza',
      paragraphs: [
        'You must be 18 or older and use Akayza for a real business that you run or are allowed to act for. The information you give us must be true, and you must keep it up to date.',
      ],
    },
    {
      heading: '3. Your account',
      paragraphs: [
        'Keep your password and your phone safe. Confirmations made from your phone are treated as made by you. If you lose your phone, sign in on a new one: this switches off the old phone\'s key. Tell us straight away if you think someone else has used your account.',
      ],
    },
    {
      heading: '4. Suppliers and orders',
      paragraphs: [
        'Suppliers on Akayza are independent businesses. Akayza is not the seller: your order is a contract between you and the supplier. Prices, stock, delivery times and the quality of goods are the supplier\'s responsibility.',
        'Supplier recommendations are based on your location, the categories you buy and how you like to pay. They are suggestions, not endorsements.',
      ],
    },
    {
      heading: '5. Payments',
      paragraphs: [
        'Digital payments are processed by PayFast under its own terms. Akayza never sees or stores your card details.',
        'Cash on delivery is confirmed by both you and the supplier\'s driver in the app. Only confirm cash you have actually handed over.',
        'Credit you give your own customers is recorded by you, and repayments are cash. Akayza does not lend money and is not a party to credit between you and your customers.',
      ],
    },
    {
      heading: '6. Verification badges',
      paragraphs: [
        'A "Verified" badge means we checked a detail, such as a CIPC registration, against an official source at a point in time. It is not a guarantee of a business\'s quality or conduct. Documents marked "Pending review" have not been checked yet.',
      ],
    },
    {
      heading: '7. Your records',
      paragraphs: [
        'The records you create (orders, payments, credit, confirmations) are yours. Sealed records cannot be edited afterwards; corrections are added as new entries so the history stays honest. You can download your data at any time.',
      ],
    },
    {
      heading: '8. Things you may not do',
      paragraphs: [
        'Do not use Akayza for illegal goods or activity, give false information, try to access another business\'s information, interfere with the app or its security, or confirm payments or deliveries that did not happen.',
      ],
    },
    {
      heading: '9. Suspension and closing your account',
      paragraphs: [
        'We may suspend or close an account that breaks these terms or puts other users at risk, and will tell you why unless the law prevents it. You can close your account at any time from More > Security.',
      ],
    },
    {
      heading: '10. Liability',
      paragraphs: [
        'We work hard to keep Akayza available and accurate, but we provide it "as is". To the extent the law allows, Akayza is not liable for losses caused by suppliers, customers, or events outside our control. Nothing in these terms limits rights you have under the Consumer Protection Act where it applies.',
      ],
    },
    {
      heading: '11. Changes and law',
      paragraphs: [
        'If we change these terms in a way that matters, we will show you the new version and ask you to agree again. These terms are governed by the laws of South Africa.',
        'Contact: support@akayza.co.za (placeholder).',
      ],
    },
  ],
};
