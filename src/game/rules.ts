import { officialBuildingData } from './buildingData'

export const RESOURCE_KEYS = ['wood', 'clay', 'iron', 'crop'] as const

export type ResourceKey = (typeof RESOURCE_KEYS)[number]
export type Tribe = 'romans' | 'teutons' | 'gauls'
export type TrainingBuilding = 'barracks' | 'stable' | 'workshop' | 'residence' | 'rally'
export type CommandType = 'raid' | 'attack' | 'conquer' | 'settle' | 'shipment'
export type UnitRole = 'infantry' | 'cavalry' | 'scout' | 'siege' | 'civilian'

export interface ResourceStock {
  wood: number
  clay: number
  iron: number
  crop: number
}

export interface UnitDefinition {
  id: string
  tribe: Tribe
  name: string
  role: UnitRole
  trainingBuilding: TrainingBuilding
  academyLevel: number
  minimumBuildingLevel: number
  attack: number
  infantryDefense: number
  cavalryDefense: number
  speed: number
  carry: number
  upkeep: number
  trainingTime: number
  cost: ResourceStock
}

export interface BuildingMetadata {
  gid: number
  key: string
  name: string
  kind: 'field' | 'center'
  unique: boolean
  tribe?: Tribe
  trainingBuilding?: TrainingBuilding
}

export type OfficialBuilding = (typeof officialBuildingData)[number]

const buildingList = officialBuildingData as unknown as OfficialBuilding[]

export const officialBuildingById = Object.fromEntries(
  buildingList.map((entry) => [entry.gid, entry]),
) as Record<number, OfficialBuilding>

export const BUILDING_METADATA: Record<number, BuildingMetadata> = {
  1: { gid: 1, key: 'woodcutter', name: 'Woodcutter', kind: 'field', unique: false },
  2: { gid: 2, key: 'clayPit', name: 'Clay Pit', kind: 'field', unique: false },
  3: { gid: 3, key: 'ironMine', name: 'Iron Mine', kind: 'field', unique: false },
  4: { gid: 4, key: 'cropland', name: 'Cropland', kind: 'field', unique: false },
  10: { gid: 10, key: 'warehouse', name: 'Warehouse', kind: 'center', unique: true },
  11: { gid: 11, key: 'granary', name: 'Granary', kind: 'center', unique: true },
  15: { gid: 15, key: 'mainBuilding', name: 'Main Building', kind: 'center', unique: true },
  16: {
    gid: 16,
    key: 'rallyPoint',
    name: 'Rally Point',
    kind: 'center',
    unique: true,
    trainingBuilding: 'rally',
  },
  17: { gid: 17, key: 'marketplace', name: 'Marketplace', kind: 'center', unique: true },
  19: {
    gid: 19,
    key: 'barracks',
    name: 'Barracks',
    kind: 'center',
    unique: true,
    trainingBuilding: 'barracks',
  },
  20: {
    gid: 20,
    key: 'stable',
    name: 'Stable',
    kind: 'center',
    unique: true,
    trainingBuilding: 'stable',
  },
  21: {
    gid: 21,
    key: 'workshop',
    name: 'Workshop',
    kind: 'center',
    unique: true,
    trainingBuilding: 'workshop',
  },
  22: { gid: 22, key: 'academy', name: 'Academy', kind: 'center', unique: true },
  23: { gid: 23, key: 'cranny', name: 'Cranny', kind: 'center', unique: false },
  25: {
    gid: 25,
    key: 'residence',
    name: 'Residence',
    kind: 'center',
    unique: true,
    trainingBuilding: 'residence',
  },
  26: { gid: 26, key: 'palace', name: 'Palace', kind: 'center', unique: true },
  31: { gid: 31, key: 'cityWall', name: 'City Wall', kind: 'center', unique: true, tribe: 'romans' },
  32: { gid: 32, key: 'earthWall', name: 'Earth Wall', kind: 'center', unique: true, tribe: 'teutons' },
  33: { gid: 33, key: 'palisade', name: 'Palisade', kind: 'center', unique: true, tribe: 'gauls' },
  41: {
    gid: 41,
    key: 'horseDrinkingPool',
    name: 'Horse Drinking Pool',
    kind: 'center',
    unique: true,
    tribe: 'romans',
  },
}

