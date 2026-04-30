import Redis from "ioredis";

function newRedisConnection() {
  return process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL)
    : new Redis({ host: "localhost", port: 6379 });
}

export const getOldData = new newRedisConnection();
export const publisher = new newRedisConnection();
export const subscriber = new newRedisConnection();
