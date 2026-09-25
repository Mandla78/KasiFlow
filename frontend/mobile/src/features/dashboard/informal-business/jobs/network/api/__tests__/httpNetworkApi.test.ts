/**
 * The wire -> app mapping for the builder network, fed the exact shapes
 * the server returns (backend builder_network routes), and the requests
 * the app sends.
 */
import { beforeEach, expect, jest, test } from '@jest/globals';

import { httpNetworkApi } from '../httpNetworkApi';

type Call = { method: string; path: string; body?: unknown; opts?: { auth?: boolean; headers?: Record<string, string> } };
const mockCalls: Call[] = [];
let mockReplies: unknown[] = [];
jest.mock('@/shared/api/client', () => ({
  api: async (method: string, path: string, body?: unknown, opts?: Call['opts']) => {
    mockCalls.push({ method, path, body, opts });
    return mockReplies.shift();
  },
  newIdempotencyKey: () => 'key-123',
}));

beforeEach(() => {
  mockCalls.length = 0;
  mockReplies = [];
});

const CARD = {
  id: 'b1', name: 'Thabo Nkosi', initials: 'TN', color: '#0E7490', photo_url: null, trades: ['plumber'], suburb: 'Ivory Park',
  distance_km: 3.1, builds_confirmed: 2, confirmed_stages: 7, cover_url: 'https://res.cloudinary.com/x/image/upload/a.jpg',
  reason: 'Built with Sipho, your partner', relation: 'none', phone: null,
};
const OFFER = { kind: 'fixed', amount_cents: 450000, days: 3, paid_when: 'stage_confirmed' };
const PAYMENT = { id: 'pay1', owner_amount_cents: 450000, partner_amount_cents: null, status: 'waiting', paid_at: '2026-09-26T10:00:00+00:00' };

test('the Builders tab maps cards, with a cover photo and a missing distance', async () => {
  mockReplies = [{ visible: true, travel_km: 20, partners: [], saved: [], nearby: [CARD, { ...CARD, id: 'b2', distance_km: null, cover_url: null }], help_wanted: [], my_posts: [] }];
  const home = await httpNetworkApi.builders({ trade: 'plumber' });
  expect(mockCalls[0]).toMatchObject({ method: 'GET', path: '/builders?trade=plumber', opts: { auth: true } });
  expect(home.travelKm).toBe(20);
  expect(home.nearby[0]).toMatchObject({ name: 'Thabo Nkosi', distanceKm: 3.1, buildsConfirmed: 2, confirmedStages: 7, cover: { uri: CARD.cover_url }, relation: 'none', phone: null });
  expect(Number.isNaN(home.nearby[1]!.distanceKm)).toBe(true);
  expect(home.nearby[1]!.cover).toBeNull();
});

test('a builder profile maps builds and their photos', async () => {
  mockReplies = [
    {
      builder: {
        ...CARD, about: 'Bathrooms', on_akayza_since: '2025-11-01T00:00:00+00:00', worked_with: ['Sipho', 'you'], partners_in_common: ['Sipho Dube'], reasons: ['12 stages confirmed by clients'],
        builds: [{ id: 'j1', title: 'Bathroom extension', suburb: 'Ivory Park', finished_at: '2026-09-13T00:00:00+00:00', stages_confirmed: 4, stages_total: 4, built_with: ['Sipho'], photos: [{ id: 's1', stage_name: 'Bathroom pipes', url: 'https://x/a.jpg', confirmed_at: '2026-09-13T00:00:00+00:00' }] }],
      },
    },
  ];
  const b = await httpNetworkApi.builder('b1');
  expect(mockCalls[0]!.path).toBe('/builders/b1');
  expect(b.workedWith).toEqual(['Sipho', 'you']);
  expect(b.builds[0]).toMatchObject({ title: 'Bathroom extension', stagesConfirmed: 4, stagesTotal: 4, builtWith: ['Sipho'] });
  expect(b.builds[0]!.photos[0]).toMatchObject({ stageName: 'Bathroom pipes', photo: { uri: 'https://x/a.jpg' } });
});

