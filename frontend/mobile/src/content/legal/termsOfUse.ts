import { LegalDocument } from './types';

/**
 * Terms of Use. Every rule here must match what the app and backend
 * actually do (docs/supplier/12_POLICIES.txt); when a rule changes, this
 * changes with it and the version goes up (the backend's TERMS_VERSION too).
 */
export const TERMS_OF_USE: LegalDocument = {
  version: '0.2-draft',
  title: 'Terms of Use',
  effectiveDate: '26 September 2026',
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
        'You must be 18 or older and use Akayza for a real business that you run or are allowed to act for, such as a spaza shop, a building or trade business, or another informal business. The information you give us must be true, and you must keep it up to date.',
      ],
    },
    {
      heading: '3. Your account',
      paragraphs: [
        'Keep your password and your phone safe. Actions taken from your signed-in account are treated as yours. Signing in on a new phone needs a code sent to your email. Tell us straight away if you think someone else has used your account.',
      ],
    },
    {
      heading: '4. Suppliers and orders',
      paragraphs: [
        'Suppliers on Akayza are independent businesses. Akayza is not the seller: your order is a contract between you and the supplier. The quality of goods, delivery and collection are the supplier\'s responsibility.',
        'You can order only from suppliers you have connected with. The price of an order is the supplier\'s price when you place it, worked out by our server; the total in your cart is an estimate. The supplier\'s minimum order, delivery area and delivery fee apply.',
        'Stock is set aside for your order when you place it and released if the order is cancelled, not accepted, or not paid in time.',
      ],
    },
    {
      heading: '5. Paying digitally (recommended)',
      paragraphs: [
        'Digital payments (card or instant EFT) are made on PayFast\'s secure page under PayFast\'s own terms. Akayza never sees or stores your card details.',
        'An order paid digitally is confirmed as soon as PayFast confirms the payment to us; returning from the payment page alone does not confirm it. We email you when the payment is confirmed.',
        'A digital order waits for payment for 24 hours and then lapses. You cannot cancel a digital order yourself; if something is wrong with a paid order, report it from the order and the supplier will refund you if the problem is theirs. If a payment reaches us after the order lapsed, we refund it in full.',
      ],
    },
    {
      heading: '6. Paying cash',
      paragraphs: [
        'Cash is offered only when the supplier takes it, up to R1,000 per order (or the supplier\'s own lower limit), with at most two cash orders waiting at a time. The supplier accepts a cash order before it goes out, and you can cancel a cash order until they do.',
        'When cash is handed over, you and the supplier each confirm the amount in the app. A cash record shows what both of you confirmed; unlike a digital payment, it is not checked by a bank or payment provider. Only confirm cash you have actually handed over or received.',
      ],
    },
    {
      heading: '7. Invoices and receipts',
      paragraphs: [
        'Invoices are the supplier\'s: Akayza issues them in the supplier\'s name on their behalf, as a tax invoice when the supplier is registered for VAT. Your business name, your name, address, email, phone and CIPC number (if you gave one) appear on them, as a proper invoice needs.',
        'Payment receipts are Akayza\'s confirmation that a payment was made. Every invoice and receipt has a QR code that opens a page confirming it is genuine. Do not alter documents; an altered copy will not match that page.',
      ],
    },
    {
      heading: '8. Your business tools',
      paragraphs: [
        'The credit book, jobs and other tools are records you keep for your business. Credit you give your own customers is between you and them: Akayza does not lend money and is not a party to that credit.',
        'Builders: a client sign-off link lets your client confirm a stage and the cash they paid, without an app. Send it only to the real client of that job.',
      ],
    },
    {
      heading: '9. How recommendations work',
      paragraphs: [
        'Supplier suggestions use your location, the categories you buy, how you like to pay, and (as we add it) activity in your own tools, such as what your business uses. This stays private to your account and is never shown to suppliers. Suggestions are not endorsements.',
      ],
    },
    {
      heading: '10. Verification badges',
      paragraphs: [
        'A "Verified" badge means we checked a detail, such as a CIPC registration, against an official source at a point in time. It is not a guarantee of a business\'s quality or conduct.',
      ],
    },
    {
      heading: '11. Your records',
      paragraphs: [
        'The records you create (orders, payments, credit, confirmations) are yours. Records are not edited afterwards; corrections are added as new entries so the history stays honest. You can download your data at any time.',
      ],
    },
    {
      heading: '12. Things you may not do',
      paragraphs: [
        'Do not use Akayza for illegal goods or activity, give false information, place orders you don\'t intend to receive or pay for, try to access another business\'s information, alter or fake invoices, receipts or links, interfere with the app or its security, or confirm payments, deliveries or stages that did not happen.',
      ],
    },
    {
      heading: '13. Suspension and closing your account',
      paragraphs: [
        'We may limit, suspend or close an account that breaks these terms or puts other users at risk (for example repeated orders that are never received or paid), and will tell you why unless the law prevents it. You can close your account at any time from More > Security.',
      ],
    },
    {
      heading: '14. Liability',
      paragraphs: [
        'We work hard to keep Akayza available and accurate, but we provide it "as is". To the extent the law allows, Akayza is not liable for losses caused by suppliers, customers, clients or events outside our control. Nothing in these terms limits rights you have under the Consumer Protection Act where it applies.',
      ],
    },
    {
      heading: '15. Changes and law',
      paragraphs: [
        'If we change these terms in a way that matters, we will show you the new version and ask you to agree again. These terms are governed by the laws of South Africa.',
        'Contact: support@akayza.co.za (placeholder).',
      ],
    },
  ],
};
