import ExcelJS from 'exceljs'
import { access, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { blankChoice, blankEvent, blankFeedback, blankResource, blankResult } from '../shared/blank'
import { asEventType, asFeedbackType, cellText, joinIds, splitIds, writeCellValue } from '../shared/ids'
import type {
  Choice,
  EditorDocument,
  FeedbackNode,
  ResourceTypeInfo,
  ResultRow,
  WalkEvent,
  WalkResource,
  WalkRoute
} from '../shared/types'

export const ROUTE_FILE = 'WalkRoute_基础路线配置表.xlsx'

const DATA_START = 4

export type TableKey = 'event' | 'option' | 'result' | 'feedback' | 'resource'

const FALLBACK_NAMES: Record<TableKey, string> = {
  event: 'walkEvent_散步事件表.xlsx',
  option: 'walkOption_散步事件选项表.xlsx',
  result: 'WalkEventResult_散步事件结果表.xlsx',
  feedback: 'walkFeedback_散步反馈内容表.xlsx',
  resource: 'walkResource_散步场景特殊素材.xlsx'
}

const SHEET_NAMES: Record<TableKey, string> = {
  event: '事件表',
  option: 'Sheet1',
  result: '结果表',
  feedback: 'Sheet1',
  resource: 'Sheet1'
}

const WRITE_COLS: Record<TableKey, number> = {
  event: 14,
  option: 4,
  result: 22,
  feedback: 12,
  resource: 4
}

const TABLE_KEYS = Object.keys(FALLBACK_NAMES) as TableKey[]

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function scalar(cell: ExcelJS.Cell): string {
  return cellText(cell.value)
}

function setValue(cell: ExcelJS.Cell, raw: string): void {
  const value = writeCellValue(raw)
  cell.value = value === undefined ? null : value
}

function isId(value: string): boolean {
  return /^\d+$/.test(value)
}

async function readWorkbook(path: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path)
  return wb
}

function pickSheet(wb: ExcelJS.Workbook, preferred: string): ExcelJS.Worksheet {
  return wb.getWorksheet(preferred) ?? wb.worksheets[0]
}

function parseEvents(ws: ExcelJS.Worksheet): WalkEvent[] {
  const events: WalkEvent[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber < DATA_START) return
    const id = scalar(row.getCell(1))
    if (!isId(id)) return
    const event = blankEvent(id)
    event.location = scalar(row.getCell(2))
    event.routeSlot = scalar(row.getCell(3))
    event.unlockState = scalar(row.getCell(4))
    event.drawCondition = scalar(row.getCell(5))
    event.weight = scalar(row.getCell(6))
    event.eventType = asEventType(scalar(row.getCell(7)))
    event.title = scalar(row.getCell(8))
    event.optionIds = splitIds(row.getCell(9).value)
    event.feedbackId = scalar(row.getCell(10))
    event.resultId = scalar(row.getCell(11))
    event.mark = scalar(row.getCell(12))
    event.note = scalar(row.getCell(13))
    event.resource = scalar(row.getCell(14))
    events.push(event)
  })
  return events
}

function parseChoices(ws: ExcelJS.Worksheet): Choice[] {
  const choices: Choice[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber < DATA_START) return
    const id = scalar(row.getCell(1))
    if (!isId(id)) return
    const choice = blankChoice(id)
    choice.text = scalar(row.getCell(2))
    choice.enableCondition = scalar(row.getCell(3))
    choice.resultIds = splitIds(row.getCell(4).value)
    choices.push(choice)
  })
  return choices
}

function parseResults(ws: ExcelJS.Worksheet): ResultRow[] {
  const results: ResultRow[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber < DATA_START) return
    const id = scalar(row.getCell(1))
    if (!isId(id)) return
    const result = blankResult(id)
    result.text = scalar(row.getCell(2))
    result.condition = scalar(row.getCell(3))
    result.priority = scalar(row.getCell(4))
    result.stamina = scalar(row.getCell(5))
    result.clean = scalar(row.getCell(6))
    result.mood = scalar(row.getCell(7))
    result.coin = scalar(row.getCell(8))
    result.addPool = scalar(row.getCell(9))
    result.forceNext = scalar(row.getCell(10))
    result.dropPickup = scalar(row.getCell(11))
    result.dropPos = scalar(row.getCell(12))
    result.unlockEvent = scalar(row.getCell(13))
    result.unlockPhoto = scalar(row.getCell(14))
    result.gainItem = scalar(row.getCell(15))
    result.deductItem = scalar(row.getCell(16))
    result.teamTag = scalar(row.getCell(17))
    result.adjustWeight = scalar(row.getCell(18))
    result.resource = scalar(row.getCell(19))
    result.petAction = scalar(row.getCell(20))
    result.hideRes = scalar(row.getCell(21))
    result.petMove = scalar(row.getCell(22))
    results.push(result)
  })
  return results
}

