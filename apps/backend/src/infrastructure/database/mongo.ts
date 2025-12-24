import { MongoClient } from 'mongodb';
import { env } from '../config/env';

const client = new MongoClient(env.MONGO_DATABASE_URL, {
  serverSelectionTimeoutMS: 5_000,
});

let connected = false;

export async function connectMongo() {
  if (connected) return;
  await client.connect();
  await client.db().command({ ping: 1 });
  connected = true;
}

export function getMongoClient() {
  return client;
}

export function getMongoDb() {
  return client.db();
}

export async function disconnectMongo() {
  if (!connected) return;
  await client.close();
  connected = false;
}

