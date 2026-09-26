/**
 * MOCK builders around Tembisa, for the builder network before the backend
 * exists. Made-up people and numbers; the photos are free Pexels photos
 * (assets/sample-work/SOURCES.txt), picked without faces. Never used on the
 * real API.
 */
import type { ImageSourcePropType } from 'react-native';

import type { Offer } from '../types';
import type { Trade } from '../lib/trades';

export type SampleStage = { name: string; photo?: ImageSourcePropType };

export type SampleBuild = {
  title: string;
  suburb: string;
  daysAgo: number;
  /** Every stage was confirmed by the client; only some have photos shown. */
  stages: SampleStage[];
  /** Builder ids of the partners on it ("me" is the signed-in builder). */
  with?: string[];
};

export type SampleBuilder = {
  id: string;
  name: string;
  color: string;
  trades: Trade[];
  suburb: string;
  latitude: number;
  longitude: number;
  travelKm: number;
  about: string;
  phone: string;
  confirmedStages: number;
  buildsConfirmed: number;
  joinedDaysAgo: number;
  activeDaysAgo: number;
  /** Who they've worked a job with. */
  partners: string[];
  builds: SampleBuild[];
};

const photos = {
  pipesUnderSink: require('../../../../../../../assets/sample-work/pipes-under-sink.jpg'),
  bathroomPipes: require('../../../../../../../assets/sample-work/bathroom-pipes.jpg'),
  waterPipe: require('../../../../../../../assets/sample-work/water-pipe-fitting.jpg'),
  brickWall: require('../../../../../../../assets/sample-work/brick-wall.jpg'),
  blockWall: require('../../../../../../../assets/sample-work/block-wall.jpg'),
  plugBoxes: require('../../../../../../../assets/sample-work/plug-boxes.jpg'),
  floorTiles: require('../../../../../../../assets/sample-work/floor-tiles.jpg'),
  tileLevelling: require('../../../../../../../assets/sample-work/tile-levelling.jpg'),
  roofTrusses: require('../../../../../../../assets/sample-work/roof-trusses.jpg'),
  steelRoof: require('../../../../../../../assets/sample-work/steel-roof.jpg'),
  paving: require('../../../../../../../assets/sample-work/paving.jpg'),
} satisfies Record<string, ImageSourcePropType>;

/** Where "me" is when the profile has no location (Tembisa). */
export const HOME = { latitude: -25.9964, longitude: 28.2268 };

