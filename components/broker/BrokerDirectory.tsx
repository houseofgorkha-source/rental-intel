"use client";

import { useMemo, useState } from "react";
import CitySelector from "@/components/CitySelector";
import AreaMultiSelect from "@/components/property/AreaMultiSelect";
import BrokerCard, { type Broker } from "./BrokerCard";
import { DEFAULT_CITY, LOCALITIES_BY_CITY, cityMatches } from "@/lib/cities";

type BrokerDirectoryProps = {
  brokers: Broker[];
};

// City + area filtering reuses CitySelector/AreaMultiSelect directly — the
// same two controls HomeSearch composes for properties (§20's "one search
// implementation" rule) — rather than a third bespoke filter widget.
// HomeSearch's own SearchBar half isn't reused here: its dropdown is
// property-name autocomplete that navigates to a property page, which has
// no equivalent meaning for a broker directory.
export default function BrokerDirectory({ brokers }: BrokerDirectoryProps) {
  const [city, setCity] = useState(DEFAULT_CITY);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  const visibleBrokers = useMemo(() => {
    return brokers.filter((broker) => {
      if (!cityMatches(broker.city, city)) return false;
      if (selectedAreas.length === 0) return true;
      return selectedAreas.some((area) =>
        broker.areas.some((brokerArea) => brokerArea.toLowerCase().includes(area.toLowerCase())),
      );
    });
  }, [brokers, city, selectedAreas]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-2xl border border-border-subtle bg-surface">
          <CitySelector value={city} onChange={setCity} />
        </div>
        <AreaMultiSelect
          areas={LOCALITIES_BY_CITY[city] ?? []}
          value={selectedAreas}
          onChange={setSelectedAreas}
        />
      </div>

      <p className="mt-4 text-sm text-muted">
        {visibleBrokers.length} {visibleBrokers.length === 1 ? "broker" : "brokers"}
      </p>

      {visibleBrokers.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center">
          <p className="font-medium text-foreground">No brokers listed here yet.</p>
          <p className="mt-2 text-sm text-muted">
            Try another locality, or be the first to list yourself.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleBrokers.map((broker) => (
            <BrokerCard key={broker.id} broker={broker} />
          ))}
        </div>
      )}
    </div>
  );
}
