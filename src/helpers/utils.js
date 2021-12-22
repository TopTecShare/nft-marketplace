export const DECIMALS = (10 ** 18);

export const ether = wei => wei / DECIMALS;

export const formatPrice = (price, precision = 100) => {

  price = ether(price);
  price = Math.round(price * precision) / precision;

  return price;
};