function parseFeedback(ws: ExcelJS.Worksheet): FeedbackNode[] {
  const nodes: FeedbackNode[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber < DATA_START) return
    const id = scalar(row.getCell(1))
    const nodeId = scalar(row.getCell(4))
    if (!isId(id) || !isId(nodeId)) return
    const nextRaw = scalar(row.getCell(5))
    const nextZero = nextRaw === '0' || nextRaw === ''
    nodes.push({
      ...blankFeedback(id, scalar(row.getCell(2)), nodeId),
      parentId: scalar(row.getCell(3)) || '0',
      nextIds: nextZero ? [] : splitIds(nextRaw),
      nextZero,
      priority: scalar(row.getCell(6)),
      condition: scalar(row.getCell(7)),
      nodeType: asFeedbackType(scalar(row.getCell(8))),
      text: scalar(row.getCell(9)),
      showItem: scalar(row.getCell(10)),
      optionIds: splitIds(row.getCell(11).value),
      resultId: scalar(row.getCell(12))
    })
  })
  return nodes
}

function parseResources(ws: ExcelJS.Worksheet): WalkResource[] {
  const resources: WalkResource[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber < DATA_START) return
    const id = scalar(row.getCell(1))
    if (!isId(id)) return
    const resource = blankResource(id)
    resource.type = scalar(row.getCell(2))
    resource.filename = scalar(row.getCell(3))
    resource.filetype = scalar(row.getCell(4))
    resources.push(resource)
  })
  return resources
}

function parseResourceTypes(ws: ExcelJS.Worksheet | undefined): ResourceTypeInfo[] {
  if (!ws) return []
  const types: ResourceTypeInfo[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber < 2) return
    const id = scalar(row.getCell(1))
    if (!isId(id)) return
    types.push({
      id,
      name: scalar(row.getCell(2)),
      layer: scalar(row.getCell(3)),
      form: scalar(row.getCell(4)),
      note: scalar(row.getCell(5))
    })
  })
  return types
}

export function tableFileNames(): string[] {
  return TABLE_KEYS.map((key) => FALLBACK_NAMES[key])
}

export async function findTableFiles(dir: string): Promise<Partial<Record<TableKey, string>>> {
  const found: Partial<Record<TableKey, string>> = {}
  for (const key of TABLE_KEYS) {
    const filename = FALLBACK_NAMES[key]
    if (await fileExists(join(dir, filename))) found[key] = filename
  }
  return found
}

function parseRoutes(ws: ExcelJS.Worksheet | undefined): WalkRoute[] {
  if (!ws) return []
  const routes: WalkRoute[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber < DATA_START) return
    const id = scalar(row.getCell(1))
    if (!isId(id)) return
    routes.push({
      id,
      location: scalar(row.getCell(2)),
      count: scalar(row.getCell(3)),
      weight: scalar(row.getCell(4)),
      rhythm: scalar(row.getCell(5)),
      dropPos: scalar(row.getCell(6))
    })
  })
  return routes
}

// 基础路线表只用来对照节点，保存时不回写。
async function loadRoutes(dir: string): Promise<WalkRoute[]> {
  const path = join(dir, ROUTE_FILE)
  if (!(await fileExists(path))) return []
  const wb = await readWorkbook(path)
  return parseRoutes(wb.worksheets[0])
}

export async function loadDataDir(dir: string): Promise<EditorDocument> {
  const found = await findTableFiles(dir)
  const missing = TABLE_KEYS.filter((key) => !found[key])
  if (missing.length) {
    throw new Error(`目录缺少表格：${missing.map((key) => FALLBACK_NAMES[key]).join('、')}`)
  }
  const file = (key: TableKey): string => found[key] ?? FALLBACK_NAMES[key]
  const eventWb = await readWorkbook(join(dir, file('event')))
  const optionWb = await readWorkbook(join(dir, file('option')))
  const resultWb = await readWorkbook(join(dir, file('result')))
  const feedbackWb = await readWorkbook(join(dir, file('feedback')))
  const resourceWb = await readWorkbook(join(dir, file('resource')))
  const resourceSheet = pickSheet(resourceWb, SHEET_NAMES.resource)
  return {
    events: parseEvents(pickSheet(eventWb, SHEET_NAMES.event)),
    choices: parseChoices(pickSheet(optionWb, SHEET_NAMES.option)),
    results: parseResults(pickSheet(resultWb, SHEET_NAMES.result)),
    feedbackNodes: parseFeedback(pickSheet(feedbackWb, SHEET_NAMES.feedback)),
    resources: parseResources(resourceSheet),
    resourceTypes: parseResourceTypes(resourceWb.getWorksheet('Sheet2')),
    routes: await loadRoutes(dir)
  }
}

