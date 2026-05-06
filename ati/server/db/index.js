import Database from 'better-sqlite3'
import { readFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
// Only use DATABASE_URL if it explicitly starts with sqlite://
// Ignore postgres:// or postgresql:// set by other services in the same workspace
const raw = process.env.DATABASE_URL || ''
const DB_PATH = raw.startsWith('sqlite://')
  ? raw.replace('sqlite://', '')
  : join(__dir, '..', '..', 'ati.db')

let _db
export function getDb() {
  if (!_db) {
    // Ensure the directory exists
    const dir = DB_PATH.split('/').slice(0, -1).join('/')
    if (dir) mkdirSync(dir, { recursive: true })
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    const sql = readFileSync(join(__dir, 'schema.sql'), 'utf8')
    _db.exec(sql)
    console.log(`[db] SQLite ready at ${DB_PATH}`)
  }
  return _db
}

export default getDb
