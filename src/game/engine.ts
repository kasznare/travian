import {
  BUILDABLE_CENTER_BUILDINGS,
  BUILDING_METADATA,
  COMMANDER_BY_TRIBE,
  FIELD_OUTPUT_BY_LEVEL,
  HUMAN_VILLAGE_NAME,
  LOYALTY_REDUCTION_BY_TRIBE,
  MERCHANT_CAPACITY_BY_TRIBE,
  MERCHANT_SPEED_BY_TRIBE,
  PRIMARY_DEFENSE_UNIT,
  PRIMARY_OFFENSE_UNIT,
  RESOURCE_KEYS,
  RESOURCE_PATTERNS,
  SCOUT_UNIT_BY_TRIBE,
  SETTLEMENT_COST,
  SETTLER_BY_TRIBE,
  TRIBE_LABEL,
  TRIBE_TRAITS,
  type CommandType,
  type ResourceStock,
  type Tribe,
  type UnitDefinition,
  UNIT_DEFINITIONS,
  UNITS_BY_TRIBE,
  WALL_BY_TRIBE,
  addStock,
  canAfford,
  clampStock,
  emptyStock,
  getVillageRequirementForIndex,
  officialBuildingById,
  subtractStock,
  sumUnitAttack,
  sumUnitCarrying,
} from './rules'

export interface GameConfig {
  playerName: string
  tribe: Tribe
  aiCount: number
  seed: number
}

export interface Tile {
  id: string
  x: number
  y: number
  patternIndex: number
  villageId: string | null
}

export interface FieldSlot {
  id: string
  gid: 1 | 2 | 3 | 4
  level: number
}

export interface CenterSlot {
  id: string
  buildingGid: number | null
  level: number
}

export interface BuildOrder {
  id: string
  queueType: 'field' | 'center' | 'shared'
  targetSlotId: string
  buildingGid: number
  targetLevel: number
  startedAt: number
  completeAt: number
}

export interface TrainingOrder {
  id: string
  unitId: string
  quantity: number
  startedAt: number
  completeAt: number
}

export interface Village {
  id: string
  ownerId: string
  name: string
  tribe: Tribe
  tileId: string
  x: number
  y: number
  isCapital: boolean
  loyalty: number
  expansionSlotsUsed: number
  patternIndex: number
  resources: ResourceStock
  fieldSlots: FieldSlot[]
  centerSlots: CenterSlot[]
  units: Record<string, number>
  buildQueues: {
    field: BuildOrder | null
    center: BuildOrder | null
    shared: BuildOrder | null
  }
  trainingQueues: {
    barracks: TrainingOrder | null
    stable: TrainingOrder | null
    workshop: TrainingOrder | null
    residence: TrainingOrder | null
    rally: TrainingOrder | null
  }
}

export interface Personality {
  doctrine: 'builder' | 'raider' | 'settler' | 'turtle'
  aggression: number
  expansion: number
  economy: number
  caution: number
}

export interface Player {
  id: string
  name: string
  tribe: Tribe
  isHuman: boolean
  villageIds: string[]
  culturePoints: number
  nextAiPlanAt: number
  personality: Personality | null
}

export interface Report {
  id: string
  createdAt: number
  title: string
  body: string
  attackerId: string | null
  defenderId: string | null
  villageId: string | null
}

export interface ChronicleEntry {
  id: string
  createdAt: number
  text: string
}

export interface Command {
  id: string
  kind: CommandType
  phase: 'outbound' | 'return'
  ownerId: string
  sourceVillageId: string
  targetTileId: string
  targetVillageId: string | null
  units: Record<string, number>
  loot: ResourceStock
  shipment: ResourceStock | null
  merchantsUsed: number
  settlementKit: ResourceStock | null
  departAt: number
  arriveAt: number
}

export interface GameState {
  now: number
  nextId: number
  seed: number
  mapRadius: number
  selectedVillageId: string
  players: Record<string, Player>
  villages: Record<string, Village>
  tiles: Record<string, Tile>
  commands: Record<string, Command>
  reports: Report[]
  chronicle: ChronicleEntry[]
}

export interface BuildOption {
  gid: number
  label: string
  slotId: string
  nextLevel: number
  cost: ResourceStock
  buildTime: number
}

export interface TrainOption {
  unit: UnitDefinition
  available: boolean
  reason: string | null
}

export interface ExpansionStatus {
  totalSlots: number
  usedSlots: number
  committedSettlers: number
  committedCommanders: number
  readyCommanders: number
  availableExpansionSlots: number
  remainingSettlerCapacity: number
  readySettlers: number
  residenceLevel: number
  palaceLevel: number
  nextVillageRequirement: number
  culturePoints: number
  culturePointsNeeded: number
  settlementResourcesReady: boolean
  canSendSettlers: boolean
}

export interface MarketplaceStatus {
  total: number
  busy: number
  available: number
  capacityPerMerchant: number
  maxShipment: number
}

export interface ConquestPreview {
  allowed: boolean
  blockers: string[]
}

const INITIAL_RESOURCES = {
  wood: 750,
  clay: 750,
  iron: 750,
  crop: 750,
}

const MAP_RADIUS = 10

const AI_NAMES = [
  'Aldric',
  'Branna',
  'Cassian',
  'Darya',
  'Eldon',
  'Fenris',
  'Galen',
  'Hesta',
  'Ivar',
  'Jorin',
  'Kaela',
  'Leto',
  'Mira',
  'Noric',
  'Orla',
  'Pavel',
  'Quin',
  'Rhea',
  'Soren',
  'Talia',
  'Ulric',
  'Vesta',
  'Wren',
  'Xanthe',
  'Yorin',
  'Zora',
] as const

function makeId(state: GameState, prefix: string): string {
  const id = `${prefix}-${state.nextId}`
  state.nextId += 1
  return id
}

function tileId(x: number, y: number): string {
  return `${x}:${y}`
}

function coordinateDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let mixed = Math.imul(value ^ (value >>> 15), value | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function randomChoice<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]
}

function shuffle<T>(rng: () => number, list: T[]): T[] {
  const clone = [...list]
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    const current = clone[index]
    clone[index] = clone[swapIndex]
    clone[swapIndex] = current
  }
  return clone
}

function createTiles(state: GameState, rng: () => number): void {
  for (let y = -MAP_RADIUS; y <= MAP_RADIUS; y += 1) {
    for (let x = -MAP_RADIUS; x <= MAP_RADIUS; x += 1) {
      const distance = Math.hypot(x, y)
      const patternIndex =
        distance > MAP_RADIUS * 0.75
          ? 3
          : Math.floor(rng() * (RESOURCE_PATTERNS.length - 1))
      const id = tileId(x, y)
      state.tiles[id] = {
        id,
        x,
        y,
        patternIndex,
        villageId: null,
      }
    }
  }
}

function buildFieldLayout(patternIndex: number): FieldSlot[] {
  const [woodCount, clayCount, ironCount, cropCount] = RESOURCE_PATTERNS[patternIndex].distribution
  const slots: FieldSlot[] = []
  let counter = 0
  for (let index = 0; index < woodCount; index += 1) {
    counter += 1
    slots.push({ id: `field-${counter}`, gid: 1, level: 0 })
  }
  for (let index = 0; index < clayCount; index += 1) {
    counter += 1
    slots.push({ id: `field-${counter}`, gid: 2, level: 0 })
  }
  for (let index = 0; index < ironCount; index += 1) {
    counter += 1
    slots.push({ id: `field-${counter}`, gid: 3, level: 0 })
  }
  for (let index = 0; index < cropCount; index += 1) {
    counter += 1
    slots.push({ id: `field-${counter}`, gid: 4, level: 0 })
  }
  return slots
}

function createCenterSlots(tribe: Tribe): CenterSlot[] {
  const wallGid = WALL_BY_TRIBE[tribe]
  return [
    { id: 'center-1', buildingGid: 15, level: 1 },
    { id: 'center-2', buildingGid: 10, level: 1 },
    { id: 'center-3', buildingGid: 11, level: 1 },
    { id: 'center-4', buildingGid: 16, level: 1 },
    { id: 'center-5', buildingGid: wallGid, level: 0 },
    { id: 'center-6', buildingGid: null, level: 0 },
    { id: 'center-7', buildingGid: null, level: 0 },
    { id: 'center-8', buildingGid: null, level: 0 },
    { id: 'center-9', buildingGid: null, level: 0 },
    { id: 'center-10', buildingGid: null, level: 0 },
    { id: 'center-11', buildingGid: null, level: 0 },
    { id: 'center-12', buildingGid: null, level: 0 },
  ]
}

function createEmptyUnits(): Record<string, number> {
  return Object.fromEntries(Object.keys(UNIT_DEFINITIONS).map((id) => [id, 0]))
}

function createVillage(
  state: GameState,
  ownerId: string,
  tribe: Tribe,
  tile: Tile,
  name: string,
  isCapital: boolean,
): Village {
  const villageId = makeId(state, 'village')
  tile.villageId = villageId
  return {
    id: villageId,
    ownerId,
    name,
    tribe,
    tileId: tile.id,
    x: tile.x,
    y: tile.y,
    isCapital,
    loyalty: 100,
    expansionSlotsUsed: 0,
    patternIndex: tile.patternIndex,
    resources: { ...INITIAL_RESOURCES },
    fieldSlots: buildFieldLayout(tile.patternIndex),
    centerSlots: createCenterSlots(tribe),
    units: createEmptyUnits(),
    buildQueues: { field: null, center: null, shared: null },
    trainingQueues: {
      barracks: null,
      stable: null,
      workshop: null,
      residence: null,
      rally: null,
    },
  }
}