function writeEventRow(row: ExcelJS.Row, event: WalkEvent): void {
  setValue(row.getCell(1), event.id)
  setValue(row.getCell(2), event.location)
  setValue(row.getCell(3), event.routeSlot)
  setValue(row.getCell(4), event.unlockState)
  setValue(row.getCell(5), event.drawCondition)
  setValue(row.getCell(6), event.weight)
  setValue(row.getCell(7), String(event.eventType))
  setValue(row.getCell(8), event.title)
  setValue(row.getCell(9), joinIds(event.optionIds))
  setValue(row.getCell(10), event.feedbackId)
  setValue(row.getCell(11), event.resultId)
  setValue(row.getCell(12), event.mark)
  setValue(row.getCell(13), event.note)
  setValue(row.getCell(14), event.resource)
}

function writeChoiceRow(row: ExcelJS.Row, choice: Choice): void {
  setValue(row.getCell(1), choice.id)
  setValue(row.getCell(2), choice.text)
  setValue(row.getCell(3), choice.enableCondition)
  setValue(row.getCell(4), joinIds(choice.resultIds))
}

function writeResultRow(row: ExcelJS.Row, result: ResultRow): void {
  setValue(row.getCell(1), result.id)
  setValue(row.getCell(2), result.text)
  setValue(row.getCell(3), result.condition)
  setValue(row.getCell(4), result.priority)
  setValue(row.getCell(5), result.stamina)
  setValue(row.getCell(6), result.clean)
  setValue(row.getCell(7), result.mood)
  setValue(row.getCell(8), result.coin)
  setValue(row.getCell(9), result.addPool)
  setValue(row.getCell(10), result.forceNext)
  setValue(row.getCell(11), result.dropPickup)
  setValue(row.getCell(12), result.dropPos)
  setValue(row.getCell(13), result.unlockEvent)
  setValue(row.getCell(14), result.unlockPhoto)
  setValue(row.getCell(15), result.gainItem)
  setValue(row.getCell(16), result.deductItem)
  setValue(row.getCell(17), result.teamTag)
  setValue(row.getCell(18), result.adjustWeight)
  setValue(row.getCell(19), result.resource)
  setValue(row.getCell(20), result.petAction)
  setValue(row.getCell(21), result.hideRes)
  setValue(row.getCell(22), result.petMove)
}

function writeFeedbackRow(row: ExcelJS.Row, node: FeedbackNode): void {
  setValue(row.getCell(1), node.id)
  setValue(row.getCell(2), node.feedbackId)
  setValue(row.getCell(3), node.parentId || '0')
  setValue(row.getCell(4), node.nodeId)
  const nextValue = node.nextZero || node.nextIds.length === 0 ? '0' : joinIds(node.nextIds)
  setValue(row.getCell(5), nextValue)
  setValue(row.getCell(6), node.priority)
  setValue(row.getCell(7), node.condition)
  setValue(row.getCell(8), String(node.nodeType))
  setValue(row.getCell(9), node.text)
  setValue(row.getCell(10), node.showItem)
  setValue(row.getCell(11), joinIds(node.optionIds))
  setValue(row.getCell(12), node.resultId)
}

function writeResourceRow(row: ExcelJS.Row, resource: WalkResource): void {
  setValue(row.getCell(1), resource.id)
  setValue(row.getCell(2), resource.type)
  setValue(row.getCell(3), resource.filename)
  setValue(row.getCell(4), resource.filetype)
}

function clearOwnedCells(row: ExcelJS.Row, cols: number): void {
  for (let col = 1; col <= cols; col++) row.getCell(col).value = null
}

function replaceBody(
  ws: ExcelJS.Worksheet,
  cols: number,
  count: number,
  fill: (row: ExcelJS.Row, index: number) => void
): void {
  for (let index = 0; index < count; index++) {
    const row = ws.getRow(DATA_START + index)
    clearOwnedCells(row, cols)
    fill(row, index)
  }
  const last = ws.rowCount
  const end = count === 0 ? DATA_START - 1 : DATA_START + count - 1
  if (last > end) {
    const extra = last - end
    if (extra > 0 && extra < 8000) ws.spliceRows(end + 1, extra)
  }
}

function ensureHeaders(ws: ExcelJS.Worksheet, key: TableKey): void {
  if (scalar(ws.getRow(1).getCell(1))) return
  const headers = HEADER_ROWS[key]
  headers.forEach((values, index) => {
    ws.getRow(index + 1).values = [undefined, ...values]
  })
  ws.views = [{ state: 'frozen', ySplit: 3 }]
}

