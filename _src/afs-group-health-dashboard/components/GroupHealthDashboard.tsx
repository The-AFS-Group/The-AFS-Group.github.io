import React from 'react';
import { Activity, Construction } from 'lucide-react';

// Group Critical Numbers are being refined at Group level (Availability / Retailer
// Inventory Fill Rate / Supplier Capacity, with Super Green → Red target bands).
// The previous per-brand KPI cards were stale, so this tab now renders a clearly
// marked placeholder until the new Group Critical Numbers are quantified and signed off.
const REFINING = [
  {
    name: 'Availability — Retailer Inventory Fill Rate',
    note: 'Super Green / Green / Orange / Red targets to be set',
  },
  {
    name: 'Supplier Capacity',
    note: 'Definition and target bands to be confirmed',
  },
];

const GroupHealthDashboard: React.FC = () => {
  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#fdece5] rounded-xl text-brand-orange">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-brand-navy">Group Health</h1>
              <p className="text-xs text-gray-500 font-medium">Group Critical Numbers</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide">
            <Construction size={14} />
            To Be Confirmed
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 text-center">
          <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-[#fdece5] text-brand-orange flex items-center justify-center">
            <Construction size={30} />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-brand-navy">Group Critical Numbers — TBA</h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto leading-relaxed">
            This section is being refined. The Group-level Critical Numbers and their
            Super Green / Green / Orange / Red target bands are being finalised and will
            appear here once quantified and signed off.
          </p>

          <div className="mt-10 text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Currently being refined</p>
            <div className="space-y-3">
              {REFINING.map((item) => (
                <div
                  key={item.name}
                  className="flex items-start justify-between gap-4 rounded-xl border border-dashed border-gray-200 bg-brand-offwhite/60 px-5 py-4"
                >
                  <div>
                    <p className="font-semibold text-brand-navy">{item.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{item.note}</p>
                  </div>
                  <span className="shrink-0 mt-0.5 text-xs font-semibold text-gray-400 bg-white border border-gray-200 rounded-md px-2.5 py-1">
                    TBC
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400 py-8">
        <p>&copy; {new Date().getFullYear()} The AFS Group. Confidential Internal Dashboard.</p>
        <p className="mt-1">Group Critical Numbers placeholder — pending refinement.</p>
      </footer>
    </div>
  );
};

export default GroupHealthDashboard;
