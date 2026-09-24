import { LegalDocument } from './types';

/**
 * Privacy Policy, written for POPIA (Protection of Personal Information
 * Act 4 of 2013). Every item here must match what the app and backend
 * actually do; when a feature starts collecting something new, this
 * changes first and the version goes up.
 */
export const PRIVACY_POLICY: LegalDocument = {
  version: '0.1-draft',
  title: 'Privacy Policy',
  effectiveDate: '24 September 2026',
  draftNotice: 'Draft for review. This policy must be checked by a legal professional before Akayza launches to the public.',
  sections: [
    {
      heading: '1. Who we are',
      paragraphs: [
        'Akayza helps small businesses such as builders, trades and spaza shops keep their business records and buy from suppliers. In this policy "Akayza", "we" and "us" means the operator of the Akayza app, who is the responsible party for your personal information under POPIA.',
        'Information officer: to be appointed before launch. Contact: privacy@akayza.co.za (placeholder).',
      ],
    },
    {
      heading: '2. What we collect, and why',
      paragraphs: [
        'Account: your email address and a password (stored only as a one-way hash, never readable by us). Why: to create your account and let you sign in. If you continue with Google, we receive your name, email and profile photo from Google, never your Google password.',
        'Your business: trading name, business type and trade, your name, how long you have been trading, and optionally a cellphone number. Why: to set up the right tools and to show suppliers who you are. Your cellphone is only used for delivery calls and receipts, never to sign in or for marketing.',
        'Registration (optional): whether you are a sole trader or a registered company, and a CIPC registration number. Why: to check the company on the official CIPC register and show suppliers a verified badge. You can skip this.',
        'Location: the address you enter, and the pin you place on the map. Why: to find suppliers who deliver to you and to get deliveries to the right place. We only use your phone\'s location when you tap "Use my location".',
        'Buying preferences: the product categories you buy, whether you want delivery or collection, and how often you restock. Why: to recommend suppliers who fit what you need.',
        'Activity: orders, payments, credit you record, and confirmations you make. Why: this is the record the app keeps for you.',
        'Device: a security key created on your phone (we only receive its public part), and basic device and log information. Why: to prove that confirmations came from your phone and to keep your account safe.',
      ],
    },
    {
      heading: '3. What we do not collect',
      paragraphs: [
        'We do not ask for your ID number, passport, asylum or refugee permit, or citizenship. We do not need them to provide the service.',
        'We do not sell your personal information, and we do not use it for advertising.',
      ],
    },
    {
      heading: '4. Who we share it with',
      paragraphs: [
        'Suppliers: your business name, area, delivery address and the details of orders you place with them. Suppliers never see your credit book or your customers.',
        'Service providers who process information for us under contract: PayFast (payments), Mapbox (maps and address search), Cloudinary (document and photo storage, with malware scanning), our email provider, and our hosting provider.',
        'CIPC: if you give a CIPC registration number, we check it against the CIPC register.',
        'The law: when we are legally required to.',
        'Some of these providers store information outside South Africa. We only use providers bound by laws or agreements that protect your information to a standard similar to POPIA (section 72).',
      ],
    },
    {
      heading: '5. Your customers\' information',
      paragraphs: [
        'If you record credit for a customer, you decide what to record about them. Customer names stay private to you and never appear on anything you share. Please only record what you need.',
      ],
    },
    {
      heading: '6. How long we keep it',
      paragraphs: [
        'We keep your information while your account is open. When you delete your account, we delete or anonymise your personal information, except records we must keep by law (for example payment records for tax purposes, generally five years).',
      ],
    },
    {
      heading: '7. How we protect it',
      paragraphs: [
        'Passwords are hashed, connections are encrypted, and every request is checked so that you can only see your own business\'s information. Uploaded documents are scanned for malware. Access by our staff is limited and logged.',
        'If a breach puts your information at risk, we will tell you and the Information Regulator as POPIA requires.',
      ],
    },
    {
      heading: '8. Your rights',
      paragraphs: [
        'You can ask to see the information we hold about you, correct it, delete it, or object to how we use it. You can download your data and delete your account from More > Security in the app.',
        'If you are unhappy with how we handle your information, you can complain to the Information Regulator (South Africa): inforegulator.org.za.',
      ],
    },
    {
      heading: '9. Age',
      paragraphs: ['Akayza is for people aged 18 and over who run a business.'],
    },
    {
      heading: '10. Changes',
      paragraphs: [
        'If we change this policy in a way that matters, we will show you the new version in the app and ask you to agree again before you continue.',
      ],
    },
  ],
};
