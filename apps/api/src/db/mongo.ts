import { MongoClient, type Db } from "mongodb"

export type Mongo = { client: MongoClient; db: Db }

/**
 * Connects to MongoDB. Gives up after 5 s instead of the driver's default 30 s,
 * so a missing database fails the boot quickly.
 */
export async function connectMongo(uri: string): Promise<Mongo> {
  const client = new MongoClient(uri, {
    appName: "shieldzk-api",
    serverSelectionTimeoutMS: 5_000,
  })
  await client.connect()
  // The database name comes from the URI path, e.g. mongodb://localhost:27017/shieldzk.
  return { client, db: client.db() }
}