export const WALL_BY_TRIBE: Record<Tribe, number> = {
  romans: 31,
  teutons: 32,
  gauls: 33,
}

export const CULTURE_POINT_REQUIREMENTS_X1 = [
  0, 2000, 8000, 20000, 39000, 65000, 99000, 141000, 191000, 251000,
] as const

export const SETTLEMENT_COST: ResourceStock = {
  wood: 750,
  clay: 750,
  iron: 750,
  crop: 750,
}

export const FIELD_OUTPUT_BY_LEVEL = [
  2, 7, 13, 21, 31, 46, 70, 98, 140, 203, 280, 392, 525, 693, 889, 1120, 1400,
  1820, 2240, 2800, 3430, 4270, 5250, 6440, 7910, 9730,
] as const

export const HUMAN_VILLAGE_NAME = 'Capital'

function stock(wood: number, clay: number, iron: number, crop: number): ResourceStock {
  return { wood, clay, iron, crop }
}

export const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
  legionnaire: {
    id: 'legionnaire',
    tribe: 'romans',
    name: 'Legionnaire',
    role: 'infantry',
    trainingBuilding: 'barracks',
    academyLevel: 0,
    minimumBuildingLevel: 1,
    attack: 40,
    infantryDefense: 35,
    cavalryDefense: 50,
    speed: 6,
    carry: 50,
    upkeep: 1,
    trainingTime: 1600,
    cost: stock(120, 100, 150, 30),
  },
  praetorian: {
    id: 'praetorian',
    tribe: 'romans',
    name: 'Praetorian',
    role: 'infantry',
    trainingBuilding: 'barracks',
    academyLevel: 1,
    minimumBuildingLevel: 1,
    attack: 30,
    infantryDefense: 65,
    cavalryDefense: 35,
    speed: 5,
    carry: 20,
    upkeep: 1,
    trainingTime: 1760,
    cost: stock(100, 130, 160, 70),
  },
  imperian: {
    id: 'imperian',
    tribe: 'romans',
    name: 'Imperian',
    role: 'infantry',
    trainingBuilding: 'barracks',
    academyLevel: 5,
    minimumBuildingLevel: 1,
    attack: 70,
    infantryDefense: 40,
    cavalryDefense: 25,
    speed: 7,
    carry: 50,
    upkeep: 1,
    trainingTime: 1920,
    cost: stock(150, 160, 210, 80),
  },
  equitesLegati: {
    id: 'equitesLegati',
    tribe: 'romans',
    name: 'Equites Legati',
    role: 'scout',
    trainingBuilding: 'stable',
    academyLevel: 5,
    minimumBuildingLevel: 1,
    attack: 0,
    infantryDefense: 20,
    cavalryDefense: 10,
    speed: 16,
    carry: 0,
    upkeep: 2,
    trainingTime: 1360,
    cost: stock(140, 160, 20, 40),
  },
  equitesImperatoris: {
    id: 'equitesImperatoris',
    tribe: 'romans',
    name: 'Equites Imperatoris',
    role: 'cavalry',
    trainingBuilding: 'stable',
    academyLevel: 5,
    minimumBuildingLevel: 5,
    attack: 120,
    infantryDefense: 65,
    cavalryDefense: 50,
    speed: 14,
    carry: 100,
    upkeep: 3,
    trainingTime: 2640,
    cost: stock(550, 440, 320, 100),
  },
  equitesCaesaris: {
    id: 'equitesCaesaris',
    tribe: 'romans',
    name: 'Equites Caesaris',
    role: 'cavalry',
    trainingBuilding: 'stable',
    academyLevel: 15,
    minimumBuildingLevel: 10,
    attack: 180,
    infantryDefense: 80,
    cavalryDefense: 105,
    speed: 10,
    carry: 70,
    upkeep: 4,
    trainingTime: 3520,
    cost: stock(550, 640, 800, 180),
  },
  batteringRam: {
    id: 'batteringRam',
    tribe: 'romans',
    name: 'Battering Ram',
    role: 'siege',
    trainingBuilding: 'workshop',
    academyLevel: 10,
    minimumBuildingLevel: 1,
    attack: 60,
    infantryDefense: 30,
    cavalryDefense: 75,
    speed: 4,
    carry: 0,
    upkeep: 3,
    trainingTime: 4600,
    cost: stock(900, 360, 500, 70),
  },
  fireCatapult: {
    id: 'fireCatapult',
    tribe: 'romans',
    name: 'Fire Catapult',
    role: 'siege',
    trainingBuilding: 'workshop',
    academyLevel: 15,
    minimumBuildingLevel: 10,
    attack: 75,
    infantryDefense: 60,
    cavalryDefense: 10,
    speed: 3,
    carry: 0,
    upkeep: 6,
    trainingTime: 9000,
    cost: stock(950, 1350, 600, 90),
  },
  senator: {
    id: 'senator',
    tribe: 'romans',
    name: 'Senator',
    role: 'civilian',
    trainingBuilding: 'residence',
    academyLevel: 20,
    minimumBuildingLevel: 10,
    attack: 50,
    infantryDefense: 40,
    cavalryDefense: 30,
    speed: 4,
    carry: 0,
    upkeep: 5,
    trainingTime: 90700,
    cost: stock(30750, 27200, 45000, 37500),
  },
  romanSettler: {
    id: 'romanSettler',
    tribe: 'romans',
    name: 'Settler',
    role: 'civilian',
    trainingBuilding: 'residence',
    academyLevel: 0,
    minimumBuildingLevel: 10,
    attack: 0,
    infantryDefense: 80,
    cavalryDefense: 80,
    speed: 5,
    carry: 3000,
    upkeep: 1,
    trainingTime: 26900,
    cost: stock(4600, 4200, 5800, 4400),
  },
  clubswinger: {
    id: 'clubswinger',
    tribe: 'teutons',
    name: 'Clubswinger',
    role: 'infantry',
    trainingBuilding: 'barracks',
    academyLevel: 0,
    minimumBuildingLevel: 1,
    attack: 40,
    infantryDefense: 20,
    cavalryDefense: 5,
    speed: 7,
    carry: 60,
    upkeep: 1,
    trainingTime: 720,
    cost: stock(95, 75, 40, 40),
  },
  spearman: {
    id: 'spearman',
    tribe: 'teutons',
    name: 'Spearman',
    role: 'infantry',
    trainingBuilding: 'barracks',
    academyLevel: 1,
    minimumBuildingLevel: 3,
    attack: 10,
    infantryDefense: 35,
    cavalryDefense: 60,
    speed: 7,
    carry: 40,
    upkeep: 1,
    trainingTime: 1120,
    cost: stock(145, 70, 85, 40),
  },
  axeman: {
    id: 'axeman',
    tribe: 'teutons',
    name: 'Axeman',
    role: 'infantry',
    trainingBuilding: 'barracks',
    academyLevel: 3,
    minimumBuildingLevel: 1,
    attack: 60,
    infantryDefense: 30,
    cavalryDefense: 30,
    speed: 6,
    carry: 50,
    upkeep: 1,
    trainingTime: 1200,
    cost: stock(130, 120, 170, 70),
  },
  scout: {
    id: 'scout',
    tribe: 'teutons',
    name: 'Scout',
    role: 'scout',
    trainingBuilding: 'barracks',
    academyLevel: 1,
    minimumBuildingLevel: 5,
    attack: 0,
    infantryDefense: 10,
    cavalryDefense: 5,
    speed: 9,
    carry: 0,
    upkeep: 1,
    trainingTime: 1120,
    cost: stock(160, 100, 50, 50),
  },
  paladin: {
    id: 'paladin',
    tribe: 'teutons',
    name: 'Paladin',
    role: 'cavalry',
    trainingBuilding: 'stable',
    academyLevel: 5,
    minimumBuildingLevel: 3,
    attack: 55,
    infantryDefense: 100,
    cavalryDefense: 40,
    speed: 10,
    carry: 110,
    upkeep: 2,
    trainingTime: 2400,
    cost: stock(370, 270, 290, 75),
  },
  teutonicKnight: {
    id: 'teutonicKnight',
    tribe: 'teutons',
    name: 'Teutonic Knight',
    role: 'cavalry',
    trainingBuilding: 'stable',
    academyLevel: 15,
    minimumBuildingLevel: 10,
    attack: 150,
    infantryDefense: 50,
    cavalryDefense: 75,
    speed: 9,
    carry: 80,
    upkeep: 3,
    trainingTime: 2960,
    cost: stock(450, 515, 480, 80),
  },
  teutonRam: {
    id: 'teutonRam',
    tribe: 'teutons',
    name: 'Ram',
    role: 'siege',
    trainingBuilding: 'workshop',
    academyLevel: 10,
    minimumBuildingLevel: 1,
    attack: 50,
    infantryDefense: 30,
    cavalryDefense: 80,
    speed: 4,
    carry: 0,
    upkeep: 3,
    trainingTime: 4200,
    cost: stock(1000, 300, 350, 70),
  },
  catapult: {
    id: 'catapult',
    tribe: 'teutons',
    name: 'Catapult',
    role: 'siege',
    trainingBuilding: 'workshop',
    academyLevel: 15,
    minimumBuildingLevel: 10,
    attack: 65,
    infantryDefense: 60,
    cavalryDefense: 10,
    speed: 3,
    carry: 0,
    upkeep: 6,
    trainingTime: 9000,
    cost: stock(900, 1200, 600, 60),
  },
  chief: {
    id: 'chief',
    tribe: 'teutons',
    name: 'Chief',
    role: 'civilian',
    trainingBuilding: 'residence',
    academyLevel: 20,
    minimumBuildingLevel: 10,
    attack: 40,
    infantryDefense: 60,
    cavalryDefense: 40,
    speed: 4,
    carry: 0,
    upkeep: 4,
    trainingTime: 70500,
    cost: stock(35500, 26600, 25000, 27200),
  },
  teutonSettler: {
    id: 'teutonSettler',
    tribe: 'teutons',
    name: 'Settler',
    role: 'civilian',
    trainingBuilding: 'residence',
    academyLevel: 0,
    minimumBuildingLevel: 10,
    attack: 0,
    infantryDefense: 80,
    cavalryDefense: 80,
    speed: 5,
    carry: 3000,
    upkeep: 1,
    trainingTime: 31000,
    cost: stock(5800, 4400, 4600, 5200),
  },
  phalanx: {
    id: 'phalanx',
    tribe: 'gauls',
    name: 'Phalanx',
    role: 'infantry',
    trainingBuilding: 'barracks',
    academyLevel: 0,
    minimumBuildingLevel: 1,
    attack: 15,
    infantryDefense: 40,
    cavalryDefense: 50,
    speed: 7,
    carry: 35,
    upkeep: 1,
    trainingTime: 1040,
    cost: stock(100, 130, 55, 30),
  },
  swordsman: {
    id: 'swordsman',
    tribe: 'gauls',
    name: 'Swordsman',
    role: 'infantry',
    trainingBuilding: 'barracks',
    academyLevel: 3,
    minimumBuildingLevel: 1,
    attack: 65,
    infantryDefense: 35,
    cavalryDefense: 20,
    speed: 6,
    carry: 45,
    upkeep: 1,
    trainingTime: 1440,
    cost: stock(140, 150, 185, 60),
  },
  pathfinder: {
    id: 'pathfinder',
    tribe: 'gauls',
    name: 'Pathfinder',
    role: 'scout',
    trainingBuilding: 'stable',
    academyLevel: 5,
    minimumBuildingLevel: 1,
    attack: 0,
    infantryDefense: 20,
    cavalryDefense: 10,
    speed: 17,
    carry: 0,
    upkeep: 2,
    trainingTime: 1360,
    cost: stock(170, 150, 20, 40),
  },
  theutatesThunder: {
    id: 'theutatesThunder',
    tribe: 'gauls',
    name: 'Theutates Thunder',
    role: 'cavalry',
    trainingBuilding: 'stable',
    academyLevel: 5,
    minimumBuildingLevel: 3,
    attack: 90,
    infantryDefense: 25,
    cavalryDefense: 40,
    speed: 19,
    carry: 75,
    upkeep: 2,
    trainingTime: 2480,
    cost: stock(350, 450, 230, 60),
  },
  druidrider: {
    id: 'druidrider',
    tribe: 'gauls',
    name: 'Druidrider',
    role: 'cavalry',
    trainingBuilding: 'stable',
    academyLevel: 5,
    minimumBuildingLevel: 5,
    attack: 45,
    infantryDefense: 115,
    cavalryDefense: 55,
    speed: 16,
    carry: 35,
    upkeep: 2,
    trainingTime: 2560,
    cost: stock(360, 330, 280, 120),
  },
  haeduan: {
    id: 'haeduan',
    tribe: 'gauls',
    name: 'Haeduan',
    role: 'cavalry',
    trainingBuilding: 'stable',
    academyLevel: 15,
    minimumBuildingLevel: 10,
    attack: 140,
    infantryDefense: 50,
    cavalryDefense: 165,
    speed: 13,
    carry: 65,
    upkeep: 3,
    trainingTime: 3120,
    cost: stock(500, 620, 675, 170),
  },
  gaulRam: {
    id: 'gaulRam',
    tribe: 'gauls',
    name: 'Ram',
    role: 'siege',
    trainingBuilding: 'workshop',
    academyLevel: 10,
    minimumBuildingLevel: 1,
    attack: 50,
    infantryDefense: 30,
    cavalryDefense: 105,
    speed: 4,
    carry: 0,
    upkeep: 3,
    trainingTime: 5000,
    cost: stock(950, 555, 330, 75),
  },
  trebuchet: {
    id: 'trebuchet',
    tribe: 'gauls',
    name: 'Trebuchet',
    role: 'siege',
    trainingBuilding: 'workshop',
    academyLevel: 15,
    minimumBuildingLevel: 10,
    attack: 70,
    infantryDefense: 45,
    cavalryDefense: 10,
    speed: 3,
    carry: 0,
    upkeep: 6,
    trainingTime: 9000,
    cost: stock(960, 1450, 630, 90),
  },
  chieftain: {
    id: 'chieftain',
    tribe: 'gauls',
    name: 'Chieftain',
    role: 'civilian',
    trainingBuilding: 'residence',
    academyLevel: 20,
    minimumBuildingLevel: 10,
    attack: 40,
    infantryDefense: 50,
    cavalryDefense: 50,
    speed: 5,
    carry: 0,
    upkeep: 4,
    trainingTime: 90700,
    cost: stock(30750, 45400, 31000, 37500),
  },
  gaulSettler: {
    id: 'gaulSettler',
    tribe: 'gauls',
    name: 'Settler',
    role: 'civilian',
    trainingBuilding: 'residence',
    academyLevel: 0,
    minimumBuildingLevel: 10,
    attack: 0,
    infantryDefense: 80,
    cavalryDefense: 80,
    speed: 5,
    carry: 3000,
    upkeep: 1,
    trainingTime: 22700,
    cost: stock(4400, 5600, 4200, 3900),
  },
}