function createPersonality(rng: () => number): Personality {
  const doctrine = randomChoice(rng, ['builder', 'raider', 'settler', 'turtle'] as const)
  return {
    doctrine,
    aggression: rng(),
    expansion: rng(),
    economy: rng(),
    caution: rng(),
  }
}

function addChronicle(state: GameState, text: string): void {
  state.chronicle.unshift({
    id: makeId(state, 'log'),
    createdAt: state.now,
    text,
  })
  state.chronicle = state.chronicle.slice(0, 60)
}

function addReport(
  state: GameState,
  title: string,
  body: string,
  attackerId: string | null,
  defenderId: string | null,
  villageId: string | null,
): void {
  state.reports.unshift({
    id: makeId(state, 'report'),
    createdAt: state.now,
    title,
    body,
    attackerId,
    defenderId,
    villageId,
  })
  state.reports = state.reports.slice(0, 100)
}

function cloneState(state: GameState): GameState {
  return structuredClone(state)
}

function getCenterSlot(village: Village, slotId: string): CenterSlot | undefined {
  return village.centerSlots.find((slot) => slot.id === slotId)
}

function getFieldSlot(village: Village, slotId: string): FieldSlot | undefined {
  return village.fieldSlots.find((slot) => slot.id === slotId)
}

function getBuildingLevel(village: Village, gid: number): number {
  if (gid >= 1 && gid <= 4) {
    return Math.max(0, ...village.fieldSlots.filter((slot) => slot.gid === gid).map((slot) => slot.level))
  }
  return Math.max(0, ...village.centerSlots.filter((slot) => slot.buildingGid === gid).map((slot) => slot.level))
}

function getBuildingLevelData(gid: number, level: number) {
  const building = officialBuildingById[gid]
  if (!building || level <= 0) {
    return null
  }
  return building.levelData[String(level) as keyof typeof building.levelData] ?? null
}

function getStorageCapacity(village: Village): ResourceStock {
  const warehouseLevel = getBuildingLevel(village, 10)
  const granaryLevel = getBuildingLevel(village, 11)
  const warehouseData = getBuildingLevelData(10, warehouseLevel)
  const granaryData = getBuildingLevelData(11, granaryLevel)
  const warehouseEffects = (warehouseData?.effects ?? {}) as Record<string, number | undefined>
  const granaryEffects = (granaryData?.effects ?? {}) as Record<string, number | undefined>
  return {
    wood: warehouseEffects.storageWarehouse ?? 800,
    clay: warehouseEffects.storageWarehouse ?? 800,
    iron: warehouseEffects.storageWarehouse ?? 800,
    crop: granaryEffects.storageGranary ?? 800,
  }
}

function getAdministrationLevel(village: Village): number {
  return Math.max(getBuildingLevel(village, 25), getBuildingLevel(village, 26))
}

function getTotalMerchants(village: Village): number {
  const marketplaceLevel = getBuildingLevel(village, 17)
  const marketplaceData = getBuildingLevelData(17, marketplaceLevel)
  const effects = (marketplaceData?.effects ?? {}) as Record<string, number | undefined>
  return effects.merchants ?? 0
}

function getBusyMerchants(state: GameState, village: Village): number {
  return Object.values(state.commands).reduce((total, command) => {
    if (command.kind !== 'shipment' || command.sourceVillageId !== village.id) {
      return total
    }
    return total + command.merchantsUsed
  }, 0)
}

function getAvailableMerchants(state: GameState, village: Village): number {
  return Math.max(0, getTotalMerchants(village) - getBusyMerchants(state, village))
}

function getPopulation(village: Village): number {
  const fieldPopulation = village.fieldSlots.reduce((total, slot) => {
    const data = getBuildingLevelData(slot.gid, slot.level)
    return total + (data?.population ?? 0)
  }, 0)
  const centerPopulation = village.centerSlots.reduce((total, slot) => {
    if (!slot.buildingGid || slot.level <= 0) {
      return total
    }
    const data = getBuildingLevelData(slot.buildingGid, slot.level)
    return total + (data?.population ?? 0)
  }, 0)
  return fieldPopulation + centerPopulation
}

function getCulturePointRate(village: Village): number {
  const fieldPoints = village.fieldSlots.reduce((total, slot) => {
    const data = getBuildingLevelData(slot.gid, slot.level)
    return total + (data?.culturePoints ?? 0)
  }, 0)
  const centerPoints = village.centerSlots.reduce((total, slot) => {
    if (!slot.buildingGid || slot.level <= 0) {
      return total
    }
    const data = getBuildingLevelData(slot.buildingGid, slot.level)
    return total + (data?.culturePoints ?? 0)
  }, 0)
  return fieldPoints + centerPoints
}

function getCropUpkeep(village: Village): number {
  return Object.entries(village.units).reduce((total, [unitId, count]) => {
    const unit = UNIT_DEFINITIONS[unitId]
    return total + unit.upkeep * count
  }, 0)
}

function getVillageProduction(village: Village): ResourceStock {
  const production = emptyStock()
  for (const slot of village.fieldSlots) {
    const output = FIELD_OUTPUT_BY_LEVEL[slot.level] ?? FIELD_OUTPUT_BY_LEVEL[FIELD_OUTPUT_BY_LEVEL.length - 1]
    if (slot.gid === 1) production.wood += output
    if (slot.gid === 2) production.clay += output
    if (slot.gid === 3) production.iron += output
    if (slot.gid === 4) production.crop += output
  }
  production.crop -= getPopulation(village) + getCropUpkeep(village)
  return production
}

function getBuildTime(village: Village, gid: number, nextLevel: number): number {
  const levelData = getBuildingLevelData(gid, nextLevel)
  if (!levelData) {
    return 0
  }
  const currentMainBuildingLevel = gid === 15 ? nextLevel - 1 : getBuildingLevel(village, 15)
  if (currentMainBuildingLevel <= 1) {
    return Math.round(levelData.buildingTime)
  }
  return Math.round(levelData.buildingTime * 0.964 ** (currentMainBuildingLevel - 1))
}

function getVillageMilitaryStrength(village: Village): { attack: number; defense: number } {
  let attack = 0
  let defense = 0
  for (const [unitId, count] of Object.entries(village.units)) {
    const unit = UNIT_DEFINITIONS[unitId]
    attack += unit.attack * count
    defense += Math.max(unit.infantryDefense, unit.cavalryDefense) * count
  }
  return { attack, defense }
}

function getTrainingQueue(village: Village, unitId: string) {
  const unit = UNIT_DEFINITIONS[unitId]
  return village.trainingQueues[unit.trainingBuilding]
}

function setTrainingQueue(village: Village, unitId: string, order: TrainingOrder | null): void {
  const unit = UNIT_DEFINITIONS[unitId]
  village.trainingQueues[unit.trainingBuilding] = order
}

function getTotalExpansionSlots(village: Village): number {
  const residenceLevel = getBuildingLevel(village, 25)
  const palaceLevel = getBuildingLevel(village, 26)
  let slots = 0
  if (residenceLevel >= 10) slots += 1
  if (residenceLevel >= 20) slots += 1
  if (palaceLevel >= 10) slots += 1
  if (palaceLevel >= 15) slots += 1
  if (palaceLevel >= 20) slots += 1
  return slots
}

function getCommittedSettlerCount(state: GameState, village: Village): number {
  const settlerId = SETTLER_BY_TRIBE[village.tribe]
  const queuedSettlers =
    village.trainingQueues.residence?.unitId === settlerId ? village.trainingQueues.residence.quantity : 0
  const travelingSettlers = Object.values(state.commands).reduce((total, command) => {
    if (command.sourceVillageId !== village.id || !(settlerId in command.units)) {
      return total
    }
    return total + (command.units[settlerId] ?? 0)
  }, 0)

  return (village.units[settlerId] ?? 0) + queuedSettlers + travelingSettlers
}

function getCommittedCommanderCount(state: GameState, village: Village): number {
  const commanderId = COMMANDER_BY_TRIBE[village.tribe]
  const queuedCommanders =
    village.trainingQueues.residence?.unitId === commanderId ? village.trainingQueues.residence.quantity : 0
  const travelingCommanders = Object.values(state.commands).reduce((total, command) => {
    if (command.sourceVillageId !== village.id || !(commanderId in command.units)) {
      return total
    }
    return total + (command.units[commanderId] ?? 0)
  }, 0)

  return (village.units[commanderId] ?? 0) + queuedCommanders + travelingCommanders
}

function getAvailableExpansionSlots(state: GameState, village: Village): number {
  const freeSlots = Math.max(0, getTotalExpansionSlots(village) - village.expansionSlotsUsed)
  const occupiedSettlerSlots = Math.ceil(getCommittedSettlerCount(state, village) / 3)
  const occupiedCommanderSlots = getCommittedCommanderCount(state, village)
  return Math.max(0, freeSlots - occupiedSettlerSlots - occupiedCommanderSlots)
}

function canLaunchConquest(state: GameState, village: Village, selectedCommanderCount: number): boolean {
  const freeSlots = Math.max(0, getTotalExpansionSlots(village) - village.expansionSlotsUsed)
  const occupiedSettlerSlots = Math.ceil(getCommittedSettlerCount(state, village) / 3)
  const occupiedCommanderSlots = getCommittedCommanderCount(state, village)
  return freeSlots - occupiedSettlerSlots - Math.max(0, occupiedCommanderSlots - selectedCommanderCount) > 0
}

