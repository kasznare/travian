import { useRef, useState, type ChangeEvent } from 'react'
import './App.css'
import {
  advanceGame,
  createNewGame,
  formatDuration,
  formatWorldTime,
  getConquestPreview,
  getExpansionStatus,
  getHumanPlayer,
  getMarketplaceStatus,
  getPlayerVillages,
  getTileLabel,
  getTileViewport,
  issueCommand,
  listTrainableUnits,
  listVillageBuildOptions,
  queueCenterBuild,
  queueFieldUpgrade,
  recallCommand,
  resetGame,
  selectVillage,
  shipResources,
  summarizeVillage,
  trainUnit,
  type GameConfig,
  type GameState,
  type Tile,
} from './game/engine'
import {
  BUILDING_METADATA,
  RESOURCE_KEYS,
  RESOURCE_PATTERNS,
  SETTLER_BY_TRIBE,
  TRIBE_LABEL,
  UNIT_DEFINITIONS,
  officialBuildingById,
  type ResourceKey,
  type Tribe,
} from './game/rules'
import {
  type BuildingArtKind,
  BuildingIllustration,
  ResourceIllustration,
  TileIllustration,
} from './ui/illustrations'

const SAVE_KEY = 'travian-offline-save'
const SAVE_META_KEY = 'travian-offline-save-meta'
const DEFAULT_SEED = Math.floor(Date.now() % 1000000)
const SETTLER_UNIT_IDS = new Set(Object.values(SETTLER_BY_TRIBE))
const WORLD_CENTER_TILE_ID = '0:0'
const MAP_RADIUS_OPTIONS = [4, 6, 8, 10, 12] as const

type TabId = 'settlement' | 'map' | 'army' | 'reports'
type SettlementView = 'fields' | 'center'

interface SceneSlotPosition {
  left: number
  top: number
}

interface BuildLevelInfo {
  cost: {
    wood: number
    clay: number
    iron: number
    crop: number
  }
  time: number
}

function createRadialLayout(
  count: number,
  radiusX: number,
  radiusY: number,
  centerX = 50,
  centerY = 50,
  startAngle = -90,
): SceneSlotPosition[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = ((startAngle + (360 / count) * index) * Math.PI) / 180
    return {
      left: Number((centerX + Math.cos(angle) * radiusX).toFixed(2)),
      top: Number((centerY + Math.sin(angle) * radiusY).toFixed(2)),
    }
  })
}

const FIELD_LAYOUT = createRadialLayout(18, 39, 36, 50, 52)
const CENTER_LAYOUT = createRadialLayout(12, 30, 26, 50, 54)
const FIELD_CLUSTER_LAYOUT: Record<ResourceKey, { className: string; positions: SceneSlotPosition[] }> = {
  wood: {
    className: 'wood-cluster',
    positions: [
      { left: 24, top: 56 },
      { left: 46, top: 26 },
      { left: 70, top: 48 },
      { left: 48, top: 78 },
    ],
  },
  clay: {
    className: 'clay-cluster',
    positions: [
      { left: 18, top: 42 },
      { left: 39, top: 22 },
      { left: 64, top: 28 },
      { left: 78, top: 54 },
      { left: 48, top: 72 },
    ],
  },
  iron: {
    className: 'iron-cluster',
    positions: [
      { left: 22, top: 60 },
      { left: 42, top: 30 },
      { left: 68, top: 42 },
      { left: 54, top: 74 },
    ],
  },
  crop: {
    className: 'crop-cluster',
    positions: [
      { left: 17, top: 36 },
      { left: 36, top: 62 },
      { left: 30, top: 24 },
      { left: 62, top: 24 },
      { left: 70, top: 60 },
      { left: 85, top: 36 },
    ],
  },
}

interface SaveMeta {
  savedAt: number
}

interface ExportedSaveFile {
  version: 1
  exportedAt: string
  game: GameState
}

function loadGame(): GameState | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY)
    return raw ? (JSON.parse(raw) as GameState) : null
  } catch {
    return null
  }
}

function loadSaveMeta(): SaveMeta | null {
  try {
    const raw = window.localStorage.getItem(SAVE_META_KEY)
    if (!raw) return null
    const meta = JSON.parse(raw) as Partial<SaveMeta>
    return typeof meta.savedAt === 'number' ? { savedAt: meta.savedAt } : null
  } catch {
    return null
  }
}

function saveGame(state: GameState | null): number | null {
  if (!state) {
    window.localStorage.removeItem(SAVE_KEY)
    window.localStorage.removeItem(SAVE_META_KEY)
    return null
  }
  const savedAt = Date.now()
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  window.localStorage.setItem(SAVE_META_KEY, JSON.stringify({ savedAt } satisfies SaveMeta))
  return savedAt
}

function isGameStateCandidate(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<GameState>
  return (
    typeof candidate.now === 'number' &&
    typeof candidate.selectedVillageId === 'string' &&
    !!candidate.players &&
    !!candidate.villages &&
    !!candidate.tiles
  )
}

function parseImportedSave(raw: string): GameState | null {
  try {
    const parsed = JSON.parse(raw) as GameState | ExportedSaveFile
    if (isGameStateCandidate(parsed)) {
      return parsed
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      'game' in parsed &&
      isGameStateCandidate((parsed as ExportedSaveFile).game)
    ) {
      return (parsed as ExportedSaveFile).game
    }
    return null
  } catch {
    return null
  }
}

function formatSavedAt(savedAt: number | null): string {
  return savedAt ? new Date(savedAt).toLocaleString() : 'No local save yet'
}

function quantityLabel(value: number): string {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)).toLocaleString() : '0'
}

function getFieldResourceKey(gid: 1 | 2 | 3 | 4): (typeof RESOURCE_KEYS)[number] {
  if (gid === 1) return 'wood'
  if (gid === 2) return 'clay'
  if (gid === 3) return 'iron'
  return 'crop'
}

function formatResourceStock(stock: { wood: number; clay: number; iron: number; crop: number }): string {
  return `${quantityLabel(stock.wood)}/${quantityLabel(stock.clay)}/${quantityLabel(stock.iron)}/${quantityLabel(stock.crop)}`
}

function getBuildLevelInfo(buildingGid: number, level: number): BuildLevelInfo | null {
  const building = officialBuildingById[buildingGid]
  if (!building) return null
  const levelData = (building.levelData as Record<
    string,
    | {
        resourceCost: {
          r1: number
          r2: number
          r3: number
          r4: number
        }
        buildingTime: number
      }
    | undefined
  >)[String(level)]
  if (!levelData) return null
  return {
    cost: {
      wood: levelData.resourceCost.r1,
      clay: levelData.resourceCost.r2,
      iron: levelData.resourceCost.r3,
      crop: levelData.resourceCost.r4,
    },
    time: levelData.buildingTime,
  }
}

function tileStateClass(tile: Tile, selected: boolean, occupiedByHuman: boolean): string {
  const status = !tile.villageId ? 'empty' : occupiedByHuman ? 'human' : 'occupied'
  return selected ? `${status} selected` : status
}

function tileClass(tile: Tile, selected: boolean, occupiedByHuman: boolean): string {
  return `map-tile ${tileStateClass(tile, selected, occupiedByHuman)}`
}

function getBuildingArtKind(buildingGid: number | null): BuildingArtKind {
  switch (buildingGid) {
    case 15:
      return 'hall'
    case 10:
    case 11:
      return 'storage'
    case 16:
    case 19:
    case 20:
    case 21:
      return 'military'
    case 17:
      return 'trade'
    case 22:
      return 'research'
    case 25:
    case 26:
      return 'residence'
    case 23:
      return 'vault'
    case 31:
    case 32:
    case 33:
      return 'wall'
    default:
      return buildingGid ? 'hall' : 'empty'
  }
}

function getTileArtKind(tile: Tile, occupiedByHuman: boolean): 'empty' | 'occupied' | 'human' {
  if (!tile.villageId) return 'empty'
  return occupiedByHuman ? 'human' : 'occupied'
}

function getDispatchKey(villageId: string, unitId: string): string {
  return `${villageId}:${unitId}`
}

function getShipmentKey(sourceVillageId: string, targetVillageId: string, resourceKey: string): string {
  return `${sourceVillageId}:${targetVillageId}:${resourceKey}`
}