export const UNITS_BY_TRIBE: Record<Tribe, string[]> = {
  romans: [
    'legionnaire',
    'praetorian',
    'imperian',
    'equitesLegati',
    'equitesImperatoris',
    'equitesCaesaris',
    'batteringRam',
    'fireCatapult',
    'senator',
    'romanSettler',
  ],
  teutons: [
    'clubswinger',
    'spearman',
    'axeman',
    'scout',
    'paladin',
    'teutonicKnight',
    'teutonRam',
    'catapult',
    'chief',
    'teutonSettler',
  ],
  gauls: [
    'phalanx',
    'swordsman',
    'pathfinder',
    'theutatesThunder',
    'druidrider',
    'haeduan',
    'gaulRam',
    'trebuchet',
    'chieftain',
    'gaulSettler',
  ],
}

export const PRIMARY_OFFENSE_UNIT: Record<Tribe, string> = {
  romans: 'imperian',
  teutons: 'clubswinger',
  gauls: 'theutatesThunder',
}

export const PRIMARY_DEFENSE_UNIT: Record<Tribe, string> = {
  romans: 'praetorian',
  teutons: 'spearman',
  gauls: 'phalanx',
}

export const SCOUT_UNIT_BY_TRIBE: Record<Tribe, string> = {
  romans: 'equitesLegati',
  teutons: 'scout',
  gauls: 'pathfinder',
}

