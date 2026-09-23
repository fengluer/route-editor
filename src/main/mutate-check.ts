import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadDataDir, saveDataDir } from './workbook'

const src = resolve('DataTable')
const out = await mkdtemp(join(tmpdir(), 'route-mutate-'))
await cp(src, out, { recursive: true })
const doc = await loadDataDir(out)
const event = doc.events.find((item) => item.id === '1')
if (!event) throw new Error('missing event 1')
event.title = 'TEST_EDIT_TITLE'
event.resource = '1:2,9'
const result = doc.results.find((item) => item.id === '1')
if (!result) throw new Error('missing result 1')
result.petMove = '2'
await saveDataDir(out, doc)
const again = await loadDataDir(out)
if (again.events.find((item) => item.id === '1')?.title !== 'TEST_EDIT_TITLE') throw new Error('title not saved')
if (again.events.find((item) => item.id === '1')?.resource !== '1:2,9') throw new Error('resource not saved')
if (again.results.find((item) => item.id === '1')?.petMove !== '2') throw new Error('pet move not saved')
if (again.resources.length !== doc.resources.length) throw new Error('resources dropped')
await rm(out, { recursive: true, force: true })
console.log('MUTATE_OK', again.events.length, again.feedbackNodes.length)
