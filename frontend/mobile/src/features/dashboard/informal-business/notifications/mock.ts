/**
 * Sample data for notifications, shaped like the UX design. Replaced when the
 * backend endpoint lands. All money in cents.
 */

export const notifications = [
  { id: 'n1', icon: 'truck', title: 'Your stock is on its way', body: 'Sipho from Mahlangu Wholesale is delivering KF-1042. Have R2,340 cash ready.', when: '10 min ago', unread: true, group: 'Today' },
  { id: 'n2', icon: 'check-circle', title: 'Payment received by Dlamini Drinks', body: 'R1,180 paid in the app for KF-1038.', when: '1 h ago', unread: true, group: 'Today' },
  { id: 'n3', icon: 'book', title: 'Thandi pays today', body: 'R48 · bread, milk. Send a friendly reminder?', when: '8:00', unread: false, group: 'Today' },
  { id: 'n4', icon: 'eye', title: 'Your record was viewed', body: 'Mkhize Wholesalers opened your shared record.', when: 'Yesterday', unread: false, group: 'Earlier' },
] as const;
