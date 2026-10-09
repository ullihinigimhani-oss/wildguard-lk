export const providerBlocker = 'Offline maps require the native iPhone/Android app.';
export const readNavigation = async () => null;
export const cacheNavigation = async () => {};
export const packageStatus = async () => null;
export const readPackage = async () => null;
export const deletePackage = async () => {};
export const downloadPackage = async () => { throw new Error(providerBlocker); };
export const packagePlan = () => null;

export const navigationCacheError = () => "NATIVE_STORAGE_UNAVAILABLE";
