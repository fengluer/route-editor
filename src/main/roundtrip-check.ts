import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import ExcelJS from 'exceljs'
import { loadDataDir, saveDataDir } from './workbook'

function cellText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object' && value && 'richText' in value) {
    return (value as { richText: { text: string }[] }).richText.map((part) => part.text).join('')
  }
  return String(value)
}

const src = resolve('DataTable')
const out = await mkdtemp(join(tmpdir(), 'route-roundtrip-'))
await cp(src, out, { recursive: true })

const doc = await loadDataDir(src)
console.log('events', doc.events.length, 'choices', doc.choices.length, 'results', doc.results.length, 'feedback', doc.feedbackNodes.length, 'resources', doc.resources.length)
await saveDataDir(out, doc)
const again = await loadDataDir(out)

const mismatches: string[] = []
const compare = (label: string, left: unknown, right: unknown): void => {
  const a = JSON.stringify(left)
  const b = JSON.stringify(right)
  if (a !== b) mismatches.push(label)
}

compare('events', doc.events, again.events)
compare('choices', doc.choices, again.choices)
compare('results', doc.results, again.results)
compare('feedback', doc.feedbackNodes, again.feedbackNodes)
compare('resources', doc.resources, again.resources)
compare('resourceTypes', doc.resourceTypes, again.resourceTypes)
compare('routes', doc.routes, again.routes)

const files = ['walkEvent_散步事件表.xlsx', 'walkOption_散步事件选项表.xlsx', 'WalkEventResult_散步事件结果表.xlsx', 'walkFeedback_散步反馈内容表.xlsx', 'walkResource_散步场景特殊素材.xlsx']
for (const name of files) {
  const before = new ExcelJS.Workbook()
  const after = new ExcelJS.Workbook()
  await before.xlsx.readFile(join(src, name))
  await after.xlsx.readFile(join(out, name))
  if (before.worksheets.map((ws) => ws.name).join() !== after.worksheets.map((ws) => ws.name).join()) {
    mismatches.push(`${name} sheets`)
  }
  const srcSheet = before.worksheets[0]
  const dstSheet = after.worksheets[0]
  for (let row = 1; row <= 3; row++) {
    for (let col = 1; col <= Math.min(srcSheet.columnCount, 22); col++) {
      const left = cellText(srcSheet.getRow(row).getCell(col).value)
      const right = cellText(dstSheet.getRow(row).getCell(col).value)
      if (left !== right) mismatches.push(`${name} header r${row}c${col}`)
    }
  }
}
const srcResource = new ExcelJS.Workbook()
const dstResource = new ExcelJS.Workbook()
await srcResource.xlsx.readFile(join(src, 'walkResource_散步场景特殊素材.xlsx'))
await dstResource.xlsx.readFile(join(out, 'walkResource_散步场景特殊素材.xlsx'))
if ((srcResource.getWorksheet('Sheet2')?.rowCount ?? 0) !== (dstResource.getWorksheet('Sheet2')?.rowCount ?? 0)) {
  mismatches.push('resource sheet2')
}

await rm(out, { recursive: true, force: true })
if (mismatches.length) {
  console.error('MISMATCH', mismatches.slice(0, 30))
  process.exit(1)
}
console.log('ROUNDTRIP_OK')