const HEADER_ROWS: Record<TableKey, string[][]> = {
  event: [
    ['eventId', 'Address', 'routePosition', 'initUnlockState', 'reqCondition', 'baseWeight', 'eventType', 'title', 'optionIds', 'feedbackId', 'resultId', 'event_category', 'beizhu', 'resource'],
    ['int', 'string', 'string', 'int', 'string', 'int', 'int', 'string', 'string', 'string', 'string', 'int', 'string', 'string'],
    ['事件ID', '地点', '路线ID:出现位置', '初始解锁状态（废弃）', '抽取条件', '初始抽取权重', '事件类型', '描述文本', '选项ID', '反馈内容ID', '结果id', '事件标记', '备注', '事件前100m展示的素材，素材id:点位(1-20)']
  ],
  option: [
    ['option_id', 'option_text', 'enable_condition', 'result_id'],
    ['int', 'string', 'string', 'int[]'],
    ['选项ID', '选项文本', '启用条件', '结果ID']
  ],
  result: [
    ['result_id', 'description', 'condition', 'priority', 'stamina_change', 'cleanliness_change', 'mood_change', 'pink_paw_coin', 'next_pool_add_event', 'force_next_event', 'drop_item', 'drop_item_pos', 'unlock_event', 'unlock_photo', 'gain_item', 'remove_pickupitem', 'add_team_tag', 'adjust_weight', 'resource', 'pet_action', 'hidde_res', 'pet_move'],
    ['int', 'string', 'string', 'string', 'int', 'int', 'int', 'int', 'string', 'int', 'int', 'string', 'int', 'int', 'int', 'string', 'string', 'string', 'string', 'string', 'int[]', 'int'],
    ['结果ID', '结果文本', '判定条件', '判定优先级', '体力结算', '清洁结算', '心情结算', '粉爪币', '下一环节抽取池增加事件', '强制下一个环节的事件', '特殊掉落拾取物', '特殊掉落拾取物坐标，多个坐标随机选一个', '永久解锁事件', '解锁照片', '获得道具', '扣除拾取物道具', '队伍增加标签', '调整事件局内权重', '展示事件后100m素材 素材id:点位(1-20)', '宠物触发动作, 动作id:秒数', '隐藏素材id。隐藏事件前/后100m的素材', '宠物垂直方向移动格子数量']
  ],
  feedback: [
    ['id', 'feedback_group_id', 'parent_id', 'node_id', 'next_node_ids', 'priority', 'condition_str', 'node_type', 'text_content', 'display_item_id', 'option_ids', 'result_id'],
    ['int', 'int', 'int', 'int', 'int[]', 'int', 'string', 'int', 'string', 'int', 'int[]', 'int'],
    ['id', '反馈内容ID', '父子节点', '节点ID', 'next节点ID', '判定优先级', '判定条件', '节点类型', '文字内容', '显示道具', '选项', '结果ID']
  ],
  resource: [
    ['id', 'type', 'filename', 'filetype'],
    ['int', 'int', 'string', 'int'],
    ['id', '素材类型', '素材资源名', '素材类型 1图片，2帧动画']
  ]
}

async function writeTable(dir: string, found: Partial<Record<TableKey, string>>, key: TableKey, count: number, fill: (row: ExcelJS.Row, index: number) => void): Promise<void> {
  const filename = found[key] ?? FALLBACK_NAMES[key]
  const path = join(dir, filename)
  let wb: ExcelJS.Workbook
  try {
    wb = await readWorkbook(path)
  } catch {
    wb = new ExcelJS.Workbook()
    wb.addWorksheet(SHEET_NAMES[key])
  }
  const ws = pickSheet(wb, SHEET_NAMES[key])
  ensureHeaders(ws, key)
  replaceBody(ws, WRITE_COLS[key], count, fill)
  const buf = await wb.xlsx.writeBuffer()
  await writeFile(path, Buffer.from(buf))
}

export async function saveDataDir(dir: string, doc: EditorDocument): Promise<void> {
  const found = await findTableFiles(dir).catch(() => ({} as Partial<Record<TableKey, string>>))
  await writeTable(dir, found, 'event', doc.events.length, (row, index) => writeEventRow(row, doc.events[index]))
  await writeTable(dir, found, 'option', doc.choices.length, (row, index) => writeChoiceRow(row, doc.choices[index]))
  await writeTable(dir, found, 'result', doc.results.length, (row, index) => writeResultRow(row, doc.results[index]))
  await writeTable(dir, found, 'feedback', doc.feedbackNodes.length, (row, index) => writeFeedbackRow(row, doc.feedbackNodes[index]))
  await writeTable(dir, found, 'resource', doc.resources.length, (row, index) => writeResourceRow(row, doc.resources[index]))
}