function getRemainingSettlerCapacity(state: GameState, village: Village): number {
  const effectiveSlots =
    Math.max(0, getTotalExpansionSlots(village) - village.expansionSlotsUsed) - getCommittedCommanderCount(state, village)
  const totalCapacity = Math.max(0, effectiveSlots * 3)
  return Math.max(0, totalCapacity - getCommittedSettlerCount(state, village))
}

function getNextVillageRequirementForPlayer(state: GameState, playerId: string): number {
  const player = state.players[playerId]
  return player ? getVillageRequirementForIndex(player.villageIds.length) : 0
}

function canLaunchSettlement(state: GameState, village: Village): boolean {
  const player = state.players[village.ownerId]
  const settlerId = SETTLER_BY_TRIBE[village.tribe]
  if (!player) return false
  if (getTotalExpansionSlots(village) <= village.expansionSlotsUsed) return false
  if ((village.units[settlerId] ?? 0) < 3) return false
  if (player.culturePoints < getNextVillageRequirementForPlayer(state, player.id)) return false
  return canAfford(village.resources, SETTLEMENT_COST)
}

function travelTimeBySpeed(
  source: { x: number; y: number },
  target: { x: number; y: number },
  speed: number,
): number {
  return Math.max(60, Math.round((coordinateDistance(source, target) / speed) * 3600))
}

function sendUnitsHome(state: GameState, command: Command, tile: Tile | null): void {
  const sourceVillage = state.villages[command.sourceVillageId]
  if (!sourceVillage) return

  command.phase = 'return'
  if (command.kind === 'shipment') {
    const speed = MERCHANT_SPEED_BY_TRIBE[sourceVillage.tribe]
    command.arriveAt =
      state.now + (tile ? travelTimeBySpeed(sourceVillage, tile, speed) : travelTimeBySpeed(sourceVillage, sourceVillage, speed))
  } else {
    command.arriveAt =
      state.now +
      (tile
        ? travelTimeToTile(sourceVillage, tile, command.units)
        : travelTimeSeconds(sourceVillage, sourceVillage, command.units))
  }
  state.commands[command.id] = command
}

function recallOutboundCommand(state: GameState, commandId: string): boolean {
  const command = state.commands[commandId]
  if (!command || command.phase !== 'outbound') return false

  const sourceVillage = state.villages[command.sourceVillageId]
  if (!sourceVillage || command.ownerId !== sourceVillage.ownerId) return false

  const elapsed = Math.max(0, state.now - command.departAt)
  command.phase = 'return'
  command.departAt = state.now
  command.arriveAt = state.now + Math.max(60, elapsed)
  state.commands[command.id] = command

  addChronicle(
    state,
    `${sourceVillage.name} recalled a ${command.kind} from the road.`,
  )
  addReport(
    state,
    'Command recalled',
    `${sourceVillage.name} recalled a ${command.kind} before it reached ${command.targetVillageId ? state.villages[command.targetVillageId]?.name ?? 'its target' : 'its target'}.`,
    command.ownerId,
    command.targetVillageId ? state.villages[command.targetVillageId]?.ownerId ?? null : null,
    command.sourceVillageId,
  )
  return true
}

function meetsPrerequisites(village: Village, gid: number): boolean {
  const building = officialBuildingById[gid]
  if (!building) {
    return false
  }
  for (const requirement of building.prerequisites) {
    if (requirement.type === 'Building') {
      const matches = requirement.gid.some((requiredGid) => getBuildingLevel(village, requiredGid) >= requirement.level)
      if (!matches) return false
    }
    if (requirement.type === 'NotBuilding') {
      if (getBuildingLevel(village, requirement.gid) > 0) return false
    }
  }
  return true
}

function canUpgradeField(village: Village, slot: FieldSlot): boolean {
  if (slot.level >= 25) return false
  if (!village.isCapital && slot.level >= 10) return false
  if (!village.isCapital && slot.level >= 12) return false
  return true
}

function canBuildCenter(village: Village, gid: number): boolean {
  const meta = BUILDING_METADATA[gid]
  if (!meta) return false
  if (meta.tribe && meta.tribe !== village.tribe) return false
  if (!meetsPrerequisites(village, gid)) return false
  if (meta.unique && getBuildingLevel(village, gid) > 0) return false
  return true
}

function createPlayer(state: GameState, name: string, tribe: Tribe, isHuman: boolean, personality: Personality | null): Player {
  const playerId = makeId(state, 'player')
  return {
    id: playerId,
    name,
    tribe,
    isHuman,
    villageIds: [],
    culturePoints: 0,
    nextAiPlanAt: state.now + 3600,
    personality,
  }
}

function chooseStartTiles(state: GameState, rng: () => number, totalPlayers: number): Tile[] {
  const candidates = Object.values(state.tiles).filter(
    (tile) => Math.abs(tile.x) + Math.abs(tile.y) > 4 && tile.patternIndex !== 3,
  )
  const shuffled = shuffle(rng, candidates)
  for (const minimumDistance of [5, 4, 3, 2, 1, 0]) {
    const chosen: Tile[] = []
    for (const tile of shuffled) {
      const tooClose = chosen.some((entry) => coordinateDistance(tile, entry) < minimumDistance)
      if (!tooClose) {
        chosen.push(tile)
      }
      if (chosen.length >= totalPlayers) break
    }
    if (chosen.length >= totalPlayers) {
      return chosen
    }
  }
  return shuffled.slice(0, totalPlayers)
}

export function createNewGame(config: GameConfig): GameState {
  const rng = mulberry32(config.seed)
  const state: GameState = {
    now: 0,
    nextId: 1,
    seed: config.seed,
    mapRadius: MAP_RADIUS,
    selectedVillageId: '',
    players: {},
    villages: {},
    tiles: {},
    commands: {},
    reports: [],
    chronicle: [],
  }

  createTiles(state, rng)

  const humanPlayer = createPlayer(state, config.playerName || 'Player', config.tribe, true, null)
  state.players[humanPlayer.id] = humanPlayer

  const aiPlayers: Player[] = []
  for (let index = 0; index < config.aiCount; index += 1) {
    const tribe = randomChoice(rng, ['romans', 'teutons', 'gauls'] as const)
    const baseName = AI_NAMES[index % AI_NAMES.length]
    const aiPlayer = createPlayer(
      state,
      `${baseName} of ${TRIBE_LABEL[tribe]}`,
      tribe,
      false,
      createPersonality(rng),
    )
    state.players[aiPlayer.id] = aiPlayer
    aiPlayers.push(aiPlayer)
  }

  const tiles = chooseStartTiles(state, rng, aiPlayers.length + 1)
  const humanTile = tiles[0]
  const humanVillage = createVillage(state, humanPlayer.id, humanPlayer.tribe, humanTile, HUMAN_VILLAGE_NAME, true)
  humanPlayer.villageIds.push(humanVillage.id)
  state.villages[humanVillage.id] = humanVillage
  state.selectedVillageId = humanVillage.id

  aiPlayers.forEach((player, index) => {
    const tile = tiles[index + 1]
    const village = createVillage(state, player.id, player.tribe, tile, `${player.name}'s Hold`, true)
    player.villageIds.push(village.id)
    state.villages[village.id] = village
  })

  addChronicle(
    state,
    `${config.playerName || 'Player'} enters the world as ${TRIBE_LABEL[config.tribe]} with ${config.aiCount} rival rulers.`,
  )

  return state
}

function updateVillageEconomy(village: Village, deltaSeconds: number): void {
  const hourly = getVillageProduction(village)
  const caps = getStorageCapacity(village)
  const nextResources = { ...village.resources }
  nextResources.wood += (hourly.wood * deltaSeconds) / 3600
  nextResources.clay += (hourly.clay * deltaSeconds) / 3600
  nextResources.iron += (hourly.iron * deltaSeconds) / 3600
  nextResources.crop += (hourly.crop * deltaSeconds) / 3600
  village.resources = clampStock(nextResources, caps)
}

function updateCulturePoints(state: GameState, deltaSeconds: number): void {
  for (const player of Object.values(state.players)) {
    const ratePerDay = player.villageIds.reduce((total, villageId) => {
      const village = state.villages[villageId]
      return total + getCulturePointRate(village)
    }, 0)
    player.culturePoints += (ratePerDay * deltaSeconds) / 86400
  }
}

function updateVillageLoyalty(village: Village, deltaSeconds: number): void {
  if (village.loyalty >= 100) return
  const administrationLevel = getAdministrationLevel(village)
  if (administrationLevel <= 0) return
  const loyaltyGainPerHour = (administrationLevel * 2) / 3
  village.loyalty = Math.min(100, village.loyalty + (loyaltyGainPerHour * deltaSeconds) / 3600)
}

function nextEventTime(state: GameState, target: number): number {
  let next = target
  for (const village of Object.values(state.villages)) {
    for (const queue of Object.values(village.buildQueues)) {
      if (queue && queue.completeAt < next) next = queue.completeAt
    }
    for (const queue of Object.values(village.trainingQueues)) {
      if (queue && queue.completeAt < next) next = queue.completeAt
    }
  }
  for (const command of Object.values(state.commands)) {
    if (command.arriveAt < next) next = command.arriveAt
  }
  for (const player of Object.values(state.players)) {
    if (!player.isHuman && player.nextAiPlanAt < next) next = player.nextAiPlanAt
  }
  return next
}

function processBuildQueues(state: GameState): void {
  for (const village of Object.values(state.villages)) {
    ;(['field', 'center', 'shared'] as const).forEach((key) => {
      const order = village.buildQueues[key]
      if (!order || order.completeAt !== state.now) return
      if (order.queueType === 'field') {
        const slot = getFieldSlot(village, order.targetSlotId)
        if (slot) slot.level = order.targetLevel
      } else {
        const slot = getCenterSlot(village, order.targetSlotId)
        if (slot) {
          slot.buildingGid = order.buildingGid
          slot.level = order.targetLevel
        }
      }
      village.buildQueues[key] = null
      addChronicle(
        state,
        `${village.name} finished ${BUILDING_METADATA[order.buildingGid].name} level ${order.targetLevel}.`,
      )
    })
  }
}