function formatUnitSummary(units: Record<string, number>): string {
  return Object.entries(units)
    .filter(([, count]) => count > 0)
    .map(([unitId, count]) => `${UNIT_DEFINITIONS[unitId].name} x${count}`)
    .join(', ')
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function App() {
  const [game, setGame] = useState<GameState | null>(() => loadGame())
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(() => loadSaveMeta()?.savedAt ?? null)
  const [saveNotice, setSaveNotice] = useState<string>('Autosave keeps the latest session on this device.')
  const [tab, setTab] = useState<TabId>('settlement')
  const [settlementView, setSettlementView] = useState<SettlementView>('fields')
  const [customHours, setCustomHours] = useState('12')
  const [focusedTileId, setFocusedTileId] = useState('0:0')
  const [mapRadius, setMapRadius] = useState(6)
  const [dispatchUnits, setDispatchUnits] = useState<Record<string, string>>({})
  const [shipmentDraft, setShipmentDraft] = useState<Record<string, string>>({})
  const [trainAmounts, setTrainAmounts] = useState<Record<string, string>>({})
  const [selectedFieldSlotId, setSelectedFieldSlotId] = useState('')
  const [selectedCenterSlotId, setSelectedCenterSlotId] = useState('')
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [newGameConfig, setNewGameConfig] = useState<GameConfig>({
    playerName: 'Player',
    tribe: 'romans',
    aiCount: 23,
    seed: DEFAULT_SEED,
  })

  const resetTransientUiState = () => {
    setDispatchUnits({})
    setShipmentDraft({})
    setTrainAmounts({})
    setSettlementView('fields')
    setSelectedFieldSlotId('')
    setSelectedCenterSlotId('')
    setMapRadius(6)
  }

  const commitGame = (nextGame: GameState | null) => {
    const savedAt = saveGame(nextGame)
    setLastSavedAt(savedAt)
    setGame(nextGame)
  }

  const persistCurrentGame = () => {
    if (!game) return
    const savedAt = saveGame(game)
    setLastSavedAt(savedAt)
    setSaveNotice('Saved to local storage.')
  }

  const exportCurrentGame = () => {
    if (!game) return
    const payload: ExportedSaveFile = {
      version: 1,
      exportedAt: new Date().toISOString(),
      game,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const day = Math.floor(game.now / 86400) + 1
    anchor.href = url
    anchor.download = `travian-offline-day-${day}.json`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(url)
    setSaveNotice('Exported save file.')
  }

  const openImportPicker = () => {
    importInputRef.current?.click()
  }

  const importSaveFile = async (file: File) => {
    const raw = await file.text()
    const importedGame = parseImportedSave(raw)
    if (!importedGame) {
      setSaveNotice('Import failed: unsupported or invalid save file.')
      return
    }
    commitGame(importedGame)
    setFocusedTileId(importedGame.villages[importedGame.selectedVillageId]?.tileId ?? WORLD_CENTER_TILE_ID)
    resetTransientUiState()
    setSaveNotice(`Imported ${file.name}.`)
  }

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!file) return
    await importSaveFile(file)
  }

  if (!game) {
    return (
      <main className="shell setup-shell">
        <section className="setup-hero">
          <p className="eyebrow">Classic 3-tribe sandbox</p>
          <h1>Travian Offline</h1>
          <p className="setup-copy">
            A static, local-first strategy sandbox with deterministic simulation, time skipping,
            map play, founding new settlements, and AI rivals driven by tribe-aware rules.
          </p>
        </section>

        <section className="setup-card">
          <div className="setup-grid">
            <label>
              <span>Ruler name</span>
              <input
                value={newGameConfig.playerName}
                onChange={(event) =>
                  setNewGameConfig((current) => ({
                    ...current,
                    playerName: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <span>Tribe</span>
              <select
                value={newGameConfig.tribe}
                onChange={(event) =>
                  setNewGameConfig((current) => ({
                    ...current,
                    tribe: event.target.value as Tribe,
                  }))
                }
              >
                <option value="romans">Romans</option>
                <option value="teutons">Teutons</option>
                <option value="gauls">Gauls</option>
              </select>
            </label>

            <label>
              <span>AI rivals</span>
              <input
                type="number"
                min={6}
                max={40}
                value={newGameConfig.aiCount}
                onChange={(event) =>
                  setNewGameConfig((current) => ({
                    ...current,
                    aiCount: Number(event.target.value),
                  }))
                }
              />
            </label>

            <label>
              <span>World seed</span>
              <input
                type="number"
                value={newGameConfig.seed}
                onChange={(event) =>
                  setNewGameConfig((current) => ({
                    ...current,
                    seed: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>

          <div className="setup-actions">
            <button
              className="primary-button"
              onClick={() => {
                const nextGame = createNewGame(newGameConfig)
                commitGame(nextGame)
                setFocusedTileId(nextGame.villages[nextGame.selectedVillageId].tileId)
                resetTransientUiState()
                setSaveNotice('New campaign started.')
              }}
            >
              Start campaign
            </button>
            <button className="secondary-button" onClick={openImportPicker}>
              Import save
            </button>
          </div>

          <div className="queue-card">
            <strong>Persistence</strong>
            <span>{saveNotice}</span>
            <span>Last local save: {formatSavedAt(lastSavedAt)}</span>
          </div>

          <div className="setup-notes">
            <div>
              <strong>Current scope</strong>
              <p>Core economy, troop training, attacks, conquest, merchant shipments, time skipping, AI rivals, and new villages.</p>
            </div>
            <div>
              <strong>Not in this cut yet</strong>
              <p>Hero, oasis, alliances, artifacts, World Wonder, and deeper diplomacy/agent behavior.</p>
            </div>
          </div>
          <input
            ref={importInputRef}
            className="hidden-input"
            type="file"
            accept="application/json,.json"
            onChange={handleImportChange}
          />
        </section>
      </main>
    )
  }

  const humanPlayer = getHumanPlayer(game)
  const humanVillages = getPlayerVillages(game, humanPlayer.id)
  const selectedVillage = game.villages[game.selectedVillageId]
  const villageSummary = summarizeVillage(game, selectedVillage.id)
  const selectedMarketplace = getMarketplaceStatus(game, selectedVillage.id)
  const buildOptions = listVillageBuildOptions(game, selectedVillage.id)
  const trainOptions = listTrainableUnits(game, selectedVillage.id)
  const selectedFieldSlot =
    selectedVillage.fieldSlots.find((slot) => slot.id === selectedFieldSlotId) ?? selectedVillage.fieldSlots[0]
  const selectedCenterSlot =
    selectedVillage.centerSlots.find((slot) => slot.id === selectedCenterSlotId) ?? selectedVillage.centerSlots[0]
  const selectedFieldResourceKey = getFieldResourceKey(selectedFieldSlot.gid)
  const fieldSlotsByResource: Record<ResourceKey, typeof selectedVillage.fieldSlots> = {
    wood: selectedVillage.fieldSlots.filter((slot) => slot.gid === 1),
    clay: selectedVillage.fieldSlots.filter((slot) => slot.gid === 2),
    iron: selectedVillage.fieldSlots.filter((slot) => slot.gid === 3),
    crop: selectedVillage.fieldSlots.filter((slot) => slot.gid === 4),
  }
  const selectedCenterOptions = buildOptions.filter((option) => option.slotId === selectedCenterSlot.id)
  const selectedCenterUpgrade = selectedCenterSlot.buildingGid
    ? selectedCenterOptions.find((option) => option.gid === selectedCenterSlot.buildingGid) ?? null
    : null
  const selectedFieldUpgrade = getBuildLevelInfo(selectedFieldSlot.gid, selectedFieldSlot.level + 1)
  const selectedFieldQueue =
    Object.values(selectedVillage.buildQueues).find((queue) => queue?.targetSlotId === selectedFieldSlot.id) ?? null
  const selectedCenterQueue =
    Object.values(selectedVillage.buildQueues).find((queue) => queue?.targetSlotId === selectedCenterSlot.id) ?? null
  const selectedVillageOrders = [
    ...Object.values(selectedVillage.buildQueues)
      .filter(Boolean)
      .map((queue) => ({
        id: queue!.id,
        label: BUILDING_METADATA[queue!.buildingGid].name,
        detail: `L${queue!.targetLevel}`,
        eta: formatDuration(Math.max(0, queue!.completeAt - game.now)),
        completeAt: queue!.completeAt,
      })),
    ...Object.values(selectedVillage.trainingQueues)
      .filter(Boolean)
      .map((queue) => ({
        id: queue!.id,
        label: UNIT_DEFINITIONS[queue!.unitId].name,
        detail: `x${queue!.quantity}`,
        eta: formatDuration(Math.max(0, queue!.completeAt - game.now)),
        completeAt: queue!.completeAt,
      })),
  ].sort((left, right) => left.completeAt - right.completeAt)
  const selectedVillageTroops = Object.entries(selectedVillage.units)
    .filter(([, count]) => count > 0)
    .sort(([, left], [, right]) => right - left)
  const selectedVillageTroopTotal = selectedVillageTroops.reduce((total, [, count]) => total + count, 0)
  const selectedVillageGarrison = selectedVillageTroops.slice(0, 4)
  const recentChronicle = game.chronicle.slice(0, 2)
  const activeFocusedTileId = focusedTileId || selectedVillage.tileId
  const viewportTiles = getTileViewport(game, activeFocusedTileId, mapRadius)
  const worldOverviewTiles = getTileViewport(game, WORLD_CENTER_TILE_ID, game.mapRadius)
  const availableMapRadiusOptions = MAP_RADIUS_OPTIONS.filter((radius) => radius <= game.mapRadius)
  const focusedTile = game.tiles[activeFocusedTileId] ?? game.tiles[selectedVillage.tileId]
  const focusedVillage = focusedTile?.villageId ? game.villages[focusedTile.villageId] : null
  const focusedVillageSummary = focusedVillage ? summarizeVillage(game, focusedVillage.id) : null
  const settlerUnit = UNIT_DEFINITIONS[SETTLER_BY_TRIBE[humanPlayer.tribe]]
  const expansionStatus = getExpansionStatus(game, selectedVillage.id)
  const selectedVillageDispatchUnits = Object.entries(selectedVillage.units)
    .filter(([unitId, count]) => count > 0 && !SETTLER_UNIT_IDS.has(unitId))
    .map(([unitId, count]) => ({
      unit: UNIT_DEFINITIONS[unitId],
      available: count,
      value: Math.min(
        count,
        Math.max(0, Number(dispatchUnits[getDispatchKey(selectedVillage.id, unitId)] ?? 0) || 0),
      ),
    }))
  const selectedDispatchPlan = Object.fromEntries(
    selectedVillageDispatchUnits
      .filter((entry) => entry.value > 0)
      .map((entry) => [entry.unit.id, entry.value]),
  ) as Record<string, number>
  const selectedDispatchPower = Object.entries(selectedDispatchPlan).reduce(
    (total, [unitId, count]) => total + UNIT_DEFINITIONS[unitId].attack * count,
    0,
  )
  const selectedDispatchCount = Object.values(selectedDispatchPlan).reduce((total, count) => total + count, 0)
  const conquestPreview =
    focusedVillage && focusedVillage.ownerId !== humanPlayer.id
      ? getConquestPreview(game, selectedVillage.id, focusedVillage.id, selectedDispatchPlan)
      : null
  const shipmentPlan =
    focusedVillage && focusedVillage.ownerId === humanPlayer.id && focusedVillage.id !== selectedVillage.id
      ? {
          wood: Math.max(
            0,
            Number(shipmentDraft[getShipmentKey(selectedVillage.id, focusedVillage.id, 'wood')] ?? 0) || 0,
          ),
          clay: Math.max(
            0,
            Number(shipmentDraft[getShipmentKey(selectedVillage.id, focusedVillage.id, 'clay')] ?? 0) || 0,
          ),
          iron: Math.max(
            0,
            Number(shipmentDraft[getShipmentKey(selectedVillage.id, focusedVillage.id, 'iron')] ?? 0) || 0,
          ),
          crop: Math.max(
            0,
            Number(shipmentDraft[getShipmentKey(selectedVillage.id, focusedVillage.id, 'crop')] ?? 0) || 0,
          ),
        }
      : null
  const shipmentTotal = shipmentPlan
    ? shipmentPlan.wood + shipmentPlan.clay + shipmentPlan.iron + shipmentPlan.crop
    : 0
  const shipmentMerchantsNeeded =
    shipmentPlan && shipmentTotal > 0 && selectedMarketplace.capacityPerMerchant > 0
      ? Math.ceil(shipmentTotal / selectedMarketplace.capacityPerMerchant)
      : 0
  const shipmentBlockers: string[] = []
  if (shipmentPlan) {
    if (shipmentTotal <= 0) {
      shipmentBlockers.push('Enter a positive shipment amount.')
    }
    if (selectedMarketplace.available <= 0) {
      shipmentBlockers.push('No merchants are available in this village.')
    }
    if (shipmentMerchantsNeeded > selectedMarketplace.available) {
      shipmentBlockers.push(
        `Need ${shipmentMerchantsNeeded} merchants, only ${selectedMarketplace.available} are free.`,
      )
    }
    RESOURCE_KEYS.forEach((key) => {
      if (shipmentPlan[key] > selectedVillage.resources[key]) {
        shipmentBlockers.push(`Not enough ${key} in ${selectedVillage.name}.`)
      }
    })
  }
  const playerMovements = Object.values(game.commands)
    .filter((command) => {
      const targetVillage = command.targetVillageId ? game.villages[command.targetVillageId] : null
      return (
        command.ownerId === humanPlayer.id ||
        (!!targetVillage && targetVillage.ownerId === humanPlayer.id && command.ownerId !== humanPlayer.id)
      )
    })
    .sort((left, right) => left.arriveAt - right.arriveAt)
  const movementCards = playerMovements.map((command) => {
    const sourceVillage = game.villages[command.sourceVillageId]
    const targetVillage = command.targetVillageId ? game.villages[command.targetVillageId] : null
    const targetTile = game.tiles[command.targetTileId]
    const isIncoming =
      !!targetVillage && targetVillage.ownerId === humanPlayer.id && command.ownerId !== humanPlayer.id
    const destination = targetVillage
      ? targetVillage.name
      : targetTile
        ? `(${targetTile.x}, ${targetTile.y})`
        : 'Unknown'
    const origin = sourceVillage?.name ?? 'Unknown'
    const payload =
      command.kind === 'shipment'
        ? command.shipment
          ? `${quantityLabel(command.shipment.wood)}/${quantityLabel(command.shipment.clay)}/${quantityLabel(
              command.shipment.iron,
            )}/${quantityLabel(command.shipment.crop)} by ${command.merchantsUsed} merchants`
          : `${command.merchantsUsed} merchants returning`
        : formatUnitSummary(command.units)

    return {
      command,
      isIncoming,
      destination,
      origin,
      payload,
      eta: formatDuration(Math.max(0, command.arriveAt - game.now)),
      status: isIncoming ? 'Incoming' : command.phase === 'return' ? 'Returning' : 'Outbound',
      canRecall: command.ownerId === humanPlayer.id && command.phase === 'outbound',
    }
  })
  const movementBuckets = {
    incoming: movementCards.filter((entry) => entry.isIncoming),
    outbound: movementCards.filter((entry) => !entry.isIncoming && entry.command.phase === 'outbound'),
    returning: movementCards.filter((entry) => entry.command.phase === 'return'),
  }
  const settlementBlockers: string[] = []
  if (expansionStatus.totalSlots <= expansionStatus.usedSlots && expansionStatus.remainingSettlerCapacity <= 0) {
    settlementBlockers.push('No unused Residence or Palace expansion slot in this village')
  }
  if (expansionStatus.readySettlers < 3) {
    settlementBlockers.push(`Need 3 settlers ready in the village, currently ${expansionStatus.readySettlers}`)
  }
  if (!expansionStatus.settlementResourcesReady) {
    settlementBlockers.push('Need 750 wood, clay, iron, and crop for the settlement convoy')
  }
  if (expansionStatus.culturePointsNeeded > 0) {
    settlementBlockers.push(
      `Need ${Math.ceil(expansionStatus.culturePointsNeeded).toLocaleString()} more culture points`,
    )
  }
  const viewportStats = viewportTiles.reduce(
    (stats, tile) => {
      const village = tile.villageId ? game.villages[tile.villageId] : null
      if (!village) stats.open += 1
      else if (village.ownerId === humanPlayer.id) stats.owned += 1
      else stats.enemy += 1
      return stats
    },
    { open: 0, owned: 0, enemy: 0 },
  )
  const worldStats = worldOverviewTiles.reduce(
    (stats, tile) => {
      const village = tile.villageId ? game.villages[tile.villageId] : null
      if (!village) stats.open += 1
      else if (village.ownerId === humanPlayer.id) stats.owned += 1
      else stats.enemy += 1
      return stats
    },
    { open: 0, owned: 0, enemy: 0 },
  )
  const humanReports = game.reports.filter(
    (report) => report.attackerId === humanPlayer.id || report.defenderId === humanPlayer.id || !report.defenderId,
  )
  const immersiveMode = tab === 'settlement' || tab === 'map'

  const applyGameUpdate = (updater: (current: GameState) => GameState) => {
    commitGame(updater(game))
  }

  const clearDispatchPlan = () => {
    setDispatchUnits((current) => {
      const next = { ...current }
      selectedVillageDispatchUnits.forEach((entry) => {
        delete next[getDispatchKey(selectedVillage.id, entry.unit.id)]
      })
      return next
    })
  }

  const clearShipmentPlan = () => {
    if (!focusedVillage) return
    setShipmentDraft((current) => {
      const next = { ...current }
      RESOURCE_KEYS.forEach((key) => {
        delete next[getShipmentKey(selectedVillage.id, focusedVillage.id, key)]
      })
      return next
    })
  }

  const shiftFocus = (dx: number, dy: number) => {
    if (!focusedTile) return
    const nextTile = game.tiles[`${focusedTile.x + dx}:${focusedTile.y + dy}`]
    if (nextTile) {
      setFocusedTileId(nextTile.id)
    }
  }

  const sendStrike = (kind: 'raid' | 'attack' | 'conquer') => {
    if (!focusedTile) return
    if (!Object.keys(selectedDispatchPlan).length) return
    applyGameUpdate((current) =>
      issueCommand(current, selectedVillage.id, focusedTile.id, selectedDispatchPlan, kind),
    )
    clearDispatchPlan()
  }

  const sendSettlers = () => {
    if (!focusedTile) return
    applyGameUpdate((current) =>
      issueCommand(current, selectedVillage.id, focusedTile.id, { [settlerUnit.id]: 3 }, 'settle'),
    )
  }

  const sendShipment = () => {
    if (!focusedTile || !shipmentPlan) return
    applyGameUpdate((current) => shipResources(current, selectedVillage.id, focusedTile.id, shipmentPlan))
    clearShipmentPlan()
  }

  const recallMovement = (commandId: string) => {
    applyGameUpdate((current) => recallCommand(current, commandId))
  }

  const immersiveSceneColumns = (
    <>
      <aside className="scene-overlay-column left">
        <article className="overlay-card">
          <div className="overlay-card-header">
            <p className="eyebrow">Inbox</p>
            <span>{recentChronicle.length}</span>
          </div>
          <div className="overlay-feed">
            {recentChronicle.map((entry) => (
              <div className="overlay-feed-row" key={entry.id}>
                <strong>{formatWorldTime(entry.createdAt)}</strong>
                <span>{entry.text}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="overlay-card">
          <p className="eyebrow">Link list</p>
          <div className="overlay-feed">
            <div className="overlay-feed-row">
              <strong>Save to device</strong>
              <span>{saveNotice}</span>
            </div>
            <div className="overlay-actions">
              <button className="secondary-button" onClick={persistCurrentGame}>
                Save
              </button>
              <button className="secondary-button" onClick={exportCurrentGame}>
                Export
              </button>
              <button className="secondary-button" onClick={openImportPicker}>
                Import
              </button>
            </div>
          </div>
        </article>
      </aside>

      <aside className="scene-overlay-column right">
        <article className="overlay-card village-name-card">
          <p className="eyebrow">Village</p>
          <span className="village-name-small">{humanPlayer.name}</span>
          <h2>{selectedVillage.name}</h2>
          <div className="overlay-stat-row">
            <span>Population</span>
            <strong>{villageSummary.population.toLocaleString()}</strong>
          </div>
          <div className="overlay-stat-row">
            <span>Loyalty</span>
            <strong>{Math.round(villageSummary.loyalty)}%</strong>
          </div>
          <div className="overlay-stat-row">
            <span>Culture / day</span>
            <strong>{villageSummary.culturePointsPerDay.toLocaleString()}</strong>
          </div>
        </article>

        <article className="overlay-card">
          <div className="overlay-card-header">
            <p className="eyebrow">Villages</p>
            <span>{humanVillages.length}</span>
          </div>
          <div className="overlay-village-list">
            {humanVillages.map((village) => (
              <button
                key={village.id}
                className={`overlay-village-button ${village.id === selectedVillage.id ? 'active' : ''}`}
                onClick={() => {
                  applyGameUpdate((current) => selectVillage(current, village.id))
                  setFocusedTileId(village.tileId)
                }}
              >
                <strong>{village.name}</strong>
                <span>
                  {village.x},{village.y}
                </span>
              </button>
            ))}
          </div>
        </article>

        <article className="overlay-card">
          <div className="overlay-card-header">
            <p className="eyebrow">Tasks</p>
            <span>{selectedVillageOrders.length}</span>
          </div>
          <div className="overlay-feed">
            {selectedVillageOrders.slice(0, 3).map((order) => (
              <div className="overlay-feed-row" key={order.id}>
                <strong>{order.label}</strong>
                <span>{order.detail}</span>
                <span>{order.eta}</span>
              </div>
            ))}
            {!selectedVillageOrders.length ? <span className="muted">No active construction or training orders.</span> : null}
          </div>
        </article>
      </aside>
    </>
  )

  const renderMapActionContent = () => {
    if (!focusedTile) {
      return <p className="muted">No tile selected.</p>
    }

    if (focusedVillage && focusedVillage.ownerId === humanPlayer.id) {
      return (
        <>
          <div className="queue-list">
            <div className="queue-card">
              <strong>{focusedVillage.name}</strong>
              <span>Population {focusedVillageSummary ? focusedVillageSummary.population.toLocaleString() : '0'}</span>
              <span>
                Merchants {focusedVillageSummary ? focusedVillageSummary.merchants.available : 0}/
                {focusedVillageSummary ? focusedVillageSummary.merchants.total : 0}
              </span>
            </div>
          </div>
          {focusedVillage.id !== selectedVillage.id ? (
            <>
              <div className="action-stack">
                <button
                  className="secondary-button"
                  onClick={() => {
                    applyGameUpdate((current) => selectVillage(current, focusedVillage.id))
                    setFocusedTileId(focusedVillage.tileId)
                  }}
                >
                  Select this village
                </button>
              </div>

              <div className="map-actions">
                <div className="shipment-grid">
                  {RESOURCE_KEYS.map((key) => (
                    <label key={key}>
                      <span>
                        {key} ({quantityLabel(selectedVillage.resources[key])})
                      </span>
                      <input
                        value={shipmentDraft[getShipmentKey(selectedVillage.id, focusedVillage.id, key)] ?? '0'}
                        onChange={(event) =>
                          setShipmentDraft((current) => ({
                            ...current,
                            [getShipmentKey(selectedVillage.id, focusedVillage.id, key)]: event.target.value,
                          }))
                        }
                        inputMode="numeric"
                      />
                    </label>
                  ))}
                </div>
                <div className="queue-list">
                  <div className="queue-card">
                    <strong>Shipment</strong>
                    <span>{quantityLabel(shipmentTotal)} total resources</span>
                    <span>
                      {shipmentMerchantsNeeded} / {selectedMarketplace.available} merchants needed
                    </span>
                  </div>
                </div>
                {shipmentPlan && shipmentBlockers.length ? (
                  <div className="report-list">
                    {shipmentBlockers.map((blocker) => (
                      <article className="report-card" key={blocker}>
                        <p>{blocker}</p>
                      </article>
                    ))}
                  </div>
                ) : null}
                <div className="action-stack">
                  <button
                    className="primary-button"
                    disabled={!shipmentPlan || shipmentBlockers.length > 0}
                    onClick={sendShipment}
                  >
                    Send resources
                  </button>
                  <button className="ghost-button" onClick={clearShipmentPlan}>
                    Clear shipment
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="muted">This is your current active village.</p>
          )}
        </>
      )
    }

    if (focusedVillage) {
      return (
        <>
          <p className="muted">Owned by {game.players[focusedVillage.ownerId].name}</p>
          <div className="queue-list">
            <div className="queue-card">
              <strong>{focusedVillage.name}</strong>
              <span>Population {focusedVillageSummary ? focusedVillageSummary.population.toLocaleString() : '0'}</span>
              <span>
                Defense {Math.round(focusedVillageSummary ? focusedVillageSummary.military.defense : 0).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="map-actions">
            <div className="dispatch-grid">
              {selectedVillageDispatchUnits.map((entry) => (
                <label key={entry.unit.id}>
                  <span>
                    {entry.unit.name} ({entry.available})
                  </span>
                  <input
                    value={dispatchUnits[getDispatchKey(selectedVillage.id, entry.unit.id)] ?? '0'}
                    onChange={(event) =>
                      setDispatchUnits((current) => ({
                        ...current,
                        [getDispatchKey(selectedVillage.id, entry.unit.id)]: event.target.value,
                      }))
                    }
                    inputMode="numeric"
                  />
                </label>
              ))}
            </div>
            <div className="queue-list">
              <div className="queue-card">
                <strong>Selected troops</strong>
                <span>{selectedDispatchCount.toLocaleString()} units</span>
                <span>{selectedDispatchPower.toLocaleString()} attack</span>
              </div>
            </div>
            {conquestPreview?.blockers.length ? (
              <div className="report-list">
                {conquestPreview.blockers.map((blocker) => (
                  <article className="report-card" key={blocker}>
                    <p>{blocker}</p>
                  </article>
                ))}
              </div>
            ) : null}
            <div className="action-stack">
              <button
                className="secondary-button"
                disabled={focusedVillage.ownerId === humanPlayer.id || selectedDispatchPower <= 0}
                onClick={() => sendStrike('raid')}
              >
                Raid
              </button>
              <button
                className="primary-button"
                disabled={focusedVillage.ownerId === humanPlayer.id || selectedDispatchPower <= 0}
                onClick={() => sendStrike('attack')}
              >
                Attack
              </button>
              <button
                className="primary-button"
                disabled={
                  focusedVillage.ownerId === humanPlayer.id ||
                  selectedDispatchPower <= 0 ||
                  !conquestPreview?.allowed
                }
                onClick={() => sendStrike('conquer')}
              >
                Conquer
              </button>
              <button className="ghost-button" onClick={clearDispatchPlan}>
                Clear selection
              </button>
            </div>
          </div>
        </>
      )
    }

    return (
      <>
        <p className="muted">Unoccupied terrain, ready for expansion.</p>
        <div className="queue-list">
          <div className="queue-card">
            <strong>Settlers</strong>
            <span>{expansionStatus.readySettlers} / 3 ready</span>
          </div>
          <div className="queue-card">
            <strong>Expansion slots</strong>
            <span>
              {expansionStatus.usedSlots}/{expansionStatus.totalSlots} used
            </span>
          </div>
          <div className="queue-card">
            <strong>Culture points</strong>
            <span>
              {Math.floor(expansionStatus.culturePoints).toLocaleString()} /{' '}
              {Math.ceil(expansionStatus.nextVillageRequirement).toLocaleString()}
            </span>
          </div>
        </div>
        {settlementBlockers.length ? (
          <div className="report-list">
            {settlementBlockers.map((blocker) => (
              <article className="report-card" key={blocker}>
                <p>{blocker}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Settlement convoy is ready. Founding will consume 3 settlers and 750 of each resource.</p>
        )}
        <div className="action-stack">
          <button className="primary-button" disabled={settlementBlockers.length > 0} onClick={sendSettlers}>
            Found a new village
          </button>
        </div>
      </>
    )
  }

  const renderImmersiveSettlement = () => (
    <section className="legends-settlement">
      <div className="legends-stage">
        <div className="scene-mode-switch">
          <button
            className={`mode-pill ${settlementView === 'fields' ? 'active' : ''}`}
            onClick={() => setSettlementView('fields')}
          >
            Resource fields
          </button>
          <button
            className={`mode-pill ${settlementView === 'center' ? 'active' : ''}`}
            onClick={() => setSettlementView('center')}
          >
            Village center
          </button>
        </div>

        {immersiveSceneColumns}

        {settlementView === 'fields' ? (
          <>
            <div className="legends-landscape">
              <div className="village-heart">
                <div className="village-heart-ring" />
                <div className="village-heart-core">
                  <BuildingIllustration kind="hall" className="village-heart-art" />
                  <strong>{selectedVillage.name}</strong>
                  <span>{RESOURCE_PATTERNS[selectedVillage.patternIndex].label}</span>
                </div>
              </div>

              {RESOURCE_KEYS.map((resourceKey) => {
                const cluster = FIELD_CLUSTER_LAYOUT[resourceKey]
                const slots = fieldSlotsByResource[resourceKey]
                return (
                  <div className={`resource-cluster ${cluster.className}`} key={resourceKey}>
                    <div className={`resource-terrain terrain-${resourceKey}`} />
                    {slots.map((slot, index) => {
                      const position = cluster.positions[index % cluster.positions.length]
                      return (
                        <button
                          key={slot.id}
                          className={`field-node resource-${resourceKey} ${
                            selectedFieldSlot.id === slot.id ? 'active' : ''
                          } ${slot.level > 0 ? 'built' : 'vacant'}`}
                          style={{ left: `${position.left}%`, top: `${position.top}%` }}
                          onClick={() => setSelectedFieldSlotId(slot.id)}
                          title={`${BUILDING_METADATA[slot.gid].name} level ${slot.level}`}
                        >
                          <ResourceIllustration kind={resourceKey} className="field-node-art" />
                          {slot.level > 0 ? <span className="field-node-level">{slot.level}</span> : null}
                        </button>
                      )
                    })}
                  </div>
                )
              })}

              <div className="scene-tooltip">
                <div className="scene-tooltip-head">
                  <ResourceIllustration kind={selectedFieldResourceKey} className="scene-tooltip-art" />
                  <div>
                    <strong>
                      {BUILDING_METADATA[selectedFieldSlot.gid].name} level {selectedFieldSlot.level}
                    </strong>
                    <span>
                      {titleCase(selectedFieldResourceKey)} field · slot {selectedFieldSlot.id.replace('field-', '')}
                    </span>
                  </div>
                </div>
                {selectedFieldUpgrade ? (
                  <>
                    <div className="tooltip-cost-grid">
                      {RESOURCE_KEYS.map((key) => (
                        <div className="tooltip-cost-chip" key={key}>
                          <span>{titleCase(key).slice(0, 2)}</span>
                          <strong>{quantityLabel(selectedFieldUpgrade.cost[key])}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="scene-tooltip-meta">
                      <span>Build time {formatDuration(selectedFieldUpgrade.time)}</span>
                      <span>
                        Output {quantityLabel(villageSummary.production[selectedFieldResourceKey])} / h
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="muted">This field has reached its current cap.</p>
                )}
                {selectedFieldQueue ? (
                  <p className="scene-tooltip-note">
                    Construction underway, done in {formatDuration(Math.max(0, selectedFieldQueue.completeAt - game.now))}
                  </p>
                ) : null}
                <button
                  className="primary-button scene-upgrade-button"
                  onClick={() =>
                    applyGameUpdate((current) => queueFieldUpgrade(current, selectedVillage.id, selectedFieldSlot.id))
                  }
                >
                  Upgrade field
                </button>
              </div>
            </div>

            <div className="floating-info-card production-floating-card">
              <p className="eyebrow">Production / hour</p>
              <div className="floating-info-list">
                {RESOURCE_KEYS.map((key) => (
                  <div className="floating-info-row" key={key}>
                    <ResourceIllustration kind={key} className="production-art" />
                    <span>{titleCase(key)}</span>
                    <strong>{quantityLabel(villageSummary.production[key])}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="floating-info-card troops-floating-card">
              <div className="overlay-card-header">
                <p className="eyebrow">Troops</p>
                <span>{selectedVillageTroopTotal}</span>
              </div>
              <div className="floating-info-list">
                {selectedVillageGarrison.map(([unitId, count]) => (
                  <div className="floating-info-row" key={unitId}>
                    <BuildingIllustration kind="military" className="production-art" />
                    <span>{UNIT_DEFINITIONS[unitId].name}</span>
                    <strong>{quantityLabel(count)}</strong>
                  </div>
                ))}
                {!selectedVillageGarrison.length ? <span className="muted">No units stationed.</span> : null}
              </div>
            </div>
          </>
        ) : (
          <div className="legends-center-landscape">
            <div className="center-ring-water" />
            <div className="center-ring-ground" />
            <div className="center-paths" />
            {selectedVillage.centerSlots.map((slot, index) => {
              const position = CENTER_LAYOUT[index % CENTER_LAYOUT.length]
              const buildable = buildOptions.filter((option) => option.slotId === slot.id)
              return (
                <button
                  key={slot.id}
                  className={`center-ring-node ${selectedCenterSlot.id === slot.id ? 'active' : ''} ${
                    slot.buildingGid ? 'built' : 'empty'
                  }`}
                  style={{ left: `${position.left}%`, top: `${position.top}%` }}
                  onClick={() => setSelectedCenterSlotId(slot.id)}
                  title={slot.buildingGid ? BUILDING_METADATA[slot.buildingGid].name : 'Empty lot'}
                >
                  <BuildingIllustration kind={getBuildingArtKind(slot.buildingGid)} className="center-node-art" />
                  {slot.level > 0 ? <span className="field-node-level">{slot.level}</span> : null}
                  {!slot.buildingGid ? <span className="empty-node-count">{buildable.length}</span> : null}
                </button>
              )
            })}
            <div className="center-tooltip-card">
              <div className="scene-tooltip-head">
                <BuildingIllustration
                  kind={getBuildingArtKind(selectedCenterSlot.buildingGid)}
                  className="scene-tooltip-art"
                />
                <div>
                  <strong>
                    {selectedCenterSlot.buildingGid
                      ? BUILDING_METADATA[selectedCenterSlot.buildingGid].name
                      : 'Empty building lot'}
                  </strong>
                  <span>
                    Slot {selectedCenterSlot.id.replace('center-', '')}
                    {selectedCenterSlot.buildingGid ? ` · level ${selectedCenterSlot.level}` : ' · ready to build'}
                  </span>
                </div>
              </div>
              {selectedCenterSlot.buildingGid && selectedCenterUpgrade ? (
                <>
                  <div className="tooltip-cost-grid">
                    {RESOURCE_KEYS.map((key) => (
                      <div className="tooltip-cost-chip" key={key}>
                        <span>{titleCase(key).slice(0, 2)}</span>
                        <strong>{quantityLabel(selectedCenterUpgrade.cost[key])}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="scene-tooltip-meta">
                    <span>Upgrade time {formatDuration(selectedCenterUpgrade.buildTime)}</span>
                    <span>Building level {selectedCenterSlot.level}</span>
                  </div>
                  <button
                    className="primary-button scene-upgrade-button"
                    onClick={() =>
                      applyGameUpdate((current) =>
                        queueCenterBuild(
                          current,
                          selectedVillage.id,
                          selectedCenterSlot.id,
                          selectedCenterSlot.buildingGid!,
                        ),
                      )
                    }
                  >
                    Upgrade building
                  </button>
                </>
              ) : (
                <div className="build-choice-list center-choice-list">
                  {selectedCenterOptions.map((option) => (
                    <button
                      className="ghost-button build-choice"
                      key={`${selectedCenterSlot.id}-${option.gid}`}
                      onClick={() =>
                        applyGameUpdate((current) =>
                          queueCenterBuild(current, selectedVillage.id, selectedCenterSlot.id, option.gid),
                        )
                      }
                    >
                      {option.label} · {formatResourceStock(option.cost)}
                    </button>
                  ))}
                  {!selectedCenterOptions.length ? (
                    <p className="muted">No center building is unlocked for this lot yet.</p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="construction-banner">
          <div className="construction-banner-header">
            <p className="eyebrow">Construction</p>
            <span>{selectedVillageOrders.length} active</span>
          </div>
          <div className="construction-banner-list">
            {selectedVillageOrders.slice(0, 4).map((order) => (
              <div className="construction-banner-row" key={order.id}>
                <strong>{order.label}</strong>
                <span>{order.detail}</span>
                <span>{order.eta}</span>
              </div>
            ))}
            {!selectedVillageOrders.length ? <span className="muted">No active construction or training orders.</span> : null}
          </div>
        </div>
      </div>
    </section>
  )

  const renderImmersiveMap = () => (
    <section className="legends-settlement legends-map-scene-shell">
      <div className="legends-stage legends-map-stage">
        <div className="scene-mode-switch map-mode-switch">
          <button className="mode-pill active" onClick={() => setFocusedTileId(selectedVillage.tileId)}>
            Focus {focusedTile ? `(${focusedTile.x}, ${focusedTile.y})` : 'tile'}
          </button>
          <button className="mode-pill" onClick={() => setFocusedTileId(selectedVillage.tileId)}>
            Recenter on village
          </button>
        </div>

        {immersiveSceneColumns}

        <div className="legends-map-frame">
          <div className="legends-map-frame-header">
            <div>
              <p className="eyebrow">Map</p>
              <h2>Local world</h2>
            </div>
            <div className="legends-map-toolbar">
              <div className="chip-row">
                {availableMapRadiusOptions.map((radius) => (
                  <button
                    key={radius}
                    className={`mode-pill map-chip ${mapRadius === radius ? 'active' : ''}`}
                    onClick={() => setMapRadius(radius)}
                  >
                    Radius {radius}
                  </button>
                ))}
              </div>
              <div className="chip-row">
                <button className="secondary-button" onClick={() => shiftFocus(0, -1)}>
                  North
                </button>
                <button className="secondary-button" onClick={() => shiftFocus(-1, 0)}>
                  West
                </button>
                <button className="secondary-button" onClick={() => shiftFocus(1, 0)}>
                  East
                </button>
                <button className="secondary-button" onClick={() => shiftFocus(0, 1)}>
                  South
                </button>
              </div>
            </div>
          </div>

          <div className="legends-map-frame-body">
            <div
              className="legends-map-grid"
              style={{ gridTemplateColumns: `repeat(${mapRadius * 2 + 1}, minmax(0, 1fr))` }}
            >
              {viewportTiles.map((tile) => {
                const occupant = tile.villageId ? game.villages[tile.villageId] : null
                const occupiedByHuman = occupant?.ownerId === humanPlayer.id
                return (
                  <button
                    key={tile.id}
                    className={`legends-map-tile ${tileStateClass(tile, tile.id === focusedTile?.id, occupiedByHuman)}`}
                    onClick={() => setFocusedTileId(tile.id)}
                    title={`${tile.x},${tile.y} ${occupant ? occupant.name : getTileLabel(tile)}`}
                  >
                    <span className="legend-map-tile-coords">
                      {tile.x},{tile.y}
                    </span>
                    <TileIllustration kind={getTileArtKind(tile, occupiedByHuman)} className="legend-map-art" />
                    {occupant ? <span className="legend-map-occupant">{occupant.ownerId === humanPlayer.id ? 'Y' : 'R'}</span> : null}
                  </button>
                )
              })}
            </div>

            <aside className="legends-mini-atlas">
              <div className="legends-mini-atlas-card">
                <p className="eyebrow">Mini-map</p>
                <div className="atlas-shell map-mini-shell">
                  <div
                    className="atlas-grid"
                    style={{ gridTemplateColumns: `repeat(${game.mapRadius * 2 + 1}, minmax(12px, 1fr))` }}
                  >
                    {worldOverviewTiles.map((tile) => {
                      const occupant = tile.villageId ? game.villages[tile.villageId] : null
                      const occupiedByHuman = occupant?.ownerId === humanPlayer.id
                      return (
                        <button
                          key={`immersive-overview-${tile.id}`}
                          className={`atlas-tile ${tileStateClass(tile, tile.id === focusedTile?.id, occupiedByHuman)}`}
                          onClick={() => setFocusedTileId(tile.id)}
                          title={`${tile.x},${tile.y} ${occupant ? occupant.name : getTileLabel(tile)}`}
                        >
                          <span>{tile.id}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="legends-mini-atlas-card">
                <p className="eyebrow">Focus</p>
                <div className="queue-list">
                  <div className="queue-card">
                    <strong>
                      {focusedTile ? `${focusedTile.x}, ${focusedTile.y}` : 'Unknown'}
                    </strong>
                    <span>{focusedTile ? RESOURCE_PATTERNS[focusedTile.patternIndex].label : 'No tile selected'}</span>
                    <span>{focusedVillage ? focusedVillage.name : 'Open terrain'}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <div className="legends-map-footer">
            <div className="summary-strip legends-map-summary">
              <div>
                <span>World tiles</span>
                <strong>{worldOverviewTiles.length}</strong>
              </div>
              <div>
                <span>Owned</span>
                <strong>{worldStats.owned}</strong>
              </div>
              <div>
                <span>Enemy</span>
                <strong>{worldStats.enemy}</strong>
              </div>
              <div>
                <span>Open</span>
                <strong>{viewportStats.open}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="map-command-dock">
          <article className="overlay-card map-intel-card">
            <p className="eyebrow">Tile intel</p>
            {focusedTile ? (
              <>
                <div className="inspector-art-card tile-art-card">
                  <TileIllustration
                    kind={getTileArtKind(focusedTile, focusedVillage?.ownerId === humanPlayer.id)}
                    className="inspector-art"
                  />
                  <div>
                    <strong>{focusedVillage ? focusedVillage.name : 'Unoccupied tile'}</strong>
                    <span>{focusedVillage ? getTileLabel(focusedTile) : 'Expansion target'}</span>
                  </div>
                </div>
                <div className="overlay-stat-row">
                  <span>Coordinates</span>
                  <strong>
                    {focusedTile.x}, {focusedTile.y}
                  </strong>
                </div>
                <div className="overlay-stat-row">
                  <span>Pattern</span>
                  <strong>{RESOURCE_PATTERNS[focusedTile.patternIndex].label}</strong>
                </div>
                {focusedVillageSummary ? (
                  <div className="overlay-stat-row">
                    <span>Loyalty</span>
                    <strong>{Math.round(focusedVillageSummary.loyalty)}%</strong>
                  </div>
                ) : null}
              </>
            ) : null}
          </article>

          <article className="overlay-card map-action-card">
            <div className="overlay-card-header">
              <p className="eyebrow">Orders</p>
              <span>{focusedVillage ? (focusedVillage.ownerId === humanPlayer.id ? 'Trade' : 'War') : 'Settle'}</span>
            </div>
            {renderMapActionContent()}
          </article>
        </div>
      </div>
    </section>
  )

  return (
    <main className={`shell ${immersiveMode ? 'immersive-shell' : ''}`}>
      <header className={`topbar ${immersiveMode ? 'legends-topbar' : ''}`}>
        <div className={`topbar-block ${immersiveMode ? 'hero-block' : ''}`}>
          {immersiveMode ? (
            <div className="hero-shell">
              <div className="hero-side-stack">
                <div className="server-pill">{formatWorldTime(game.now)}</div>
                <div className="brand-plaque">
                  <strong>TRAVIAN</strong>
                  <span>Legends offline</span>
                </div>
              </div>

              <div className="hero-cluster">
                <div className="hero-medallion">
                  <div className="hero-avatar">{humanPlayer.name.slice(0, 1).toUpperCase()}</div>
                  <span className="hero-level">{humanVillages.length}</span>
                </div>
                <div className="hero-copy">
                  <p className="eyebrow">Village view</p>
                  <h1>{formatWorldTime(game.now)}</h1>
                  <span>{TRIBE_LABEL[humanPlayer.tribe]}</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="eyebrow">World clock</p>
              <h1>{formatWorldTime(game.now)}</h1>
            </>
          )}
        </div>
        <div className={`topbar-block grow ${immersiveMode ? 'hud-center-block' : ''}`}>
          {immersiveMode ? (
            <div className="hud-main-stack">
              <nav className="hud-nav-strip">
                {(['settlement', 'map', 'army', 'reports'] as const).map((tabId) => (
                  <button
                    key={`hud-${tabId}`}
                    className={`hud-nav-button ${tab === tabId ? 'active' : ''}`}
                    onClick={() => setTab(tabId)}
                  >
                    {tabId === 'settlement' ? (
                      <BuildingIllustration kind="hall" className="hud-nav-art" />
                    ) : tabId === 'map' ? (
                      <TileIllustration kind="empty" className="hud-nav-art" />
                    ) : tabId === 'army' ? (
                      <BuildingIllustration kind="military" className="hud-nav-art" />
                    ) : (
                      <BuildingIllustration kind="research" className="hud-nav-art" />
                    )}
                    <span>{tabId}</span>
                  </button>
                ))}
              </nav>
              <div className="resource-strip legends-resource-strip">
                {RESOURCE_KEYS.map((key) => (
                  <div className="resource-pill legends-resource-pill" key={key}>
                    <div className="resource-pill-head">
                      <ResourceIllustration kind={key} className="hud-resource-art" />
                      <span className="resource-key">{key}</span>
                    </div>
                    <strong>{quantityLabel(selectedVillage.resources[key])}</strong>
                    <small>{quantityLabel(villageSummary.storage[key])} cap</small>
                    <div className="resource-meter">
                      <span
                        style={{
                          width: `${Math.max(
                            6,
                            Math.min(100, (selectedVillage.resources[key] / Math.max(1, villageSummary.storage[key])) * 100),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="resource-strip">
              {RESOURCE_KEYS.map((key) => (
                <div className="resource-pill" key={key}>
                  <span className="resource-key">{key}</span>
                  <strong>{quantityLabel(selectedVillage.resources[key])}</strong>
                  <small>{quantityLabel(villageSummary.storage[key])}</small>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={`topbar-block controls ${immersiveMode ? 'legends-controls' : ''}`}>
          {immersiveMode ? (
            <div className="topbar-utility-strip">
              <div className="utility-orbs">
                <button className="utility-orb">?</button>
                <button className="utility-orb">⚙</button>
                <button className="utility-orb">×</button>
              </div>
              <div className="coin-medallion">T</div>
            </div>
          ) : null}
          <div className={`skip-grid ${immersiveMode ? 'legends-skip-grid' : ''}`}>
            {[900, 3600, 21600, 86400].map((seconds) => (
              <button
                key={seconds}
                className="secondary-button"
                onClick={() => applyGameUpdate((current) => advanceGame(current, seconds))}
              >
                {seconds === 900 ? '15m' : `${seconds / 3600}h`}
              </button>
            ))}
          </div>
          <div className="custom-skip">
            <input
              value={customHours}
              onChange={(event) => setCustomHours(event.target.value)}
              inputMode="decimal"
            />
            <button
              className="primary-button"
              onClick={() =>
                applyGameUpdate((current) =>
                  advanceGame(current, Math.max(0, Number(customHours) || 0) * 3600),
                )
              }
            >
              Skip custom
            </button>
          </div>
        </div>
      </header>

      <section className={`frame ${immersiveMode ? 'immersive-frame' : ''}`}>
        {!immersiveMode ? (
        <aside className="sidebar">
          <div className="panel">
            <p className="eyebrow">Ruler</p>
            <h2>{humanPlayer.name}</h2>
            <p>{TRIBE_LABEL[humanPlayer.tribe]}</p>
            <p className="muted">
              Villages: {humanPlayer.villageIds.length} | next village at{' '}
              {Math.ceil(expansionStatus.nextVillageRequirement).toLocaleString()} CP
            </p>
            <p className="muted">
              Culture points: {Math.floor(humanPlayer.culturePoints).toLocaleString()} /{' '}
              {Math.ceil(expansionStatus.nextVillageRequirement).toLocaleString()}
            </p>
          </div>

          <div className="panel">
            <div className="panel-header">
              <p className="eyebrow">Villages</p>
              <button className="ghost-button" onClick={() => setTab('settlement')}>
                Open
              </button>
            </div>
            <div className="village-list">
              {humanVillages.map((village) => {
                const summary = summarizeVillage(game, village.id)
                return (
                  <button
                    key={village.id}
                    className={`village-button ${village.id === selectedVillage.id ? 'active' : ''}`}
                    onClick={() => {
                      applyGameUpdate((current) => selectVillage(current, village.id))
                      setFocusedTileId(village.tileId)
                    }}
                  >
                    <strong>{village.name}</strong>
                    <span>
                      {RESOURCE_PATTERNS[village.patternIndex].label} | pop{' '}
                      {summary.population.toLocaleString()}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="panel">
            <p className="eyebrow">Queues</p>
            <div className="queue-list">
              {Object.values(selectedVillage.buildQueues)
                .filter(Boolean)
                .map((queue) => (
                  <div className="queue-card" key={queue?.id}>
                    <strong>{BUILDING_METADATA[queue!.buildingGid].name}</strong>
                    <span>done in {formatDuration(queue!.completeAt - game.now)}</span>
                  </div>
                ))}
              {Object.values(selectedVillage.trainingQueues)
                .filter(Boolean)
                .map((queue) => (
                  <div className="queue-card" key={queue?.id}>
                    <strong>
                      {UNIT_DEFINITIONS[queue!.unitId].name} x{queue!.quantity}
                    </strong>
                    <span>done in {formatDuration(queue!.completeAt - game.now)}</span>
                  </div>
                ))}
              {!Object.values(selectedVillage.buildQueues).some(Boolean) &&
              !Object.values(selectedVillage.trainingQueues).some(Boolean) ? (
                <p className="muted">No active orders.</p>
              ) : null}
            </div>
          </div>

          <div className="panel">
            <p className="eyebrow">Movements</p>
            <div className="queue-list">
              {movementCards.map((entry) => {
                const { command } = entry
                return (
                  <div className="queue-card" key={command.id}>
                    <strong>
                      {entry.status} {command.kind}
                    </strong>
                    <span>
                      {entry.origin} {command.phase === 'return' ? '<-' : '->'} {entry.destination}
                    </span>
                    <span>{entry.payload}</span>
                    <span>arrives in {entry.eta}</span>
                    {entry.canRecall ? (
                      <button className="ghost-button inline-action" onClick={() => recallMovement(command.id)}>
                        Recall
                      </button>
                    ) : null}
                  </div>
                )
              })}
              {!movementCards.length ? <p className="muted">No troop movements.</p> : null}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <p className="eyebrow">World pulse</p>
              <button
                className="ghost-button"
                onClick={() => {
                  commitGame(resetGame())
                  setSaveNotice('Local save cleared.')
                }}
              >
                Reset
              </button>
            </div>
            <div className="chronicle-list">
              {game.chronicle.slice(0, 8).map((entry) => (
                <div className="chronicle-entry" key={entry.id}>
                  <small>{formatWorldTime(entry.createdAt)}</small>
                  <p>{entry.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <p className="eyebrow">Persistence</p>
            <div className="queue-list">
              <div className="queue-card">
                <strong>Autosave</strong>
                <span>{saveNotice}</span>
                <span>Last local save: {formatSavedAt(lastSavedAt)}</span>
              </div>
            </div>
            <div className="persist-actions">
              <button className="secondary-button" onClick={persistCurrentGame}>
                Save now
              </button>
              <button className="secondary-button" onClick={exportCurrentGame}>
                Export save
              </button>
              <button className="secondary-button" onClick={openImportPicker}>
                Import save
              </button>
            </div>
          </div>
        </aside>
        ) : null}

        <section className={`content ${immersiveMode ? 'immersive-content' : ''}`}>
          {!immersiveMode ? (
          <nav className="tab-row">
            {(['settlement', 'map', 'army', 'reports'] as const).map((tabId) => (
              <button
                key={tabId}
                className={`tab-button ${tab === tabId ? 'active' : ''}`}
                onClick={() => setTab(tabId)}
              >
                {tabId}
              </button>
            ))}
          </nav>
          ) : null}

          {tab === 'settlement' ? (
            immersiveMode ? (
              renderImmersiveSettlement()
            ) : (
            <section className="content-grid">
              <div className="panel wide">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Settlement</p>
                    <h2>{selectedVillage.name}</h2>
                  </div>
                  <div className="summary-strip">
                    <div>
                      <span>Population</span>
                      <strong>{villageSummary.population.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>Culture/day</span>
                      <strong>{villageSummary.culturePointsPerDay.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>Attack</span>
                      <strong>{Math.round(villageSummary.military.attack).toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>Loyalty</span>
                      <strong>{Math.round(villageSummary.loyalty)}%</strong>
                    </div>
                  </div>
                </div>

                <div className="settlement-toolbar">
                  <div className="chip-row">
                    <button
                      className={`tab-button ${settlementView === 'fields' ? 'active' : ''}`}
                      onClick={() => setSettlementView('fields')}
                    >
                      Fields map
                    </button>
                    <button
                      className={`tab-button ${settlementView === 'center' ? 'active' : ''}`}
                      onClick={() => setSettlementView('center')}
                    >
                      Village center
                    </button>
                  </div>
                  <p className="muted settlement-copy">
                    {settlementView === 'fields'
                      ? 'Outside the walls: resource fields, tracks, and the full settlement ring.'
                      : 'Inside the settlement: internal buildings, defensive line, and the village core.'}
                  </p>
                </div>

                <div className={`village-scene ${settlementView === 'fields' ? 'fields-scene' : 'center-scene'}`}>
                  <div className="scene-core">
                    <small>{settlementView === 'fields' ? 'Village ring' : 'Village plaza'}</small>
                    <strong>{selectedVillage.name}</strong>
                    <span>
                      {selectedVillage.x},{selectedVillage.y} · {RESOURCE_PATTERNS[selectedVillage.patternIndex].label}
                    </span>
                  </div>

                  {settlementView === 'fields'
                    ? selectedVillage.fieldSlots.map((slot, index) => {
                        const resourceKey = getFieldResourceKey(slot.gid)
                        const position = FIELD_LAYOUT[index % FIELD_LAYOUT.length]
                        return (
                          <button
                            key={slot.id}
                            className={`scene-slot field-slot resource-${resourceKey} ${
                              selectedFieldSlot.id === slot.id ? 'active' : ''
                            }`}
                            style={{ left: `${position.left}%`, top: `${position.top}%` }}
                            onClick={() => setSelectedFieldSlotId(slot.id)}
                          >
                            <span className="scene-slot-index">{index + 1}</span>
                            <ResourceIllustration kind={resourceKey} className="scene-slot-art" />
                            <div className="scene-slot-meta">
                              <strong>{BUILDING_METADATA[slot.gid].name}</strong>
                              <small>L{slot.level}</small>
                            </div>
                          </button>
                        )
                      })
                    : selectedVillage.centerSlots.map((slot, index) => {
                        const position = CENTER_LAYOUT[index % CENTER_LAYOUT.length]
                        const buildable = buildOptions.filter((option) => option.slotId === slot.id)
                        return (
                          <button
                            key={slot.id}
                            className={`scene-slot center-slot ${selectedCenterSlot.id === slot.id ? 'active' : ''} ${
                              slot.buildingGid ? 'built' : 'empty-lot'
                            }`}
                            style={{ left: `${position.left}%`, top: `${position.top}%` }}
                            onClick={() => setSelectedCenterSlotId(slot.id)}
                          >
                            <span className="scene-slot-index">{index + 1}</span>
                            <BuildingIllustration
                              kind={getBuildingArtKind(slot.buildingGid)}
                              className="scene-slot-art"
                            />
                            <div className="scene-slot-meta">
                              <strong>{slot.buildingGid ? BUILDING_METADATA[slot.buildingGid].name : 'Empty lot'}</strong>
                              <small>{slot.buildingGid ? `L${slot.level}` : `${buildable.length} options`}</small>
                            </div>
                          </button>
                        )
                      })}
                </div>
              </div>

              <div className="panel">
                <p className="eyebrow">{settlementView === 'fields' ? 'Field inspector' : 'Building inspector'}</p>
                {settlementView === 'fields' ? (
                  <>
                    <div className="inspector-art-card field-art-card">
                      <ResourceIllustration kind={selectedFieldResourceKey} className="inspector-art" />
                      <div>
                        <strong>{BUILDING_METADATA[selectedFieldSlot.gid].name}</strong>
                        <span>{titleCase(selectedFieldResourceKey)} production</span>
                      </div>
                    </div>
                    <h2>{BUILDING_METADATA[selectedFieldSlot.gid].name}</h2>
                    <p className="muted">
                      Slot {selectedFieldSlot.id.replace('field-', '')} · level {selectedFieldSlot.level}
                    </p>
                    <div className="queue-list">
                      <div className="queue-card">
                        <strong>Village output</strong>
                        <span>
                          {quantityLabel(villageSummary.production[selectedFieldResourceKey])} {selectedFieldResourceKey}
                          {' / h'}
                        </span>
                      </div>
                      <div className="queue-card">
                        <strong>Stock</strong>
                        <span>{quantityLabel(selectedVillage.resources[selectedFieldResourceKey])} in storage</span>
                      </div>
                      <div className="queue-card">
                        <strong>Pattern</strong>
                        <span>{RESOURCE_PATTERNS[selectedVillage.patternIndex].label}</span>
                      </div>
                    </div>
                    {selectedFieldQueue ? (
                      <div className="queue-card highlighted-card">
                        <strong>Construction underway</strong>
                        <span>Finishes in {formatDuration(Math.max(0, selectedFieldQueue.completeAt - game.now))}</span>
                      </div>
                    ) : null}
                    <div className="action-stack">
                      <button
                        className="primary-button"
                        onClick={() =>
                          applyGameUpdate((current) => queueFieldUpgrade(current, selectedVillage.id, selectedFieldSlot.id))
                        }
                      >
                        Upgrade field
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="inspector-art-card building-art-card">
                      <BuildingIllustration
                        kind={getBuildingArtKind(selectedCenterSlot.buildingGid)}
                        className="inspector-art"
                      />
                      <div>
                        <strong>
                          {selectedCenterSlot.buildingGid
                            ? BUILDING_METADATA[selectedCenterSlot.buildingGid].name
                            : 'Empty building lot'}
                        </strong>
                        <span>{selectedCenterSlot.buildingGid ? 'Village structure' : 'Construction site'}</span>
                      </div>
                    </div>
                    <h2>
                      {selectedCenterSlot.buildingGid
                        ? BUILDING_METADATA[selectedCenterSlot.buildingGid].name
                        : 'Empty building lot'}
                    </h2>
                    <p className="muted">
                      Slot {selectedCenterSlot.id.replace('center-', '')}
                      {selectedCenterSlot.buildingGid ? ` · level ${selectedCenterSlot.level}` : ' · ready to build'}
                    </p>
                    {selectedCenterQueue ? (
                      <div className="queue-card highlighted-card">
                        <strong>Construction underway</strong>
                        <span>Finishes in {formatDuration(Math.max(0, selectedCenterQueue.completeAt - game.now))}</span>
                      </div>
                    ) : null}
                    {selectedCenterSlot.buildingGid ? (
                      <>
                        <div className="queue-list">
                          <div className="queue-card">
                            <strong>Building</strong>
                            <span>{BUILDING_METADATA[selectedCenterSlot.buildingGid].name}</span>
                          </div>
                          <div className="queue-card">
                            <strong>Upgrade path</strong>
                            <span>
                              {selectedCenterUpgrade
                                ? `Next: level ${selectedCenterUpgrade.nextLevel} in ${formatDuration(
                                    selectedCenterUpgrade.buildTime,
                                  )}`
                                : 'No upgrade available yet'}
                            </span>
                          </div>
                        </div>
                        <div className="action-stack">
                          <button
                            className="primary-button"
                            onClick={() =>
                              applyGameUpdate((current) =>
                                queueCenterBuild(
                                  current,
                                  selectedVillage.id,
                                  selectedCenterSlot.id,
                                  selectedCenterSlot.buildingGid!,
                                ),
                              )
                            }
                          >
                            Upgrade building
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="build-choice-list">
                        {selectedCenterOptions.map((option) => (
                          <button
                            className="ghost-button build-choice"
                            key={`${selectedCenterSlot.id}-${option.gid}`}
                            onClick={() =>
                              applyGameUpdate((current) =>
                                queueCenterBuild(current, selectedVillage.id, selectedCenterSlot.id, option.gid),
                              )
                            }
                          >
                            {option.label} · {formatResourceStock(option.cost)}
                          </button>
                        ))}
                        {!selectedCenterOptions.length ? (
                          <p className="muted">No center building is unlocked for this lot yet.</p>
                        ) : null}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="panel">
                <p className="eyebrow">Village pulse</p>
                <div className="queue-list">
                  {selectedVillageOrders.slice(0, 4).map((order) => (
                    <div className="queue-card" key={order.id}>
                      <strong>{order.label}</strong>
                      <span>{order.detail}</span>
                      <span>done in {order.eta}</span>
                    </div>
                  ))}
                  {!selectedVillageOrders.length ? <p className="muted">No active build or training orders.</p> : null}
                </div>
                <p className="eyebrow section-eyebrow">Expansion & trade</p>
                <div className="queue-list">
                  <div className="queue-card">
                    <strong>Slots</strong>
                    <span>
                      {expansionStatus.usedSlots}/{expansionStatus.totalSlots} used
                    </span>
                  </div>
                  <div className="queue-card">
                    <strong>Residence / Palace</strong>
                    <span>
                      L{expansionStatus.residenceLevel} / L{expansionStatus.palaceLevel}
                    </span>
                  </div>
                  <div className="queue-card">
                    <strong>Settlers ready</strong>
                    <span>
                      {expansionStatus.readySettlers} ready, {expansionStatus.committedSettlers} committed
                    </span>
                  </div>
                  <div className="queue-card">
                    <strong>Administrators</strong>
                    <span>
                      {expansionStatus.readyCommanders} ready, {expansionStatus.committedCommanders} committed
                    </span>
                  </div>
                  <div className="queue-card">
                    <strong>Next village</strong>
                    <span>
                      {Math.floor(expansionStatus.culturePoints).toLocaleString()} /{' '}
                      {Math.ceil(expansionStatus.nextVillageRequirement).toLocaleString()} CP
                    </span>
                  </div>
                  <div className="queue-card">
                    <strong>Free expansion slots</strong>
                    <span>{expansionStatus.availableExpansionSlots.toLocaleString()} open</span>
                  </div>
                  <div className="queue-card">
                    <strong>Marketplace</strong>
                    <span>
                      {selectedMarketplace.available}/{selectedMarketplace.total} merchants free
                    </span>
                  </div>
                </div>
              </div>
            </section>
            )
          ) : null}

          {tab === 'map' ? (
            immersiveMode ? (
              renderImmersiveMap()
            ) : (
            <section className="content-grid">
              <div className="panel wide">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Strategic map</p>
                    <h2>Focus on {focusedTile ? `(${focusedTile.x}, ${focusedTile.y})` : 'unknown tile'}</h2>
                  </div>
                  <button className="secondary-button" onClick={() => setFocusedTileId(selectedVillage.tileId)}>
                    Recenter on village
                  </button>
                </div>

                <div className="map-toolbar">
                  <div className="chip-row">
                    {availableMapRadiusOptions.map((radius) => (
                      <button
                        key={radius}
                        className={`tab-button ${mapRadius === radius ? 'active' : ''}`}
                        onClick={() => setMapRadius(radius)}
                      >
                        Radius {radius}
                      </button>
                    ))}
                  </div>
                  <div className="chip-row">
                    <button className="secondary-button" onClick={() => shiftFocus(0, -1)}>
                      North
                    </button>
                    <button className="secondary-button" onClick={() => shiftFocus(-1, 0)}>
                      West
                    </button>
                    <button className="secondary-button" onClick={() => shiftFocus(1, 0)}>
                      East
                    </button>
                    <button className="secondary-button" onClick={() => shiftFocus(0, 1)}>
                      South
                    </button>
                  </div>
                </div>

                <div className="summary-strip">
                  <div>
                    <span>World tiles</span>
                    <strong>{worldOverviewTiles.length}</strong>
                  </div>
                  <div>
                    <span>Owned globally</span>
                    <strong>{worldStats.owned}</strong>
                  </div>
                  <div>
                    <span>Enemy globally</span>
                    <strong>{worldStats.enemy}</strong>
                  </div>
                  <div>
                    <span>Viewport</span>
                    <strong>{viewportTiles.length}</strong>
                  </div>
                  <div>
                    <span>Your villages</span>
                    <strong>{viewportStats.owned}</strong>
                  </div>
                  <div>
                    <span>Enemy villages</span>
                    <strong>{viewportStats.enemy}</strong>
                  </div>
                  <div>
                    <span>Open tiles</span>
                    <strong>{viewportStats.open}</strong>
                  </div>
                </div>

                <div className="map-stage-grid">
                  <section className="map-subpanel atlas-panel">
                    <div className="panel-header compact-gap">
                      <div>
                        <p className="eyebrow">World atlas</p>
                        <h2>Entire local world</h2>
                      </div>
                    </div>
                    <div className="atlas-shell">
                      <div
                        className="atlas-grid"
                        style={{ gridTemplateColumns: `repeat(${game.mapRadius * 2 + 1}, minmax(20px, 1fr))` }}
                      >
                        {worldOverviewTiles.map((tile) => {
                          const occupant = tile.villageId ? game.villages[tile.villageId] : null
                          const occupiedByHuman = occupant?.ownerId === humanPlayer.id
                          return (
                            <button
                              key={`overview-${tile.id}`}
                              className={`atlas-tile ${tileStateClass(
                                tile,
                                tile.id === focusedTile?.id,
                                occupiedByHuman,
                              )}`}
                              onClick={() => setFocusedTileId(tile.id)}
                              title={`${tile.x},${tile.y} ${occupant ? occupant.name : getTileLabel(tile)}`}
                            >
                              <span>{tile.y}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </section>

                  <section className="map-subpanel">
                    <div className="panel-header compact-gap">
                      <div>
                        <p className="eyebrow">Regional theatre</p>
                        <h2>Current front</h2>
                      </div>
                    </div>
                    <div
                      className="map-grid"
                      style={{ gridTemplateColumns: `repeat(${mapRadius * 2 + 1}, minmax(0, 1fr))` }}
                    >
                      {viewportTiles.map((tile) => {
                        const occupant = tile.villageId ? game.villages[tile.villageId] : null
                        const occupiedByHuman = occupant?.ownerId === humanPlayer.id
                        return (
                          <button
                            key={tile.id}
                            className={tileClass(tile, tile.id === focusedTile?.id, occupiedByHuman)}
                            onClick={() => setFocusedTileId(tile.id)}
                          >
                            <TileIllustration
                              kind={getTileArtKind(tile, occupiedByHuman)}
                              className="tile-art"
                            />
                            <span className="coords">
                              {tile.x},{tile.y}
                            </span>
                            <strong>{getTileLabel(tile)}</strong>
                            <small>{occupant ? occupant.name.slice(0, 10) : 'Open'}</small>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                </div>
              </div>

              <div className="panel">
                <p className="eyebrow">Tile intel</p>
                {focusedTile ? (
                  <>
                    <div className="inspector-art-card tile-art-card">
                      <TileIllustration
                        kind={getTileArtKind(focusedTile, focusedVillage?.ownerId === humanPlayer.id)}
                        className="inspector-art"
                      />
                      <div>
                        <strong>{focusedVillage ? focusedVillage.name : 'Unoccupied tile'}</strong>
                        <span>{focusedVillage ? getTileLabel(focusedTile) : 'Expansion target'}</span>
                      </div>
                    </div>
                    <h2>
                      ({focusedTile.x}, {focusedTile.y})
                    </h2>
                    <p>{RESOURCE_PATTERNS[focusedTile.patternIndex].label}</p>
                    {focusedVillageSummary ? (
                      <p className="muted">Loyalty {Math.round(focusedVillageSummary.loyalty)}%</p>
                    ) : null}
                    {focusedVillage && focusedVillage.ownerId === humanPlayer.id ? (
                      <>
                        <p className="muted">Owned by {game.players[focusedVillage.ownerId].name}</p>
                        <div className="queue-list">
                          <div className="queue-card">
                            <strong>{focusedVillage.name}</strong>
                            <span>
                              Population {focusedVillageSummary ? focusedVillageSummary.population.toLocaleString() : '0'}
                            </span>
                            <span>
                              Merchants {focusedVillageSummary ? focusedVillageSummary.merchants.available : 0}/
                              {focusedVillageSummary ? focusedVillageSummary.merchants.total : 0}
                            </span>
                          </div>
                        </div>
                        {focusedVillage.id !== selectedVillage.id ? (
                          <>
                            <div className="action-stack">
                              <button
                                className="primary-button"
                                onClick={() => {
                                  applyGameUpdate((current) => selectVillage(current, focusedVillage.id))
                                  setFocusedTileId(focusedVillage.tileId)
                                }}
                              >
                                Select this village
                              </button>
                            </div>

                            <div className="map-actions">
                              <div className="shipment-grid">
                                {RESOURCE_KEYS.map((key) => (
                                  <label key={key}>
                                    <span>
                                      {key} ({quantityLabel(selectedVillage.resources[key])})
                                    </span>
                                    <input
                                      value={
                                        shipmentDraft[getShipmentKey(selectedVillage.id, focusedVillage.id, key)] ?? '0'
                                      }
                                      onChange={(event) =>
                                        setShipmentDraft((current) => ({
                                          ...current,
                                          [getShipmentKey(selectedVillage.id, focusedVillage.id, key)]:
                                            event.target.value,
                                        }))
                                      }
                                      inputMode="numeric"
                                    />
                                  </label>
                                ))}
                              </div>
                              <div className="queue-list">
                                <div className="queue-card">
                                  <strong>Shipment</strong>
                                  <span>{quantityLabel(shipmentTotal)} total resources</span>
                                  <span>
                                    {shipmentMerchantsNeeded} / {selectedMarketplace.available} merchants needed
                                  </span>
                                </div>
                              </div>
                              {shipmentPlan && shipmentBlockers.length ? (
                                <div className="report-list">
                                  {shipmentBlockers.map((blocker) => (
                                    <article className="report-card" key={blocker}>
                                      <p>{blocker}</p>
                                    </article>
                                  ))}
                                </div>
                              ) : null}
                              <button
                                className="primary-button"
                                disabled={!shipmentPlan || shipmentBlockers.length > 0}
                                onClick={sendShipment}
                              >
                                Send resources
                              </button>
                              <button className="ghost-button" onClick={clearShipmentPlan}>
                                Clear shipment
                              </button>
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : focusedVillage ? (
                      <>
                        <p className="muted">Owned by {game.players[focusedVillage.ownerId].name}</p>
                        <div className="queue-list">
                          <div className="queue-card">
                            <strong>{focusedVillage.name}</strong>
                            <span>
                              Population {focusedVillageSummary ? focusedVillageSummary.population.toLocaleString() : '0'}
                            </span>
                            <span>
                              Defense{' '}
                              {Math.round(focusedVillageSummary ? focusedVillageSummary.military.defense : 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="map-actions">
                          <div className="dispatch-grid">
                            {selectedVillageDispatchUnits.map((entry) => (
                              <label key={entry.unit.id}>
                                <span>
                                  {entry.unit.name} ({entry.available})
                                </span>
                                <input
                                  value={dispatchUnits[getDispatchKey(selectedVillage.id, entry.unit.id)] ?? '0'}
                                  onChange={(event) =>
                                    setDispatchUnits((current) => ({
                                      ...current,
                                      [getDispatchKey(selectedVillage.id, entry.unit.id)]: event.target.value,
                                    }))
                                  }
                                  inputMode="numeric"
                                />
                              </label>
                            ))}
                          </div>
                          <div className="queue-list">
                            <div className="queue-card">
                              <strong>Selected troops</strong>
                              <span>{selectedDispatchCount.toLocaleString()} units</span>
                              <span>{selectedDispatchPower.toLocaleString()} attack</span>
                            </div>
                          </div>
                          {conquestPreview?.blockers.length ? (
                            <div className="report-list">
                              {conquestPreview.blockers.map((blocker) => (
                                <article className="report-card" key={blocker}>
                                  <p>{blocker}</p>
                                </article>
                              ))}
                            </div>
                          ) : null}
                          <button
                            className="secondary-button"
                            disabled={focusedVillage.ownerId === humanPlayer.id || selectedDispatchPower <= 0}
                            onClick={() => sendStrike('raid')}
                          >
                            Raid
                          </button>
                          <button
                            className="primary-button"
                            disabled={focusedVillage.ownerId === humanPlayer.id || selectedDispatchPower <= 0}
                            onClick={() => sendStrike('attack')}
                          >
                            Attack
                          </button>
                          <button
                            className="primary-button"
                            disabled={
                              focusedVillage.ownerId === humanPlayer.id ||
                              selectedDispatchPower <= 0 ||
                              !conquestPreview?.allowed
                            }
                            onClick={() => sendStrike('conquer')}
                          >
                            Conquer
                          </button>
                          <button
                            className="ghost-button"
                            onClick={clearDispatchPlan}
                          >
                            Clear selection
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="muted">Unoccupied terrain, ready for expansion.</p>
                        <div className="queue-list">
                          <div className="queue-card">
                            <strong>Settlers</strong>
                            <span>{expansionStatus.readySettlers} / 3 ready</span>
                          </div>
                          <div className="queue-card">
                            <strong>Expansion slots</strong>
                            <span>
                              {expansionStatus.usedSlots}/{expansionStatus.totalSlots} used
                            </span>
                          </div>
                          <div className="queue-card">
                            <strong>Culture points</strong>
                            <span>
                              {Math.floor(expansionStatus.culturePoints).toLocaleString()} /{' '}
                              {Math.ceil(expansionStatus.nextVillageRequirement).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        {settlementBlockers.length ? (
                          <div className="report-list">
                            {settlementBlockers.map((blocker) => (
                              <article className="report-card" key={blocker}>
                                <p>{blocker}</p>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="muted">
                            Settlement convoy is ready. Founding will consume 3 settlers and 750 of each resource.
                          </p>
                        )}
                        <button
                          className="primary-button"
                          disabled={settlementBlockers.length > 0}
                          onClick={sendSettlers}
                        >
                          Found a new village
                        </button>
                      </>
                    )}
                  </>
                ) : null}
              </div>
            </section>
            )
          ) : null}

          {tab === 'army' ? (
            <section className="content-grid">
              <div className="panel wide">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Standing forces</p>
                    <h2>{selectedVillage.name}</h2>
                  </div>
                </div>
                <div className="unit-grid">
                  {Object.entries(selectedVillage.units)
                    .filter(([, count]) => count > 0)
                    .map(([unitId, count]) => (
                      <article className="unit-card" key={unitId}>
                        <div className="slot-head">
                          <span>{UNIT_DEFINITIONS[unitId].name}</span>
                          <strong>{quantityLabel(count)}</strong>
                        </div>
                        <p className="muted">
                          atk {UNIT_DEFINITIONS[unitId].attack} | spd {UNIT_DEFINITIONS[unitId].speed}
                        </p>
                      </article>
                    ))}
                  {!Object.values(selectedVillage.units).some((count) => count > 0) ? (
                    <p className="muted">No troops stationed here yet.</p>
                  ) : null}
                </div>
              </div>

              <div className="panel">
                <p className="eyebrow">Recruitment</p>
                <div className="train-list">
                  {trainOptions.map((option) => (
                    <article className="train-card" key={option.unit.id}>
                      <div className="slot-head">
                        <span>{option.unit.name}</span>
                        <strong>{TRIBE_LABEL[option.unit.tribe]}</strong>
                      </div>
                      <p className="muted">
                        Cost {option.unit.cost.wood}/{option.unit.cost.clay}/{option.unit.cost.iron}/
                        {option.unit.cost.crop}
                      </p>
                      <div className="train-controls">
                        <input
                          value={trainAmounts[option.unit.id] ?? '1'}
                          onChange={(event) =>
                            setTrainAmounts((current) => ({
                              ...current,
                              [option.unit.id]: event.target.value,
                            }))
                          }
                          inputMode="numeric"
                        />
                        <button
                          className="secondary-button"
                          disabled={!option.available}
                          onClick={() =>
                            applyGameUpdate((current) =>
                              trainUnit(
                                current,
                                selectedVillage.id,
                                option.unit.id,
                                Math.max(1, Number(trainAmounts[option.unit.id] ?? 1)),
                              ),
                            )
                          }
                        >
                          Train
                        </button>
                      </div>
                      {!option.available ? <small>{option.reason}</small> : null}
                    </article>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {tab === 'reports' ? (
            <section className="content-grid">
              <div className="panel wide">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Reports</p>
                    <h2>Recent events</h2>
                  </div>
                </div>
                <div className="report-list">
                  {humanReports.map((report) => (
                    <article className="report-card" key={report.id}>
                      <div className="slot-head">
                        <span>{report.title}</span>
                        <strong>{formatWorldTime(report.createdAt)}</strong>
                      </div>
                      <p>{report.body}</p>
                    </article>
                  ))}
                  {!humanReports.length ? <p className="muted">No reports yet.</p> : null}
                </div>
              </div>

              <div className="panel">
                <p className="eyebrow">Command board</p>
                <div className="queue-list">
                  {(['incoming', 'outbound', 'returning'] as const).map((bucketKey) => (
                    <article className="queue-card" key={bucketKey}>
                      <strong>
                        {titleCase(bucketKey)} ({movementBuckets[bucketKey].length})
                      </strong>
                      {movementBuckets[bucketKey].length ? (
                        movementBuckets[bucketKey].slice(0, 4).map((entry) => (
                          <span key={entry.command.id}>
                            {entry.origin} {entry.command.phase === 'return' ? '<-' : '->'} {entry.destination} | {entry.eta}
                          </span>
                        ))
                      ) : (
                        <span className="muted">No {bucketKey} commands.</span>
                      )}
                    </article>
                  ))}
                </div>

                <p className="eyebrow section-eyebrow">Rivals</p>
                <div className="rival-list">
                  {Object.values(game.players)
                    .filter((player) => !player.isHuman)
                    .slice(0, 12)
                    .map((player) => (
                      <article className="rival-card" key={player.id}>
                        <div className="slot-head">
                          <span>{player.name}</span>
                          <strong>{TRIBE_LABEL[player.tribe]}</strong>
                        </div>
                        <p className="muted">
                          villages {player.villageIds.length} | next plan{' '}
                          {formatDuration(Math.max(0, player.nextAiPlanAt - game.now))}
                        </p>
                      </article>
                    ))}
                </div>
              </div>
            </section>
          ) : null}
        </section>
      </section>
      <input
        ref={importInputRef}
        className="hidden-input"
        type="file"
        accept="application/json,.json"
        onChange={handleImportChange}
      />
    </main>
  )
}

export default App