export const SAMPLE_BUILDERS: SampleBuilder[] = [
  {
    id: 'bld-thabo',
    name: 'Thabo Nkosi',
    color: '#0E7490',
    trades: ['plumber'],
    suburb: 'Ivory Park',
    latitude: -25.999,
    longitude: 28.196,
    travelKm: 20,
    about: 'Bathrooms, kitchens and geysers. Neat work, on time.',
    phone: '0761234501',
    confirmedStages: 12,
    buildsConfirmed: 5,
    joinedDaysAgo: 300,
    activeDaysAgo: 1,
    partners: ['bld-sipho', 'bld-kagiso'],
    builds: [
      {
        title: 'Bathroom extension',
        suburb: 'Ivory Park',
        daysAgo: 12,
        with: ['bld-sipho'],
        stages: [{ name: 'Drains' }, { name: 'Bathroom pipes', photo: photos.bathroomPipes }, { name: 'Water line', photo: photos.waterPipe }, { name: 'Taps and geyser' }],
      },
      { title: 'Kitchen redo', suburb: 'Tembisa', daysAgo: 40, with: ['bld-kagiso'], stages: [{ name: 'Old pipes out' }, { name: 'Sink and pipes', photo: photos.pipesUnderSink }, { name: 'Final' }] },
    ],
  },
  {
    id: 'bld-sipho',
    name: 'Sipho Dube',
    color: '#7C3AED',
    trades: ['general_builder', 'bricklayer'],
    suburb: 'Tembisa',
    latitude: -25.987,
    longitude: 28.23,
    travelKm: 20,
    about: 'Rooms, boundary walls and extensions.',
    phone: '0831234502',
    confirmedStages: 18,
    buildsConfirmed: 7,
    joinedDaysAgo: 250,
    activeDaysAgo: 3,
    partners: ['me', 'bld-thabo', 'bld-palesa', 'bld-andile'],
    builds: [
      {
        title: 'Two-room extension',
        suburb: 'Tembisa',
        daysAgo: 20,
        with: ['bld-palesa'],
        stages: [{ name: 'Foundation' }, { name: 'Walls', photo: photos.brickWall }, { name: 'Roof' }, { name: 'Plaster and paint' }, { name: 'Final' }],
      },
    ],
  },
  {
    id: 'bld-palesa',
    name: 'Palesa Mahlangu',
    color: '#B45309',
    trades: ['electrician'],
    suburb: 'Kempton Park',
    latitude: -26.091,
    longitude: 28.231,
    travelKm: 30,
    about: 'House wiring, plugs and DB boards. Certificate of compliance.',
    phone: '0721234503',
    confirmedStages: 8,
    buildsConfirmed: 4,
    joinedDaysAgo: 180,
    activeDaysAgo: 6,
    partners: ['bld-sipho'],
    builds: [{ title: 'Room extension wiring', suburb: 'Birch Acres', daysAgo: 18, stages: [{ name: 'Conduits' }, { name: 'Plug points', photo: photos.plugBoxes }, { name: 'DB board' }] }],
  },
  {
    id: 'bld-kagiso',
    name: 'Kagiso Molefe',
    color: '#047857',
    trades: ['tiler'],
    suburb: 'Rabie Ridge',
    latitude: -26.001,
    longitude: 28.17,
    travelKm: 15,
    about: 'Floor and wall tiles, straight lines.',
    phone: '0791234504',
    confirmedStages: 15,
    buildsConfirmed: 6,
    joinedDaysAgo: 210,
    activeDaysAgo: 2,
    partners: ['bld-thabo'],
    builds: [
      { title: 'Lounge floor', suburb: 'Rabie Ridge', daysAgo: 9, stages: [{ name: 'Screed' }, { name: 'Floor tiles', photo: photos.floorTiles }] },
      { title: 'Kitchen redo', suburb: 'Tembisa', daysAgo: 38, with: ['bld-thabo'], stages: [{ name: 'Kitchen floor', photo: photos.tileLevelling }, { name: 'Splashback' }] },
    ],
  },
  {
    id: 'bld-musa',
    name: 'Musa Zulu',
    color: '#1D4ED8',
    trades: ['roofer', 'carpenter'],
    suburb: 'Olifantsfontein',
    latitude: -25.964,
    longitude: 28.235,
    travelKm: 25,
    about: 'Roof trusses, sheeting and tiles.',
    phone: '0741234505',
    confirmedStages: 22,
    buildsConfirmed: 9,
    joinedDaysAgo: 400,
    activeDaysAgo: 1,
    partners: [],
    builds: [{ title: 'Four-room house roof', suburb: 'Olifantsfontein', daysAgo: 15, stages: [{ name: 'Wall plates' }, { name: 'Roof trusses', photo: photos.roofTrusses }, { name: 'Sheeting' }] }],
  },
  {
    id: 'bld-bongani',
    name: 'Bongani Ndlovu',
    color: '#334155',
    trades: ['welder'],
    suburb: 'Midrand',
    latitude: -25.999,
    longitude: 28.127,
    travelKm: 30,
    about: 'Gates, burglar bars and steel carports.',
    phone: '0781234506',
    confirmedStages: 9,
    buildsConfirmed: 4,
    joinedDaysAgo: 150,
    activeDaysAgo: 10,
    partners: [],
    builds: [{ title: 'Carport', suburb: 'Midrand', daysAgo: 25, stages: [{ name: 'Posts' }, { name: 'Steel frame and roof', photo: photos.steelRoof }] }],
  },
  {
    id: 'bld-neo',
    name: 'Neo Sithole',
    color: '#BE185D',
    trades: ['bricklayer'],
    suburb: 'Ebony Park',
    latitude: -26.009,
    longitude: 28.183,
    travelKm: 15,
    about: 'Brick paving and walls.',
    phone: '0711234507',
    confirmedStages: 3,
    buildsConfirmed: 1,
    joinedDaysAgo: 20,
    activeDaysAgo: 2,
    partners: [],
    builds: [{ title: 'Driveway', suburb: 'Ebony Park', daysAgo: 6, stages: [{ name: 'Levelling' }, { name: 'Paving', photo: photos.paving }] }],
  },
  {
    id: 'bld-zanele',
    name: 'Zanele Khumalo',
    color: '#9333EA',
    trades: ['painter'],
    suburb: 'Clayville',
    latitude: -25.98,
    longitude: 28.242,
    travelKm: 15,
    about: 'Inside and outside painting.',
    phone: '0631234508',
    confirmedStages: 0,
    buildsConfirmed: 0,
    joinedDaysAgo: 8,
    activeDaysAgo: 1,
    partners: [],
    builds: [],
  },
  {
    id: 'bld-refilwe',
    name: 'Refilwe Mthembu',
    color: '#0F766E',
    trades: ['general_builder'],
    suburb: 'Kempton Park',
    latitude: -26.095,
    longitude: 28.225,
    travelKm: 30,
    about: 'Houses from foundation to roof.',
    phone: '0821234509',
    confirmedStages: 30,
    buildsConfirmed: 11,
    joinedDaysAgo: 500,
    activeDaysAgo: 4,
    partners: [],
    builds: [],
  },
  {
    id: 'bld-pieter',
    name: 'Pieter van Wyk',
    color: '#A16207',
    trades: ['glazier'],
    suburb: 'Birch Acres',
    latitude: -26.056,
    longitude: 28.211,
    travelKm: 20,
    about: 'Windows, doors and mirrors cut to size.',
    phone: '0841234510',
    confirmedStages: 5,
    buildsConfirmed: 2,
    joinedDaysAgo: 15,
    activeDaysAgo: 5,
    partners: [],
    builds: [],
  },
  {
    id: 'bld-andile',
    name: 'Andile Khoza',
    color: '#C2410C',
    trades: ['electrician'],
    suburb: 'Tembisa',
    latitude: -25.99,
    longitude: 28.221,
    travelKm: 15,
    about: 'Wiring for new rooms and repairs.',
    phone: '0601234511',
    confirmedStages: 4,
    buildsConfirmed: 2,
    joinedDaysAgo: 60,
    activeDaysAgo: 0,
    partners: ['bld-sipho'],
    builds: [],
  },
];