function processTrainingQueues(state: GameState): void {
  for (const village of Object.values(state.villages)) {
    ;(['barracks', 'stable', 'workshop', 'residence', 'rally'] as const).forEach((queueKey) => {
      const order = village.trainingQueues[queueKey]
      if (!order || order.completeAt !== state.now) return
      village.units[order.unitId] += order.quantity
      village.trainingQueues[queueKey] = null
      addChronicle(
        state,
        `${village.name} trained ${order.quantity} ${UNIT_DEFINITIONS[order.unitId].name}.`,
      )
    })
  }
}

function calculateDefenseValue(village: Village, attackerUnits: Record<string, number>): number {
  let infantryAttack = 0
  let cavalryAttack = 0
  for (const [unitId, count] of Object.entries(attackerUnits)) {
    const unit = UNIT_DEFINITIONS[unitId]
    if (unit.role === 'cavalry' || unit.role === 'scout') cavalryAttack += unit.attack * count
    else infantryAttack += unit.attack * count
  }

  const totalAttack = infantryAttack + cavalryAttack
  if (totalAttack <= 0) return 0

  const infantryShare = infantryAttack / totalAttack
  const cavalryShare = cavalryAttack / totalAttack

  let defense = 0
  for (const [unitId, count] of Object.entries(village.units)) {
    const unit = UNIT_DEFINITIONS[unitId]
    defense += count * (unit.infantryDefense * infantryShare + unit.cavalryDefense * cavalryShare)
  }

  const wallLevel = getBuildingLevel(village, WALL_BY_TRIBE[village.tribe])
  defense *= 1 + wallLevel * TRIBE_TRAITS[village.tribe].wallBonusPerLevel
  return defense
}

function applyLosses(units: Record<string, number>, lossRatio: number): Record<string, number> {
  const survivors = { ...units }
  for (const [unitId, count] of Object.entries(units)) {
    survivors[unitId] = Math.max(0, Math.round(count * (1 - lossRatio)))
  }
  return survivors
}

function trimZeroUnits(units: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(units).filter(([, count]) => count > 0))
}

function lootVillage(village: Village, capacity: number): ResourceStock {
  const stolen = emptyStock()
  let remaining = capacity
  for (const key of RESOURCE_KEYS) {
    if (remaining <= 0) break
    const amount = Math.min(village.resources[key], remaining)
    village.resources[key] -= amount
    stolen[key] += amount
    remaining -= amount
  }
  return stolen
}

function getSeedFraction(seed: number): number {
  let value = seed >>> 0
  value = Math.imul(value ^ 61, 1)
  value ^= value >>> 16
  value += value << 3
  value ^= value >>> 4
  value = Math.imul(value, 0x27d4eb2d)
  value ^= value >>> 15
  return (value >>> 0) / 4294967296
}

function getLoyaltyRoll(state: GameState, command: Command, offset: number, tribe: Tribe): number {
  const commandId = Number(command.id.split('-')[1] ?? 0)
  const range = LOYALTY_REDUCTION_BY_TRIBE[tribe]
  const spread = range.max - range.min + 1
  const fraction = getSeedFraction(state.seed + state.now + commandId * 131 + offset * 977)
  return range.min + Math.floor(fraction * spread)
}

function getHighestCenterSlot(village: Village, gids: number[]): CenterSlot | null {
  return (
    village.centerSlots
      .filter((slot) => slot.buildingGid !== null && gids.includes(slot.buildingGid) && slot.level > 0)
      .sort((left, right) => right.level - left.level)[0] ?? null
  )
}

function damageCenterSlot(slot: CenterSlot, amount: number): { before: number; after: number } {
  const before = slot.level
  const after = Math.max(0, before - amount)
  slot.level = after
  if (after === 0) {
    slot.buildingGid = null
  }
  return { before, after }
}

function applySiegeDamage(command: Command, village: Village): string[] {
  if (command.kind === 'raid') {
    return []
  }

  const notes: string[] = []
  const ramCount =
    (command.units.batteringRam ?? 0) + (command.units.teutonRam ?? 0) + (command.units.gaulRam ?? 0)
  const catapultCount =
    (command.units.fireCatapult ?? 0) + (command.units.catapult ?? 0) + (command.units.trebuchet ?? 0)

  if (ramCount > 0) {
    const wallSlot = getHighestCenterSlot(village, Object.values(WALL_BY_TRIBE))
    if (wallSlot?.buildingGid) {
      const damage = Math.max(1, Math.floor(ramCount / 10))
      const name = BUILDING_METADATA[wallSlot.buildingGid].name
      const result = damageCenterSlot(wallSlot, damage)
      notes.push(
        result.after > 0
          ? `${name} fell from level ${result.before} to ${result.after}.`
          : `${name} was destroyed.`,
      )
    }
  }

  if (catapultCount > 0) {
    const administrationSlot =
      getHighestCenterSlot(village, [25, 26]) ??
      getHighestCenterSlot(
        village,
        village.centerSlots.flatMap((slot) => (slot.buildingGid ? [slot.buildingGid] : [])),
      )
    if (administrationSlot?.buildingGid) {
      const damage = Math.max(1, Math.floor(catapultCount / 8))
      const name = BUILDING_METADATA[administrationSlot.buildingGid].name
      const result = damageCenterSlot(administrationSlot, damage)
      notes.push(
        result.after > 0
          ? `${name} fell from level ${result.before} to ${result.after}.`
          : `${name} was destroyed.`,
      )
    }
  }

  return notes
}

function destroyConquestBuildings(village: Village, oldTribe: Tribe): void {
  for (const slot of village.centerSlots) {
    if (!slot.buildingGid) continue
    const meta = BUILDING_METADATA[slot.buildingGid]
    if (slot.buildingGid === WALL_BY_TRIBE[oldTribe] || meta?.tribe) {
      slot.buildingGid = null
      slot.level = 0
    }
  }
}

function removeCapturedVillageCommands(state: GameState, villageId: string, ownerId: string): void {
  for (const command of Object.values({ ...state.commands })) {
    if (command.sourceVillageId === villageId && command.ownerId === ownerId) {
      delete state.commands[command.id]
    }
  }
}

function finalizeConquest(
  state: GameState,
  sourceVillage: Village,
  defendingVillage: Village,
  newOwnerId: string,
  garrison: Record<string, number>,
): void {
  const previousOwnerId = defendingVillage.ownerId
  const previousOwner = state.players[previousOwnerId]
  const newOwner = state.players[newOwnerId]
  if (!previousOwner || !newOwner) return

  const oldTribe = defendingVillage.tribe
  previousOwner.villageIds = previousOwner.villageIds.filter((villageId) => villageId !== defendingVillage.id)
  if (!newOwner.villageIds.includes(defendingVillage.id)) {
    newOwner.villageIds.push(defendingVillage.id)
  }

  sourceVillage.expansionSlotsUsed += 1
  defendingVillage.ownerId = newOwner.id
  defendingVillage.tribe = newOwner.tribe
  defendingVillage.isCapital = false
  defendingVillage.loyalty = 0
  defendingVillage.units = { ...createEmptyUnits(), ...trimZeroUnits(garrison) }
  destroyConquestBuildings(defendingVillage, oldTribe)
  removeCapturedVillageCommands(state, defendingVillage.id, previousOwnerId)

  const humanPlayer = Object.values(state.players).find((player) => player.isHuman)
  if (humanPlayer) {
    const selectedVillage = state.villages[state.selectedVillageId]
    if (!selectedVillage || selectedVillage.ownerId !== humanPlayer.id) {
      state.selectedVillageId = humanPlayer.villageIds[0] ?? state.selectedVillageId
    }
  }
}

function attemptConquest(
  state: GameState,
  command: Command,
  sourceVillage: Village,
  defendingVillage: Village,
  survivingAttackers: Record<string, number>,
): { conquered: boolean; notes: string[] } {
  const attacker = state.players[command.ownerId]
  if (!attacker) {
    return { conquered: false, notes: [] }
  }

  const commanderId = COMMANDER_BY_TRIBE[sourceVillage.tribe]
  const survivingCommanders = survivingAttackers[commanderId] ?? 0
  if (survivingCommanders <= 0) {
    return { conquered: false, notes: ['No administrator survived to speak to the village elders.'] }
  }
  if (defendingVillage.isCapital) {
    return { conquered: false, notes: ['Capitals cannot be conquered.'] }
  }
  if (attacker.culturePoints < getNextVillageRequirementForPlayer(state, attacker.id)) {
    return {
      conquered: false,
      notes: [
        `Need ${Math.ceil(
          getNextVillageRequirementForPlayer(state, attacker.id) - attacker.culturePoints,
        ).toLocaleString()} more culture points before another village can be taken.`,
      ],
    }
  }
  if (getAdministrationLevel(defendingVillage) > 0) {
    return { conquered: false, notes: ['Residence or Palace is still standing.'] }
  }

  const loyaltyBefore = defendingVillage.loyalty
  let loyaltyDrop = 0
  for (let index = 0; index < survivingCommanders; index += 1) {
    loyaltyDrop += getLoyaltyRoll(state, command, index, sourceVillage.tribe)
  }
  defendingVillage.loyalty = Math.max(0, defendingVillage.loyalty - loyaltyDrop)

  if (defendingVillage.loyalty > 0) {
    return {
      conquered: false,
      notes: [`Loyalty fell from ${Math.round(loyaltyBefore)} to ${Math.round(defendingVillage.loyalty)}.`],
    }
  }

  const garrison = { ...survivingAttackers }
  delete garrison[commanderId]
  finalizeConquest(state, sourceVillage, defendingVillage, attacker.id, garrison)
  return {
    conquered: true,
    notes: [`Loyalty fell from ${Math.round(loyaltyBefore)} to 0 and the village changed hands.`],
  }
}

