/**
 * Store configurations for the automation agent.
 * Each store has a base URL and optional selectors (overridden in adapters).
 */

export const STORE_CONFIG: Record<
  string,
  { name: string; baseUrl: string; searchPath?: string; cartPath?: string }
> = {
  walmart: {
    name: "Walmart",
    baseUrl: "https://www.walmart.com",
    searchPath: "/search",
    cartPath: "/cart",
  },
  instacart: {
    name: "Instacart",
    baseUrl: "https://www.instacart.com",
    searchPath: "/store/search",
    cartPath: "/cart",
  },
  tesco: {
    name: "Tesco",
    baseUrl: "https://www.tesco.com",
    searchPath: "/groceries/en-GB/search",
    cartPath: "/groceries/en-GB/cart",
  },
  shufersal: {
    name: "Shufersal",
    baseUrl: "https://www.shufersal.co.il",
    searchPath: "/online/he/search",
    cartPath: "/online/he/cart/cartsummary",
  },
  tivtaam: {
    name: "Tiv Taam",
    baseUrl: "https://www.tivtaam.co.il",
    searchPath: "/search",
    cartPath: "/cart",
  },
  generic: {
    name: "Generic",
    baseUrl: "https://www.example.com",
  },
};
