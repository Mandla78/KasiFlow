/**
 * MOCK builders around Tembisa, for the builder network before the backend
 * exists. Made-up people and numbers; the photos are free Pexels photos
 * (assets/sample-work/SOURCES.txt), picked without faces. Never used on the
 * real API.
 */
import type { ImageSourcePropType } from 'react-native';

import type { Trade } from '../lib/trades';

export type SampleWork = { file: ImageSourcePropType; stageName: string; jobTitle: string; suburb: string; daysAgo: number };

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
  jobsDone: number;
  joinedDaysAgo: number;
  activeDaysAgo: number;
  /** Who they're connected to ("me" is the signed-in builder). */
  connections: string[];
  work: SampleWork[];
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
    jobsDone: 5,
    joinedDaysAgo: 300,
    activeDaysAgo: 1,
    connections: ['bld-sipho', 'bld-kagiso'],
    work: [
      { file: photos.bathroomPipes, stageName: 'Bathroom pipes', jobTitle: 'Bathroom extension', suburb: 'Ivory Park', daysAgo: 12 },
      { file: photos.pipesUnderSink, stageName: 'Kitchen sink and pipes', jobTitle: 'Kitchen redo', suburb: 'Tembisa', daysAgo: 40 },
      { file: photos.waterPipe, stageName: 'Yard tap line', jobTitle: 'Water to the back rooms', suburb: 'Rabie Ridge', daysAgo: 75 },
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
    jobsDone: 7,
    joinedDaysAgo: 250,
    activeDaysAgo: 3,
    connections: ['me', 'bld-thabo', 'bld-palesa'],
    work: [{ file: photos.brickWall, stageName: 'Walls', jobTitle: 'Two-room extension', suburb: 'Tembisa', daysAgo: 20 }],
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
    jobsDone: 4,
    joinedDaysAgo: 180,
    activeDaysAgo: 6,
    connections: ['bld-sipho'],
    work: [{ file: photos.plugBoxes, stageName: 'Plug points', jobTitle: 'Room extension wiring', suburb: 'Birch Acres', daysAgo: 18 }],
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
    jobsDone: 6,
    joinedDaysAgo: 210,
    activeDaysAgo: 2,
    connections: ['bld-thabo'],
    work: [
      { file: photos.floorTiles, stageName: 'Floor tiles', jobTitle: 'Lounge floor', suburb: 'Rabie Ridge', daysAgo: 9 },
      { file: photos.tileLevelling, stageName: 'Kitchen floor', jobTitle: 'Kitchen redo', suburb: 'Tembisa', daysAgo: 33 },
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
    jobsDone: 9,
    joinedDaysAgo: 400,
    activeDaysAgo: 1,
    connections: [],
    work: [{ file: photos.roofTrusses, stageName: 'Roof trusses', jobTitle: 'Four-room house', suburb: 'Olifantsfontein', daysAgo: 15 }],
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
    jobsDone: 4,
    joinedDaysAgo: 150,
    activeDaysAgo: 10,
    connections: [],
    work: [{ file: photos.steelRoof, stageName: 'Steel frame and roof', jobTitle: 'Carport', suburb: 'Midrand', daysAgo: 25 }],
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
    jobsDone: 1,
    joinedDaysAgo: 20,
    activeDaysAgo: 2,
    connections: [],
    work: [{ file: photos.paving, stageName: 'Paving', jobTitle: 'Driveway', suburb: 'Ebony Park', daysAgo: 6 }],
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
    jobsDone: 0,
    joinedDaysAgo: 8,
    activeDaysAgo: 1,
    connections: [],
    work: [],
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
    jobsDone: 11,
    joinedDaysAgo: 500,
    activeDaysAgo: 4,
    connections: [],
    work: [],
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
    jobsDone: 2,
    joinedDaysAgo: 15,
    activeDaysAgo: 5,
    connections: [],
    work: [],
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
    jobsDone: 2,
    joinedDaysAgo: 60,
    activeDaysAgo: 0,
    connections: ['bld-sipho'],
    work: [],
  },
];

/** "Your" earlier work, as if from a finished job (the mock has no photos of its own). */
export const MY_EARLIER_WORK: SampleWork[] = [
  { file: photos.blockWall, stageName: 'Boundary wall', jobTitle: 'Wall and gate', suburb: 'Tembisa', daysAgo: 45 },
];

/** Other builders' open help posts. */
export const SAMPLE_POSTS: { id: string; ownerId: string; trade: Trade; what: string; startsInDays: number; days: number }[] = [
  { id: 'hp-musa', ownerId: 'bld-musa', trade: 'general_builder', what: 'Walls up before the roof', startsInDays: 3, days: 4 },
  { id: 'hp-kagiso', ownerId: 'bld-kagiso', trade: 'plumber', what: 'Move a shower drain', startsInDays: 1, days: 1 },
  { id: 'hp-refilwe', ownerId: 'bld-refilwe', trade: 'electrician', what: 'Wire a new room', startsInDays: 2, days: 2 },
  { id: 'hp-bongani', ownerId: 'bld-bongani', trade: 'bricklayer', what: 'Brick pillars for a gate', startsInDays: 5, days: 2 },
];

/** Who asked to connect with "me". */
export const SAMPLE_REQUESTS = ['bld-andile'];