export const SETTLER_BY_TRIBE: Record<Tribe, string> = {
  romans: 'romanSettler',
  teutons: 'teutonSettler',
  gauls: 'gaulSettler',
}

export const COMMANDER_BY_TRIBE: Record<Tribe, string> = {
  romans: 'senator',
  teutons: 'chief',
  gauls: 'chieftain',
}

export const LOYALTY_REDUCTION_BY_TRIBE: Record<Tribe, { min: number; max: number }> = {
  romans: { min: 20, max: 30 },
  teutons: { min: 20, max: 25 },
  gauls: { min: 20, max: 25 },
}

export const MERCHANT_CAPACITY_BY_TRIBE: Record<Tribe, number> = {
  romans: 500,
  teutons: 1000,
  gauls: 750,
}

export const MERCHANT_SPEED_BY_TRIBE: Record<Tribe, number> = {
  romans: 16,
  teutons: 12,
  gauls: 24,
}

export const TRIBE_LABEL: Record<Tribe, string> = {
  romans: 'Romans',
  teutons: 'Teutons',
  gauls: 'Gauls',
}

export const TRIBE_TRAITS: Record<
  Tribe,
  { buildQueues: { field: number; center: number; shared: number }; wallBonusPerLevel: number }
> = {
  romans: { buildQueues: { field: 1, center: 1, shared: 0 }, wallBonusPerLevel: 0.03 },
  teutons: { buildQueues: { field: 0, center: 0, shared: 1 }, wallBonusPerLevel: 0.02 },
  gauls: { buildQueues: { field: 0, center: 0, shared: 1 }, wallBonusPerLevel: 0.025 },
}