/** "Your" earlier build, as if from a finished job (the mock's jobs have no photos of their own). */
export const MY_EARLIER_BUILDS: SampleBuild[] = [
  { title: 'Wall and gate', suburb: 'Tembisa', daysAgo: 45, with: ['bld-sipho'], stages: [{ name: 'Footings' }, { name: 'Boundary wall', photo: photos.blockWall }, { name: 'Gate posts' }] },
];

/** Other builders' open help posts, each with its pay. */
export const SAMPLE_POSTS: { id: string; ownerId: string; trade: Trade; what: string; startsInDays: number; offer: Offer }[] = [
  { id: 'hp-musa', ownerId: 'bld-musa', trade: 'general_builder', what: 'Walls up before the roof', startsInDays: 3, offer: { kind: 'fixed', amountCents: 600_000, days: 4, paidWhen: 'end' } },
  { id: 'hp-kagiso', ownerId: 'bld-kagiso', trade: 'plumber', what: 'Move a shower drain', startsInDays: 1, offer: { kind: 'per_day', amountCents: 70_000, days: 1, paidWhen: 'daily' } },
  { id: 'hp-refilwe', ownerId: 'bld-refilwe', trade: 'electrician', what: 'Wire a new room', startsInDays: 2, offer: { kind: 'fixed', amountCents: 280_000, days: 2, paidWhen: 'stage_confirmed' } },
  { id: 'hp-bongani', ownerId: 'bld-bongani', trade: 'bricklayer', what: 'Brick pillars for a gate', startsInDays: 5, offer: { kind: 'per_day', amountCents: 55_000, days: 2, paidWhen: 'daily' } },
];

/** Sipho invites "me" onto his job. */
export const SAMPLE_INVITE = {
  id: 'inv-sipho',
  ownerId: 'bld-sipho',
  jobTitle: 'Boundary wall and gate',
  suburb: 'Clayville',
  stageNames: ['Foundation', 'Walls'],
  trade: 'general_builder' as Trade,
  startsInDays: 2,
  offer: { kind: 'fixed', amountCents: 350_000, days: 4, paidWhen: 'stage_confirmed' } as Offer,
};
