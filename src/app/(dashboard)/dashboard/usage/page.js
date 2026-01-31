"use client";

import { useState, Suspense } from "react";
import { UsageStats, RequestLogger, CardSkeleton, SegmentedControl } from "@/shared/components";

export default function UsagePage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        options={[
          { value: "overview", label: "Overview" },
          { value: "logs", label: "Logger" },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {/* Content */}
      {activeTab === "overview" ? (
        <Suspense fallback={<CardSkeleton />}>
          <UsageStats />
        </Suspense>
      ) : (
        <RequestLogger />
      )}
    </div>
  );
}