export const BUILDABLE_CENTER_BUILDINGS = [
  10, 11, 15, 16, 17, 19, 20, 21, 22, 23, 25, 26, 31, 32, 33, 41,
] as const

export const RESOURCE_PATTERN_LABELS = ['4-4-4-6', '3-4-5-6', '3-5-4-6', '1-1-1-15'] as const

export const RESOURCE_PATTERNS = [
  { label: '4-4-4-6', distribution: [4, 4, 4, 6] },
  { label: '3-4-5-6', distribution: [3, 4, 5, 6] },
  { label: '3-5-4-6', distribution: [3, 5, 4, 6] },
  { label: '1-1-1-15', distribution: [1, 1, 1, 15] },
] as const

export function emptyStock(): ResourceStock {
  return stock(0, 0, 0, 0)
}

export function addStock(a: ResourceStock, b: ResourceStock): ResourceStock {
  return stock(a.wood + b.wood, a.clay + b.clay, a.iron + b.iron, a.crop + b.crop)
}

export function subtractStock(a: ResourceStock, b: ResourceStock): ResourceStock {
  return stock(a.wood - b.wood, a.clay - b.clay, a.iron - b.iron, a.crop - b.crop)
}

export function multiplyStock(a: ResourceStock, scalar: number): ResourceStock {
  return stock(a.wood * scalar, a.clay * scalar, a.iron * scalar, a.crop * scalar)
}