function completeSettlement(state: GameState, command: Command, village: Village | null): void {
  const owner = state.players[command.ownerId]
  if (!owner) return
  const tile = state.tiles[command.targetTileId]
  if (!tile || tile.villageId || village) {
    addReport(
      state,
      'Settlement failed',
      `${owner.name} could not found a village at (${tile.x}, ${tile.y}).`,
      command.ownerId,
      village?.ownerId ?? null,
      village?.id ?? null,
    )
    addChronicle(state, `${owner.name}'s settlers turned back from (${tile.x}, ${tile.y}).`)
    sendUnitsHome(state, command, tile)
    return
  }

  const newVillage = createVillage(state, owner.id, owner.tribe, tile, `Village ${owner.villageIds.length + 1}`, false)
  const sourceVillage = state.villages[command.sourceVillageId]
  if (sourceVillage) {
    sourceVillage.expansionSlotsUsed += 1
  }
  owner.villageIds.push(newVillage.id)
  state.villages[newVillage.id] = newVillage
  addChronicle(state, `${owner.name} founded ${newVillage.name} at (${tile.x}, ${tile.y}).`)
  addReport(
    state,
    'New village founded',
    `${owner.name} founded ${newVillage.name} on ${RESOURCE_PATTERNS[newVillage.patternIndex].label}.`,
    owner.id,
    null,
    newVillage.id,
  )
}

function processCombat(state: GameState, command: Command, defendingVillage: Village): void {
  const attackerVillage = state.villages[command.sourceVillageId]
  const defendingOwnerId = defendingVillage.ownerId
  const defenderName = state.players[defendingOwnerId].name
  const attackerName = state.players[command.ownerId].name
  const attackerPower = sumUnitAttack(command.units)
  const defenderPower = calculateDefenseValue(defendingVillage, command.units)
  const attackerWon = attackerPower > defenderPower
  const ratio = attackerWon
    ? defenderPower <= 0
      ? 0
      : Math.min(0.95, (defenderPower / Math.max(attackerPower, 1)) ** 1.35)
    : attackerPower <= 0
      ? 1
      : Math.min(0.95, (attackerPower / Math.max(defenderPower, 1)) ** 1.35)

  const survivingAttackers = attackerWon ? trimZeroUnits(applyLosses(command.units, ratio)) : {}
  const survivingDefenders = attackerWon ? {} : trimZeroUnits(applyLosses(defendingVillage.units, ratio))

  if (attackerWon) {
    defendingVillage.units = createEmptyUnits()
    const siegeNotes = applySiegeDamage(command, defendingVillage)
    const conquest =
      command.kind === 'conquer'
        ? attemptConquest(state, command, attackerVillage, defendingVillage, survivingAttackers)
        : { conquered: false, notes: [] as string[] }
    let loot = emptyStock()

    if (!conquest.conquered) {
      const capacity = sumUnitCarrying(survivingAttackers)
      loot = lootVillage(defendingVillage, capacity)
      command.loot = addStock(command.loot, loot)
    }

    if (!conquest.conquered && Object.keys(survivingAttackers).length > 0) {
      command.phase = 'return'
      command.units = survivingAttackers
      command.arriveAt = state.now + travelTimeSeconds(attackerVillage, defendingVillage, survivingAttackers)
      state.commands[command.id] = command
    }

    const outcomeNotes = [...siegeNotes, ...conquest.notes].join(' ')
    addReport(
      state,
      conquest.conquered ? `${attackerName} conquered ${defendingVillage.name}` : `${attackerName} won at ${defendingVillage.name}`,
      `${command.kind === 'conquer' ? 'Conquest wave' : 'Attack'} power ${Math.round(
        attackerPower,
      )} broke ${Math.round(defenderPower)} defense.${
        conquest.conquered
          ? ' Surviving troops occupied the village.'
          : ` Carried home ${Math.round(loot.wood + loot.clay + loot.iron + loot.crop)} resources.`
      }${outcomeNotes ? ` ${outcomeNotes}` : ''}`,
      command.ownerId,
      defendingOwnerId,
      defendingVillage.id,
    )
    addChronicle(
      state,
      conquest.conquered
        ? `${attackerName} seized ${defendingVillage.name} from ${defenderName}.`
        : `${attackerName} defeated ${defenderName} at ${defendingVillage.name}.`,
    )
    return
  }

  defendingVillage.units = { ...createEmptyUnits(), ...survivingDefenders }
  addReport(
    state,
    `${defendingVillage.name} held`,
    `${defenderName} repelled ${attackerName}.${command.kind === 'conquer' ? ' Loyalty did not shift.' : ''}`,
    command.ownerId,
    defendingOwnerId,
    defendingVillage.id,
  )
  addChronicle(
    state,
    `${defendingVillage.name} held against ${attackerName}.`,
  )
}

function processCommandArrivals(state: GameState): void {
  for (const command of Object.values({ ...state.commands })) {
    if (command.arriveAt !== state.now) continue
    delete state.commands[command.id]
    const sourceVillage = state.villages[command.sourceVillageId]
    const targetTile = state.tiles[command.targetTileId]
    const targetVillage = command.targetVillageId ? state.villages[command.targetVillageId] : null

    if (command.phase === 'return') {
      for (const [unitId, count] of Object.entries(command.units)) {
        sourceVillage.units[unitId] += count
      }
      sourceVillage.resources = addStock(sourceVillage.resources, command.loot)
      if (command.shipment) {
        sourceVillage.resources = addStock(sourceVillage.resources, command.shipment)
      }
      if (command.settlementKit) {
        sourceVillage.resources = addStock(sourceVillage.resources, command.settlementKit)
      }
      sourceVillage.resources = clampStock(sourceVillage.resources, getStorageCapacity(sourceVillage))
      addChronicle(
        state,
        command.kind === 'shipment'
          ? `${sourceVillage.name} received returning merchants.`
          : `${sourceVillage.name} received returning troops.`,
      )
      continue
    }

    if (command.kind === 'settle') {
      completeSettlement(state, command, targetVillage)
      continue
    }

    if (command.kind === 'shipment') {
      if (!targetVillage || targetVillage.ownerId !== command.ownerId) {
        addChronicle(state, `${sourceVillage.name}'s merchants found no safe market and turned back.`)
        sendUnitsHome(state, command, targetTile)
        continue
      }

      if (command.shipment) {
        targetVillage.resources = clampStock(
          addStock(targetVillage.resources, command.shipment),
          getStorageCapacity(targetVillage),
        )
        addChronicle(
          state,
          `${sourceVillage.name} shipped ${Math.round(
            command.shipment.wood + command.shipment.clay + command.shipment.iron + command.shipment.crop,
          )} resources to ${targetVillage.name}.`,
        )
      }
      command.shipment = null
      sendUnitsHome(state, command, targetTile)
      continue
    }

    if (!targetTile || !targetVillage) {
      continue
    }

    processCombat(state, command, targetVillage)
  }
}

function issueAiPlan(state: GameState, playerId: string): void {
  const player = state.players[playerId]
  if (!player || player.isHuman || !player.personality) return
  const villages = player.villageIds.map((id) => state.villages[id])
  villages.forEach((village) => {
    if (canPlanConstruction(village)) {
      const buildAction = chooseBuildAction(state, player, village)
      if (buildAction) {
        startConstruction(state, village.id, buildAction.gid, buildAction.slotId)
      }
    }
    const trainingAction = chooseTrainingAction(state, player, village)
    if (trainingAction) {
      startTraining(state, village.id, trainingAction.unit.id, trainingAction.quantity)
    }
    const settlementAction = chooseSettlementAction(state, player, village)
    if (settlementAction) {
      sendCommand(state, village.id, settlementAction.targetTileId, settlementAction.units, settlementAction.kind)
      return
    }
    const commandAction = chooseMilitaryAction(state, player, village)
    if (commandAction) {
      sendCommand(state, village.id, commandAction.targetTileId, commandAction.units, commandAction.kind)
    }
  })
  const personality = player.personality
  player.nextAiPlanAt = state.now + 1800 + Math.round((1 + personality.caution) * 1800)
}

function canPlanConstruction(village: Village): boolean {
  const traits = TRIBE_TRAITS[village.tribe]
  if (traits.buildQueues.shared > 0) {
    return !village.buildQueues.shared
  }
  return !village.buildQueues.field || !village.buildQueues.center
}

