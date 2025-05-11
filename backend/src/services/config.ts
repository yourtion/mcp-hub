import { getAllConfig } from "../utils/config"

export let config: Awaited<ReturnType<typeof getAllConfig>>;

export async function initConfig() {
  config = await getAllConfig();
}