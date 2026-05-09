/**
 * Passed on GET /drinks catalog calls so the API returns list-safe payloads:
 * strips long descriptions and trims embedded category rows (URLs & cards unchanged).
 */
export const CUSTOMER_DRINKS_LIST_PARAMS = Object.freeze({ lite: '1' });