function chooseBuildAction(state: GameState, player: Player, village: Village): BuildOption | null {
  const fieldOptions = village.fieldSlots
    .filter((slot) => canUpgradeField(village, slot))
    .map((slot) => buildFieldOption(village, slot))
    .filter((option): option is BuildOption => option !== null)

  const centerOptions = listVillageBuildOptions(state, village.id)

  const storage = getStorageCapacity(village)
  const production = getVillageProduction(village)
  const mainLevel = getBuildingLevel(village, 15)
  const barracksLevel = getBuildingLevel(village, 19)
  const academyLevel = getBuildingLevel(village, 22)
  const residenceLevel = getBuildingLevel(village, 25)

  if (village.resources.wood > storage.wood * 0.75 || village.resources.iron > storage.iron * 0.75) {
    return centerOptions.find((option) => option.gid === 10) ?? null
  }
  if (village.resources.crop > storage.crop * 0.75 || production.crop < 15) {
    return centerOptions.find((option) => option.gid === 11) ?? fieldOptions.find((option) => option.gid === 4) ?? null
  }
  if (mainLevel < 5) {
    return centerOptions.find((option) => option.gid === 15) ?? null
  }
  if (fieldOptions.some((option) => option.nextLevel <= 4)) {
    return fieldOptions.sort((left, right) => left.nextLevel - right.nextLevel)[0]
  }
  if (barracksLevel === 0) {
    return centerOptions.find((option) => option.gid === 19) ?? null
  }
  if (academyLevel < 5) {
    return centerOptions.find((option) => option.gid === 22) ?? null
  }
  if (residenceLevel < 10 && player.personality && player.personality.expansion > 0.45) {
    return centerOptions.find((option) => option.gid === 25) ?? null
  }
  if (production.crop < 0) {
    return fieldOptions
      .filter((option) => option.gid === 4)
      .sort((left, right) => left.nextLevel - right.nextLevel)[0] ?? null
  }
  if (player.personality?.doctrine === 'raider') {
    return centerOptions.find((option) => option.gid === 20) ?? fieldOptions[0] ?? null
  }
  return (
    centerOptions.find((option) => option.gid === 23) ??
    fieldOptions.sort((left, right) => left.cost.wood + left.cost.clay - (right.cost.wood + right.cost.clay))[0] ??
    null
  )
}

function chooseTrainingAction(
  state: GameState,
  player: Player,
  village: Village,
): { unit: UnitDefinition; quantity: number } | null {
  const options = listTrainableUnits(state, village.id).filter((option) => option.available)
  if (!options.length) return null
  const commanderId = COMMANDER_BY_TRIBE[player.tribe]

  if (
    getBuildingLevel(village, 25) >= 10 &&
    player.villageIds.length < 3 &&
    player.culturePoints >= getVillageRequirementForIndex(player.villageIds.length)
  ) {
    const settler = UNIT_DEFINITIONS[SETTLER_BY_TRIBE[player.tribe]]
    if (
      canAfford(village.resources, settler.cost) &&
      !getTrainingQueue(village, settler.id) &&
      getRemainingSettlerCapacity(state, village) > 0
    ) {
      return { unit: settler, quantity: 1 }
    }
  }

  const commander = options.find((option) => option.unit.id === commanderId)
  if (
    commander &&
    player.culturePoints >= getVillageRequirementForIndex(player.villageIds.length) &&
    getCommittedCommanderCount(state, village) === 0 &&
    getAvailableExpansionSlots(state, village) > 0 &&
    (player.personality?.aggression ?? 0) > 0.55 &&
    village.units[PRIMARY_OFFENSE_UNIT[player.tribe]] >= 18
  ) {
    return { unit: commander.unit, quantity: 1 }
  }

  const doctrine = player.personality?.doctrine ?? 'builder'
  const preferredUnitId =
    doctrine === 'turtle' ? PRIMARY_DEFENSE_UNIT[player.tribe] : PRIMARY_OFFENSE_UNIT[player.tribe]
  const preferred = options.find((option) => option.unit.id === preferredUnitId)
  if (preferred && canAfford(village.resources, preferred.unit.cost)) {
    return { unit: preferred.unit, quantity: 3 }
  }

  const scout = options.find((option) => option.unit.id === SCOUT_UNIT_BY_TRIBE[player.tribe])
  if (scout && canAfford(village.resources, scout.unit.cost) && village.units[scout.unit.id] < 4) {
    return { unit: scout.unit, quantity: 1 }
  }

  return null
}

function chooseSettlementAction(
  state: GameState,
  player: Player,
  village: Village,
): { kind: CommandType; targetTileId: string; units: Record<string, number> } | null {
  const settlerId = SETTLER_BY_TRIBE[player.tribe]
  const hasOutboundSettlement = Object.values(state.commands).some(
    (command) =>
      command.sourceVillageId === village.id && command.kind === 'settle' && command.phase === 'outbound',
  )
  if (hasOutboundSettlement || !canLaunchSettlement(state, village)) return null

  const targets = Object.values(state.tiles)
    .filter((tile) => !tile.villageId)
    .map((tile) => {
      const distance = coordinateDistance(village, tile)
      const baseScore =
        tile.patternIndex === 0 ? 18 : tile.patternIndex === 3 ? (player.personality?.doctrine === 'raider' ? 16 : 12) : 15
      return {
        tile,
        score: baseScore - distance * 1.35,
      }
    })
    .sort((left, right) => right.score - left.score)

  const target = targets[0]
  if (!target) return null

  return {
    kind: 'settle',
    targetTileId: target.tile.id,
    units: { [settlerId]: 3 },
  }
}

function chooseMilitaryAction(
  state: GameState,
  player: Player,
  village: Village,
): { kind: CommandType; targetTileId: string; units: Record<string, number> } | null {
  const offenseUnitId = PRIMARY_OFFENSE_UNIT[player.tribe]
  const available = village.units[offenseUnitId]
  if (available < 12) return null
  const commanderId = COMMANDER_BY_TRIBE[player.tribe]
  const commanderAvailable = village.units[commanderId] ?? 0
  const catapultId =
    player.tribe === 'romans' ? 'fireCatapult' : player.tribe === 'teutons' ? 'catapult' : 'trebuchet'
  const catapultAvailable = village.units[catapultId] ?? 0

  const candidates = Object.values(state.villages)
    .filter((target) => target.ownerId !== player.id)
    .map((target) => {
      const power = getVillageMilitaryStrength(target).defense
      const administrationLevel = getAdministrationLevel(target)
      return {
        target,
        distance: coordinateDistance(village, target),
        power,
        administrationLevel,
      }
    })
    .sort((left, right) => left.distance - right.distance)

  if (commanderAvailable > 0 && player.culturePoints >= getVillageRequirementForIndex(player.villageIds.length)) {
    const conquestTarget = candidates.find(
      (candidate) =>
        candidate.distance <= 8 &&
        !candidate.target.isCapital &&
        available * UNIT_DEFINITIONS[offenseUnitId].attack > candidate.power * 1.5 &&
        (candidate.administrationLevel === 0 || catapultAvailable > 0),
    )
    if (conquestTarget) {
      const escortCount = Math.max(16, Math.floor(available * 0.55))
      const units: Record<string, number> = {
        [offenseUnitId]: escortCount,
        [commanderId]: 1,
      }
      if (conquestTarget.administrationLevel > 0 && catapultAvailable > 0) {
        units[catapultId] = Math.min(catapultAvailable, Math.max(1, conquestTarget.administrationLevel * 2))
      }
      return {
        kind: 'conquer',
        targetTileId: conquestTarget.target.tileId,
        units,
      }
    }
  }

  const target = candidates.find(
    (candidate) =>
      candidate.distance <= 8 && available * UNIT_DEFINITIONS[offenseUnitId].attack > candidate.power * 1.3,
  )
  if (!target) return null

  const sendCount = Math.max(8, Math.floor(available * 0.4))
  return {
    kind: player.personality?.aggression && player.personality.aggression > 0.7 ? 'attack' : 'raid',
    targetTileId: target.target.tileId,
    units: { [offenseUnitId]: sendCount },
  }
}

function buildFieldOption(village: Village, slot: FieldSlot): BuildOption | null {
  if (!canUpgradeField(village, slot)) return null
  const nextLevel = slot.level + 1
  const data = getBuildingLevelData(slot.gid, nextLevel)
  if (!data) return null
  return {
    gid: slot.gid,
    label: `${BUILDING_METADATA[slot.gid].name} level ${nextLevel}`,
    slotId: slot.id,
    nextLevel,
    cost: {
      wood: data.resourceCost.r1,
      clay: data.resourceCost.r2,
      iron: data.resourceCost.r3,
      crop: data.resourceCost.r4,
    },
    buildTime: getBuildTime(village, slot.gid, nextLevel),
  }
}

export function listVillageBuildOptions(state: GameState, villageId: string): BuildOption[] {
  const village = state.villages[villageId]
  if (!village) return []

  const options: BuildOption[] = []

  for (const centerSlot of village.centerSlots) {
    if (centerSlot.buildingGid) {
      const data = getBuildingLevelData(centerSlot.buildingGid, centerSlot.level + 1)
      if (!data) continue
      if (centerSlot.buildingGid >= 31 && centerSlot.buildingGid !== WALL_BY_TRIBE[village.tribe]) continue
      options.push({
        gid: centerSlot.buildingGid,
        label: `${BUILDING_METADATA[centerSlot.buildingGid].name} level ${centerSlot.level + 1}`,
        slotId: centerSlot.id,
        nextLevel: centerSlot.level + 1,
        cost: {
          wood: data.resourceCost.r1,
          clay: data.resourceCost.r2,
          iron: data.resourceCost.r3,
          crop: data.resourceCost.r4,
        },
        buildTime: getBuildTime(village, centerSlot.buildingGid, centerSlot.level + 1),
      })
      continue
    }

    for (const gid of BUILDABLE_CENTER_BUILDINGS) {
      if (!canBuildCenter(village, gid)) continue
      const data = getBuildingLevelData(gid, 1)
      if (!data) continue
      options.push({
        gid,
        label: BUILDING_METADATA[gid].name,
        slotId: centerSlot.id,
        nextLevel: 1,
        cost: {
          wood: data.resourceCost.r1,
          clay: data.resourceCost.r2,
          iron: data.resourceCost.r3,
          crop: data.resourceCost.r4,
        },
        buildTime: getBuildTime(village, gid, 1),
      })
    }
    break
  }

  return options.sort((left, right) => left.buildTime - right.buildTime)
}