test('an invite sends the offer in snake_case, once', async () => {
  mockReplies = [{ partner: { id: 'p1', job_id: 'j1', builder: CARD, stage_names: ['Final'], trade: 'plumber', starts_on: '2026-09-27', offer: OFFER, status: 'invited', invited_at: '2026-09-26T10:00:00+00:00', payments: [] } }];
  const p = await httpNetworkApi.invite('j1', 'b1', { stageIds: ['s4'], trade: 'plumber', startsOn: '2026-09-27', offer: { kind: 'fixed', amountCents: 450000, days: 3, paidWhen: 'stage_confirmed' } });
  expect(mockCalls[0]).toEqual({
    method: 'POST',
    path: '/me/jobs/j1/partners',
    body: { builder_id: 'b1', stage_ids: ['s4'], trade: 'plumber', starts_on: '2026-09-27', offer: OFFER },
    opts: { auth: true, headers: { 'Idempotency-Key': 'key-123' } },
  });
  expect(p).toMatchObject({ status: 'invited', stageNames: ['Final'], offer: { amountCents: 450000, paidWhen: 'stage_confirmed' } });
});

test("the partner's side: invites, answer and confirming a payment", async () => {
  const INVITE = { id: 'p1', owner: { ...CARD, name: 'Nomsa Dlamini' }, job_title: 'Room extension', suburb: 'Tembisa', stage_names: ['Final'], trade: 'plumber', starts_on: '2026-09-27', offer: OFFER, status: 'accepted', invited_at: '2026-09-26T10:00:00+00:00', payments: [PAYMENT] };
  mockReplies = [{ invites: [INVITE] }, { invite: INVITE }, { invite: { ...INVITE, payments: [{ ...PAYMENT, partner_amount_cents: 450000, status: 'confirmed' }] } }];
  const [inv] = await httpNetworkApi.invites();
  expect(inv).toMatchObject({ jobTitle: 'Room extension', suburb: 'Tembisa', owner: { name: 'Nomsa Dlamini' } });
  expect(inv!.payments[0]).toEqual({ id: 'pay1', ownerAmountCents: 450000, partnerAmountCents: null, status: 'waiting', paidAt: PAYMENT.paid_at });
  await httpNetworkApi.answerInvite('p1', true);
  expect(mockCalls[1]).toMatchObject({ method: 'POST', path: '/me/partner-invites/p1/answer', body: { accept: true } });
  const done = await httpNetworkApi.confirmPayment('p1', 'pay1', 450000);
  expect(mockCalls[2]).toMatchObject({ path: '/me/partner-invites/p1/payments/pay1/confirm', body: { amount_cents: 450000 } });
  expect(done.payments[0]!.status).toBe('confirmed');
});

test('saving, my profile and a help post', async () => {
  mockReplies = [{}, {}, { profile: { trades: ['general_builder'], about: '', travel_km: 20, visible: true, builds: [{ id: 'j1', title: 'Wall', suburb: 'Tembisa', finished_at: 'x', stages_confirmed: 3, stages_total: 3, built_with: [], photos: [], shown: false }] } }];
  await httpNetworkApi.setSaved('b1', true);
  await httpNetworkApi.setSaved('b1', false);
  expect(mockCalls.map((c) => `${c.method} ${c.path}`)).toEqual(['PUT /builders/b1/save', 'DELETE /builders/b1/save']);
  const me = await httpNetworkApi.saveMyProfile({ trades: ['general_builder'], about: '', travelKm: 20, visible: true, shownBuildIds: [] });
  expect(mockCalls[2]!.body).toEqual({ trades: ['general_builder'], about: '', travel_km: 20, visible: true, shown_job_ids: [] });
  expect(me.builds[0]!.shown).toBe(false);

  mockReplies = [{ post: { id: 'h1', job_id: 'j1', job_title: 'Room extension', owner: null, mine: true, trade: 'electrician', what: 'Roof', starts_on: '2026-09-27', suburb: 'Tembisa', distance_km: 0, offer: { ...OFFER, kind: 'per_day', amount_cents: 60000 }, created_at: 'x', expires_at: 'y', status: 'open', my_response: null, responses: [] } }];
  const hp = await httpNetworkApi.createHelpPost('j1', { stageIds: ['s3'], trade: 'electrician', startsOn: '2026-09-27', offer: { kind: 'per_day', amountCents: 60000, days: 3, paidWhen: 'stage_confirmed' }, suburb: 'Tembisa' });
  expect(mockCalls[3]).toMatchObject({ path: '/me/jobs/j1/help-posts', body: { suburb: 'Tembisa', stage_ids: ['s3'] }, opts: { headers: { 'Idempotency-Key': 'key-123' } } });
  expect(hp).toMatchObject({ jobTitle: 'Room extension', mine: true, offer: { kind: 'per_day', amountCents: 60000 } });
});