export function canAfford(resources: ResourceStock, cost: ResourceStock): boolean {
  return RESOURCE_KEYS.every((key) => resources[key] >= cost[key])
}

export function clampStock(resources: ResourceStock, caps: ResourceStock): ResourceStock {
  return stock(
    Math.max(0, Math.min(resources.wood, caps.wood)),
    Math.max(0, Math.min(resources.clay, caps.clay)),
    Math.max(0, Math.min(resources.iron, caps.iron)),
    Math.max(0, Math.min(resources.crop, caps.crop)),
  )
}

export function sumUnitAttack(units: Record<string, number>): number {
  return Object.entries(units).reduce((total, [unitId, count]) => {
    const unit = UNIT_DEFINITIONS[unitId]
    return total + unit.attack * count
  }, 0)
}

export function sumUnitCarrying(units: Record<string, number>): number {
  return Object.entries(units).reduce((total, [unitId, count]) => {
    const unit = UNIT_DEFINITIONS[unitId]
    return total + unit.carry * count
  }, 0)
}

export function getVillageRequirementForIndex(index: number): number {
  return CULTURE_POINT_REQUIREMENTS_X1[index] ?? CULTURE_POINT_REQUIREMENTS_X1[CULTURE_POINT_REQUIREMENTS_X1.length - 1]
}
