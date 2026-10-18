import React, { createContext, useContext } from "react";

// 讓商店、登入獎勵等非信風畫面也能加 Super Like，而不必把整個 useDatingApp 傳下去。
// Provider 由 MaliPhone.jsx 包住 App 區域；DATING_ENABLED 關閉時提供 no-op，呼叫端不必各自判斷旗標。
const noop = () => {};
const DEFAULT_VALUE = Object.freeze({ enabled: false, superLikes: 0, grantSuperLikes: noop });

const DatingActionsContext = createContext(DEFAULT_VALUE);

export function DatingActionsProvider({ value, children }) {
  return <DatingActionsContext.Provider value={value || DEFAULT_VALUE}>{children}</DatingActionsContext.Provider>;
}

export const useDatingActions = () => useContext(DatingActionsContext);

export default DatingActionsContext;
