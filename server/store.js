import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createSeedData } from './seed.js'

export class JsonStore {
  constructor(filePath = process.env.DATA_FILE || '.data/mentalbridge.json') {
    this.filePath = resolve(filePath)
    this.data = null
    this.writeQueue = Promise.resolve()
  }

  async init() {
    if (this.data) return this
    await mkdir(dirname(this.filePath), { recursive: true })
    try {
      this.data = JSON.parse(await readFile(this.filePath, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      this.data = await createSeedData()
      await this.persist()
    }
    return this
  }

  snapshot() {
    return structuredClone(this.data)
  }

  async persist() {
    await writeFile(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8')
  }

  async mutate(mutator) {
    const operation = this.writeQueue.then(async () => {
      const result = await mutator(this.data)
      await this.persist()
      return structuredClone(result)
    })
    this.writeQueue = operation.catch(() => undefined)
    return operation
  }
}

export const store = new JsonStore()