export function listTrainableUnits(state: GameState, villageId: string): TrainOption[] {
  const village = state.villages[villageId]
  if (!village) return []
  const academyLevel = getBuildingLevel(village, 22)
  const administrationLevel = getAdministrationLevel(village)
  const settlerId = SETTLER_BY_TRIBE[village.tribe]
  const commanderId = COMMANDER_BY_TRIBE[village.tribe]

  return UNITS_BY_TRIBE[village.tribe].map((unitId) => {
    const unit = UNIT_DEFINITIONS[unitId]
    const trainingBuildingGid =
      unit.trainingBuilding === 'barracks'
        ? 19
        : unit.trainingBuilding === 'stable'
          ? 20
          : unit.trainingBuilding === 'workshop'
            ? 21
            : unit.trainingBuilding === 'residence'
              ? 25
              : 16
    const buildingLevel =
      unit.trainingBuilding === 'residence' ? administrationLevel : getBuildingLevel(village, trainingBuildingGid)
    let reason: string | null = null

    if (buildingLevel < unit.minimumBuildingLevel) {
      reason =
        unit.trainingBuilding === 'residence'
          ? `Residence or Palace ${unit.minimumBuildingLevel} required`
          : `${BUILDING_METADATA[trainingBuildingGid].name} ${unit.minimumBuildingLevel} required`
    }
    if (academyLevel < unit.academyLevel) {
      reason = `Academy ${unit.academyLevel} required`
    }
    if (unit.id === settlerId && getRemainingSettlerCapacity(state, village) <= 0) {
      reason = 'All expansion slots are already committed'
    }
    if (unit.id === commanderId && getAvailableExpansionSlots(state, village) <= 0) {
      reason = 'All expansion slots are already committed'
    }

    return {
      unit,
      available: !reason,
      reason,
    }
  })
}

function startConstruction(state: GameState, villageId: string, gid: number, slotId: string): boolean {
  const village = state.villages[villageId]
  if (!village) return false
  const fieldSlot = getFieldSlot(village, slotId)
  const centerSlot = getCenterSlot(village, slotId)
  const traits = TRIBE_TRAITS[village.tribe]
  const queueType =
    traits.buildQueues.shared > 0 ? 'shared' : fieldSlot ? 'field' : 'center'

  if (queueType === 'shared' && village.buildQueues.shared) return false
  if (queueType === 'field' && village.buildQueues.field) return false
  if (queueType === 'center' && village.buildQueues.center) return false

  const nextLevel = fieldSlot ? fieldSlot.level + 1 : (centerSlot?.level ?? 0) + 1
  const data = getBuildingLevelData(gid, nextLevel)
  if (!data) return false
  const cost = {
    wood: data.resourceCost.r1,
    clay: data.resourceCost.r2,
    iron: data.resourceCost.r3,
    crop: data.resourceCost.r4,
  }
  if (!canAfford(village.resources, cost)) return false
  village.resources = subtractStock(village.resources, cost)
  const order: BuildOrder = {
    id: makeId(state, 'build'),
    queueType,
    targetSlotId: slotId,
    buildingGid: gid,
    targetLevel: nextLevel,
    startedAt: state.now,
    completeAt: state.now + getBuildTime(village, gid, nextLevel),
  }
  village.buildQueues[queueType] = order
  addChronicle(
    state,
    `${village.name} started ${BUILDING_METADATA[gid].name} level ${nextLevel}.`,
  )
  return true
}

function startTraining(state: GameState, villageId: string, unitId: string, quantity: number): boolean {
  const village = state.villages[villageId]
  if (!village || quantity <= 0) return false
  const unit = UNIT_DEFINITIONS[unitId]
  if (!unit) return false
  if (getTrainingQueue(village, unitId)) return false
  const academyLevel = getBuildingLevel(village, 22)
  const administrationLevel = getAdministrationLevel(village)
  const trainingBuildingLevel =
    unit.trainingBuilding === 'residence'
      ? administrationLevel
      : getBuildingLevel(
          village,
          unit.trainingBuilding === 'barracks'
            ? 19
            : unit.trainingBuilding === 'stable'
              ? 20
              : unit.trainingBuilding === 'workshop'
                ? 21
                : 16,
        )
  if (academyLevel < unit.academyLevel || trainingBuildingLevel < unit.minimumBuildingLevel) {
    return false
  }
  if (unit.id === SETTLER_BY_TRIBE[village.tribe] && getRemainingSettlerCapacity(state, village) < quantity) {
    return false
  }
  if (unit.id === COMMANDER_BY_TRIBE[village.tribe] && getAvailableExpansionSlots(state, village) < quantity) {
    return false
  }

  const cost = {
    wood: unit.cost.wood * quantity,
    clay: unit.cost.clay * quantity,
    iron: unit.cost.iron * quantity,
    crop: unit.cost.crop * quantity,
  }
  if (!canAfford(village.resources, cost)) return false
  village.resources = subtractStock(village.resources, cost)

  const order: TrainingOrder = {
    id: makeId(state, 'train'),
    unitId,
    quantity,
    startedAt: state.now,
    completeAt: state.now + unit.trainingTime * quantity,
  }
  setTrainingQueue(village, unitId, order)
  addChronicle(state, `${village.name} began training ${quantity} ${unit.name}.`)
  return true
}

function travelTimeSeconds(source: Village, target: Village, units: Record<string, number>): number {
  const speeds = Object.entries(units)
    .filter(([, count]) => count > 0)
    .map(([unitId]) => UNIT_DEFINITIONS[unitId].speed)
  const slowest = speeds.length ? Math.min(...speeds) : 1
  return travelTimeBySpeed(source, target, slowest)
}

function travelTimeToTile(source: Village, tile: Tile, units: Record<string, number>): number {
  const speeds = Object.entries(units)
    .filter(([, count]) => count > 0)
    .map(([unitId]) => UNIT_DEFINITIONS[unitId].speed)
  const slowest = speeds.length ? Math.min(...speeds) : 1
  return travelTimeBySpeed(source, tile, slowest)
}

function sendCommand(
  state: GameState,
  sourceVillageId: string,
  targetTileId: string,
  units: Record<string, number>,
  kind: CommandType,
  shipment: ResourceStock | null = null,
): boolean {
  const sourceVillage = state.villages[sourceVillageId]
  const tile = state.tiles[targetTileId]
  if (!sourceVillage || !tile) return false
  const normalizedUnits = trimZeroUnits(units)
  const targetVillage = tile.villageId ? state.villages[tile.villageId] : null

  if (kind === 'shipment') {
    if (!targetVillage || targetVillage.ownerId !== sourceVillage.ownerId || targetVillage.id === sourceVillage.id) {
      return false
    }

    const payload = shipment ? trimZeroUnits(shipment as unknown as Record<string, number>) : {}
    const shipmentStock: ResourceStock = {
      wood: Math.max(0, Number(payload.wood ?? shipment?.wood ?? 0)),
      clay: Math.max(0, Number(payload.clay ?? shipment?.clay ?? 0)),
      iron: Math.max(0, Number(payload.iron ?? shipment?.iron ?? 0)),
      crop: Math.max(0, Number(payload.crop ?? shipment?.crop ?? 0)),
    }
    const total = shipmentStock.wood + shipmentStock.clay + shipmentStock.iron + shipmentStock.crop
    if (total <= 0) return false
    if (!canAfford(sourceVillage.resources, shipmentStock)) return false

    const merchantsUsed = Math.ceil(total / MERCHANT_CAPACITY_BY_TRIBE[sourceVillage.tribe])
    if (merchantsUsed > getAvailableMerchants(state, sourceVillage)) return false

    sourceVillage.resources = subtractStock(sourceVillage.resources, shipmentStock)
    const duration = travelTimeBySpeed(sourceVillage, targetVillage, MERCHANT_SPEED_BY_TRIBE[sourceVillage.tribe])
    const command: Command = {
      id: makeId(state, 'cmd'),
      kind,
      phase: 'outbound',
      ownerId: sourceVillage.ownerId,
      sourceVillageId,
      targetTileId,
      targetVillageId: targetVillage.id,
      units: {},
      loot: emptyStock(),
      shipment: shipmentStock,
      merchantsUsed,
      settlementKit: null,
      departAt: state.now,
      arriveAt: state.now + duration,
    }
    state.commands[command.id] = command
    addChronicle(state, `${sourceVillage.name} dispatched merchants to ${targetVillage.name}.`)
    return true
  }

  if (!Object.keys(normalizedUnits).length) return false

  for (const [unitId, count] of Object.entries(normalizedUnits)) {
    if ((sourceVillage.units[unitId] ?? 0) < count) return false
  }

  let settlementKit: ResourceStock | null = null
  if (kind === 'settle') {
    const settlerId = SETTLER_BY_TRIBE[sourceVillage.tribe]
    const owner = state.players[sourceVillage.ownerId]
    if (!owner || tile.villageId) return false
    if (owner.culturePoints < getNextVillageRequirementForPlayer(state, owner.id)) return false
    if (getTotalExpansionSlots(sourceVillage) <= sourceVillage.expansionSlotsUsed) return false
    if ((normalizedUnits[settlerId] ?? 0) < 3) return false
    if (!canAfford(sourceVillage.resources, SETTLEMENT_COST)) return false
    settlementKit = { ...SETTLEMENT_COST }
    sourceVillage.resources = subtractStock(sourceVillage.resources, settlementKit)
  }
  if (kind === 'conquer') {
    const commanderId = COMMANDER_BY_TRIBE[sourceVillage.tribe]
    if (!targetVillage || targetVillage.ownerId === sourceVillage.ownerId) return false
    if ((normalizedUnits[commanderId] ?? 0) < 1) return false
    if (!canLaunchConquest(state, sourceVillage, normalizedUnits[commanderId] ?? 0)) return false
  }

  for (const [unitId, count] of Object.entries(normalizedUnits)) {
    sourceVillage.units[unitId] -= count
  }

  const duration = targetVillage
    ? travelTimeSeconds(sourceVillage, targetVillage, normalizedUnits)
    : travelTimeToTile(sourceVillage, tile, normalizedUnits)
  const command: Command = {
    id: makeId(state, 'cmd'),
    kind,
    phase: 'outbound',
    ownerId: sourceVillage.ownerId,
    sourceVillageId,
    targetTileId,
    targetVillageId: targetVillage?.id ?? null,
    units: { ...normalizedUnits },
    loot: emptyStock(),
    shipment: null,
    merchantsUsed: 0,
    settlementKit,
    departAt: state.now,
    arriveAt: state.now + duration,
  }
  state.commands[command.id] = command
  addChronicle(
    state,
    `${sourceVillage.name} dispatched a ${kind} to (${tile.x}, ${tile.y}).`,
  )
  return true
}

