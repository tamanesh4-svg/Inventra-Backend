export function productJSON(product) {
  return { id: String(product._id), name: product.name, price: product.price, stock: product.stock, seller_id: String(product.seller), is_active: product.isActive, total_sold: product.totalSold, category: product.category, created_at: product.createdAt, updated_at: product.updatedAt };
}
export function orderJSON(order) {
  return { id: String(order._id), cart_id: String(order.cart), seller_id: String(order.seller), total_amount: order.totalAmount, created_at: order.createdAt };
}
