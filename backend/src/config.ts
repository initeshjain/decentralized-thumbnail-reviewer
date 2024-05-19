export const JWT_SECRET = process.env.JWT_SECRET ?? "Nitesh123";
export const WORKER_JWT_SECRET = JWT_SECRET + "worker";
export const DEFAULT_TASK_TITLE = "Select the most clickable thumbnail";
export const TOTAL_SUBMISSIONS = 100;
export const TOTAL_DECIMALS = 1000_000;
export const PARENT_WALLET_ADDRESS = "your-wallet-public-key"; // get one from phantom wallet