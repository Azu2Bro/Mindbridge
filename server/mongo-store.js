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
      { _id: 'mentalbridge', payload: this.data, updatedAt: new Date() },
      { upsert: true },
    )
  }

  async findUserByEmail(email) {
    const document = await this.collection.findOne(
      { _id: 'mentalbridge' },
      { projection: { 'payload.users': 1 } },
    )
    return document?.payload?.users?.find((user) => user.email === email) || null
  }

  async appendAuditLog(entry) {
    await this.collection.updateOne(
      { _id: 'mentalbridge' },
      { $push: { 'payload.auditLogs': entry } },
    )
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

  async close() {
    await this.client.close()
  }
}
