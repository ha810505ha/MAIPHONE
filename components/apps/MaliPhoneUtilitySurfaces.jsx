import React, { useState } from "react";
import { loadPhoneApp } from "../../utils/featurePreload";

const PhoneApp = React.lazy(loadPhoneApp);
const WalletSettingsApp = React.lazy(() => import("./WalletSettingsApp.jsx"));
const WalletLedgerView = React.lazy(() => import("../wallet/WalletLedgerView.jsx"));

export function MaliPhoneWalletSurface({
  characters,
  clearWalletData,
  closeApp,
  displayWalletText,
  formatMoney,
  sanitizeUserImageUrl,
  setWallet,
  showToast,
  tr,
  wallet,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (settingsOpen) {
    return (
      <WalletSettingsApp
        tr={tr}
        onBack={() => setSettingsOpen(false)}
        onClear={() => {
          if (clearWalletData()) setSettingsOpen(false);
        }}
      />
    );
  }

  return (
    <WalletLedgerView
      wallet={wallet}
      setWallet={setWallet}
      characters={characters}
      closeApp={closeApp}
      openSettings={() => setSettingsOpen(true)}
      tr={tr}
      formatMoney={formatMoney}
      displayWalletText={displayWalletText}
      sanitizeUserImageUrl={sanitizeUserImageUrl}
      showToast={showToast}
    />
  );
}

export function MaliPhonePhoneSurface({
  data,
  generation,
  navigation,
  shared,
}) {
  return (
    <PhoneApp
      {...navigation}
      {...data}
      {...generation}
      {...shared}
    />
  );
}
