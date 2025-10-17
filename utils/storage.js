/* global chrome */

export const Storage = {
  async get(key, defaultValue){
    const res = await chrome.storage.sync.get([key]);
    return res[key] ?? defaultValue;
  },
  async set(key, value){
    await chrome.storage.sync.set({ [key]: value });
  }
};


