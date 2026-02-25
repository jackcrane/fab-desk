const ACTIVE_SHOP_ID_KEY = "fabdesk.activeShopId";

export function getActiveShopId() {
  return localStorage.getItem(ACTIVE_SHOP_ID_KEY);
}

export function setActiveShopId(shopId) {
  localStorage.setItem(ACTIVE_SHOP_ID_KEY, shopId);
}

export function clearActiveShopId() {
  localStorage.removeItem(ACTIVE_SHOP_ID_KEY);
}
