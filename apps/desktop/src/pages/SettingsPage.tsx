import { useState } from "react";
import type { CaptureRuntime } from "../capture/useCaptureListener.js";
import { AiCard } from "../components/settings/AiCard.js";
import { ConnectionCard } from "../components/settings/ConnectionCard.js";
import { SchedulingCard } from "../components/settings/SchedulingCard.js";
import { readDailyNewLimit, writeDailyNewLimit } from "../settings/preferences.js";
import "./SettingsPage.css";

export interface SettingsPageProps {
  capture: CaptureRuntime;
}

export function SettingsPage({ capture }: SettingsPageProps) {
  const [dailyNewLimit, setDailyNewLimit] = useState(readDailyNewLimit);

  const changeDailyNewLimit = (value: number) => {
    setDailyNewLimit(writeDailyNewLimit(value));
  };
  return (
    <div className="settings-page">
      <div className="settings-page__content">
        <header className="settings-page__header">
          <h1>Settings &amp; Pairing</h1>
        </header>
        <div className="settings-page__cards">
          <ConnectionCard capture={capture} />
          <AiCard />

          <SchedulingCard
            dailyNewLimit={dailyNewLimit}
            onChangeDailyNewLimit={changeDailyNewLimit}
          />
        </div>
      </div>
    </div>
  );
}
