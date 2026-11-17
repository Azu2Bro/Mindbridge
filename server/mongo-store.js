import { MongoClient } from 'mongodb'
import { createSeedData } from './seed.js'

export class MongoStore {
  constructor(uri, databaseName = process.env.MONGODB_DATABASE || 'mentalbridge') {
    this.client = new MongoClient(uri)
    this.databaseName = databaseName
    this.data = null
    this.writeQueue = Promise.resolve()
  }

  async init() {
    if (this.data) return this
    await this.client.connect()
    this.collection = this.client.db(this.databaseName).collection('application_state')
    const document = await this.collection.findOne({ _id: 'mentalbridge' })
    if (document?.payload) this.data = document.payload
    else {
      this.data = await createSeedData()
      await this.persist()
    }
    return this
  }

  snapshot() {
    return structuredClone(this.data)
  }

  async persist() {
    await this.collection.replaceOne(
      { _id: 'mentalbridge' },
      { _id: 'mentalbridge', payload: this.data, revision: 1, updatedAt: new Date() },
      { upsert: true },
    )
  }

  async findUserByEmail(email) {
    const normalized = email?.trim().toLowerCase()
    const document = await this.collection.findOne(
      { _id: 'mentalbridge' },
      { projection: { 'payload.users': 1 } },
    )
    return document?.payload?.users?.find((user) => user.email?.trim().toLowerCase() === normalized) || null
  }

  async appendAuditLog(entry) {
    await this.collection.updateOne(
      { _id: 'mentalbridge' },
      { $push: { 'payload.auditLogs': entry }, $inc: { revision: 1 }, $set: { updatedAt: new Date() } },
    )
  }

  async mutate(mutator) {
    const operation = this.writeQueue.then(async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const document = await this.collection.findOne({ _id: 'mentalbridge' })
        if (!document?.payload) throw new Error('MentalBridge database state is unavailable')
        const revision = Number(document.revision || 0)
        const nextData = structuredClone(document.payload)
        const result = await mutator(nextData)
        const revisionFilter = revision === 0
          ? { $or: [{ revision: { $exists: false } }, { revision: 0 }] }
          : { revision }
        const update = await this.collection.updateOne(
          { _id: 'mentalbridge', ...revisionFilter },
          { $set: { payload: nextData, updatedAt: new Date() }, $inc: { revision: 1 } },
        )
        if (update.matchedCount === 1) {
          this.data = nextData
          return structuredClone(result)
        }
      }
      throw new Error('MentalBridge data changed repeatedly while saving; please retry')
    })
    this.writeQueue = operation.catch(() => undefined)
    return operation
  }

  async close() {
    await this.client.close()
  }
}
