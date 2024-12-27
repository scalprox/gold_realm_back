import { MongoClient } from "mongodb";

import dotenv from "dotenv";

dotenv.config();

export class mongo_client {
  private static instance: MongoClient;

  private constructor() { }

  public static async getInstance(): Promise<MongoClient> {
    if (!mongo_client.instance) {
      const uri = process.env.MONGO_DB_KEY;
      if (!uri) {
        throw new Error("MONGO_DB_KEY is not defined in the environment variables.");
      }

      mongo_client.instance = new MongoClient(uri, {});
      await mongo_client.instance.connect();
    }

    return mongo_client.instance;
  }
}
