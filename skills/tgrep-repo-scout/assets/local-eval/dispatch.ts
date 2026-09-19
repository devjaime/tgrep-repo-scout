export function dispatchOrder(registry, order) {
  const handler = registry.resolve(order.kind);
  return handler.handle(order);
}
