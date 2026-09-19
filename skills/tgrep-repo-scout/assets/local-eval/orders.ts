import { config } from './config';
export function submitOrder(client, order) {
  return client.send(order, { timeout: config.orderTimeoutMs });
}