function planAdvance(state: GameState, deltaSeconds: number): GameState {
  const nextState = cloneState(state)
  const target = nextState.now + Math.max(0, deltaSeconds)

  while (nextState.now < target) {
    const eventTime = nextEventTime(nextState, target)
    const delta = eventTime - nextState.now
    if (delta > 0) {
      Object.values(nextState.villages).forEach((village) => {
        updateVillageEconomy(village, delta)
        updateVillageLoyalty(village, delta)
      })
      updateCulturePoints(nextState, delta)
      nextState.now = eventTime
    }
    processBuildQueues(nextState)
    processTrainingQueues(nextState)
    processCommandArrivals(nextState)
    Object.values(nextState.players)
      .filter((player) => !player.isHuman && player.nextAiPlanAt <= nextState.now)
      .forEach((player) => issueAiPlan(nextState, player.id))
  }

  return nextState
}

export function advanceGame(state: GameState, deltaSeconds: number): GameState {
  return planAdvance(state, deltaSeconds)
}

export function queueFieldUpgrade(state: GameState, villageId: string, slotId: string): GameState {
  const nextState = cloneState(state)
  const village = nextState.villages[villageId]
  const slot = village ? getFieldSlot(village, slotId) : null
  if (!village || !slot) return state
  const success = startConstruction(nextState, villageId, slot.gid, slotId)
  return success ? nextState : state
}

export function queueCenterBuild(state: GameState, villageId: string, slotId: string, gid: number): GameState {
  const nextState = cloneState(state)
  const success = startConstruction(nextState, villageId, gid, slotId)
  return success ? nextState : state
}

export function trainUnit(state: GameState, villageId: string, unitId: string, quantity: number): GameState {
  const nextState = cloneState(state)
  const success = startTraining(nextState, villageId, unitId, quantity)
  return success ? nextState : state
}

export function issueCommand(
  state: GameState,
  sourceVillageId: string,
  targetTileId: string,
  units: Record<string, number>,
  kind: CommandType,
): GameState {
  const nextState = cloneState(state)
  const success = sendCommand(nextState, sourceVillageId, targetTileId, units, kind)
  return success ? nextState : state
}

export function recallCommand(state: GameState, commandId: string): GameState {
  const nextState = cloneState(state)
  const success = recallOutboundCommand(nextState, commandId)
  return success ? nextState : state
}

export function shipResources(
  state: GameState,
  sourceVillageId: string,
  targetTileId: string,
  shipment: ResourceStock,
): GameState {
  const nextState = cloneState(state)
  const success = sendCommand(nextState, sourceVillageId, targetTileId, {}, 'shipment', shipment)
  return success ? nextState : state
}

export function selectVillage(state: GameState, villageId: string): GameState {
  if (!state.villages[villageId]) return state
  return { ...state, selectedVillageId: villageId }
}

export function resetGame(): null {
  return null
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatWorldTime(seconds: number): string {
  const days = Math.floor(seconds / 86400) + 1
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `Day ${days}, ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function getTileViewport(state: GameState, centerTileId: string, radius = 5): Tile[] {
  const center = state.tiles[centerTileId]
  if (!center) return []
  const tiles: Tile[] = []
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      const tile = state.tiles[tileId(x, y)]
      if (tile) tiles.push(tile)
    }
  }
  return tiles
}

export function getTileLabel(tile: Tile): string {
  return RESOURCE_PATTERNS[tile.patternIndex].label
}

export function getPlayerVillages(state: GameState, playerId: string): Village[] {
  const player = state.players[playerId]
  return player ? player.villageIds.map((villageId) => state.villages[villageId]) : []
}

export function getHumanPlayer(state: GameState): Player {
  return Object.values(state.players).find((player) => player.isHuman) as Player
}

export function getMarketplaceStatus(state: GameState, villageId: string): MarketplaceStatus {
  const village = state.villages[villageId]
  if (!village) {
    return { total: 0, busy: 0, available: 0, capacityPerMerchant: 0, maxShipment: 0 }
  }

  const total = getTotalMerchants(village)
  const busy = getBusyMerchants(state, village)
  const available = Math.max(0, total - busy)
  const capacityPerMerchant = MERCHANT_CAPACITY_BY_TRIBE[village.tribe]

  return {
    total,
    busy,
    available,
    capacityPerMerchant,
    maxShipment: available * capacityPerMerchant,
  }
}

export function getConquestPreview(
  state: GameState,
  sourceVillageId: string,
  targetVillageId: string,
  units: Record<string, number>,
): ConquestPreview {
  const sourceVillage = state.villages[sourceVillageId]
  const targetVillage = state.villages[targetVillageId]
  if (!sourceVillage || !targetVillage) {
    return { allowed: false, blockers: ['Target village is unavailable.'] }
  }

  const blockers: string[] = []
  const normalizedUnits = trimZeroUnits(units)
  const commanderId = COMMANDER_BY_TRIBE[sourceVillage.tribe]
  const catapultCount =
    (normalizedUnits.fireCatapult ?? 0) + (normalizedUnits.catapult ?? 0) + (normalizedUnits.trebuchet ?? 0)
  const administrationLevel = getAdministrationLevel(targetVillage)
  const catapultDamage = catapultCount > 0 ? Math.max(1, Math.floor(catapultCount / 8)) : 0
  const attacker = state.players[sourceVillage.ownerId]

  if (targetVillage.ownerId === sourceVillage.ownerId) {
    blockers.push('Choose an enemy village.')
  }
  if ((normalizedUnits[commanderId] ?? 0) < 1) {
    blockers.push(`Select at least one ${UNIT_DEFINITIONS[commanderId].name}.`)
  }
  if (!canLaunchConquest(state, sourceVillage, normalizedUnits[commanderId] ?? 0)) {
    blockers.push('No free Residence or Palace expansion slot in the source village.')
  }
  if (targetVillage.isCapital) {
    blockers.push('Capitals cannot be conquered.')
  }
  if (administrationLevel > catapultDamage) {
    blockers.push(
      catapultCount > 0
        ? 'Residence or Palace will still be standing after this wave.'
        : 'Residence or Palace is still standing. Bring catapults or clear it first.',
    )
  }
  if (attacker && attacker.culturePoints < getNextVillageRequirementForPlayer(state, attacker.id)) {
    blockers.push(
      `Need ${Math.ceil(
        getNextVillageRequirementForPlayer(state, attacker.id) - attacker.culturePoints,
      ).toLocaleString()} more culture points before taking another village.`,
    )
  }

  return {
    allowed: blockers.length === 0,
    blockers,
  }
}

export function summarizeVillage(state: GameState, villageId: string) {
  const village = state.villages[villageId]
  return {
    population: getPopulation(village),
    culturePointsPerDay: getCulturePointRate(village),
    production: getVillageProduction(village),
    storage: getStorageCapacity(village),
    military: getVillageMilitaryStrength(village),
    expansionSlots: getTotalExpansionSlots(village),
    loyalty: village.loyalty,
    merchants: getMarketplaceStatus(state, villageId),
  }
}

export function getExpansionStatus(state: GameState, villageId: string): ExpansionStatus {
  const village = state.villages[villageId]
  const player = state.players[village.ownerId]
  const totalSlots = getTotalExpansionSlots(village)
  const committedSettlers = getCommittedSettlerCount(state, village)
  const committedCommanders = getCommittedCommanderCount(state, village)
  const remainingSettlerCapacity = getRemainingSettlerCapacity(state, village)
  const nextVillageRequirement = getNextVillageRequirementForPlayer(state, player.id)

  return {
    totalSlots,
    usedSlots: village.expansionSlotsUsed,
    committedSettlers,
    committedCommanders,
    readyCommanders: village.units[COMMANDER_BY_TRIBE[village.tribe]] ?? 0,
    availableExpansionSlots: getAvailableExpansionSlots(state, village),
    remainingSettlerCapacity,
    readySettlers: village.units[SETTLER_BY_TRIBE[village.tribe]] ?? 0,
    residenceLevel: getBuildingLevel(village, 25),
    palaceLevel: getBuildingLevel(village, 26),
    nextVillageRequirement,
    culturePoints: player.culturePoints,
    culturePointsNeeded: Math.max(0, nextVillageRequirement - player.culturePoints),
    settlementResourcesReady: canAfford(village.resources, SETTLEMENT_COST),
    canSendSettlers: canLaunchSettlement(state, village),
  }
}
