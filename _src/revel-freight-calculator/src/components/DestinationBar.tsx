import type { Destination, Service } from '../lib/freight';
import { toMatrixState } from '../lib/freight';
import { zoneSpread, type PostcodeMatch } from '../lib/zones';
import { MATRIX_STATES, type MatrixState, type RateCard, type ZoneScheduleFile } from '../lib/types';
import { aud } from '../lib/format';

interface Props {
  postcode: string;
  onPostcode: (v: string) => void;
  match: PostcodeMatch | null;
  dest: Destination | null;
  locality: string;
  onLocality: (v: string) => void;
  manualZone: number | null;
  onManualZone: (z: number | null) => void;
  origin: MatrixState;
  onOrigin: (o: MatrixState) => void;
  service: Service;
  onService: (s: Service) => void;
  install: boolean;
  onInstall: (v: boolean) => void;
  card: RateCard;
  schedule: ZoneScheduleFile;
}

export default function DestinationBar(p: Props) {
  const { match, dest, card } = p;
  const digits = p.postcode.replace(/\D/g, '');
  const zone = dest ? card.zones.find((z) => z.zone === dest.zone) : null;
  const spread = match ? zoneSpread(match, p.schedule) : [];
  const interstate = dest && toMatrixState(dest.state) !== p.origin;
  const delivery = p.service === 'delivery';

  return (
    <section className="card dest" aria-label="Delivery details">
      <div className="dest-main">
      <div className="where">
        <label className="field">
          <span className="label">Delivery postcode</span>
          <input
            className="input big num"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={4}
            placeholder="2250"
            value={p.postcode}
            onChange={(e) => p.onPostcode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            autoFocus
          />
        </label>
        {match && match.localities.length > 1 && (
          <label className="field">
            <span className="label">Suburb</span>
            <select className="select" value={p.locality} onChange={(e) => p.onLocality(e.target.value)} style={{ maxWidth: 240 }}>
              {match.localities.map((l) => (
                <option key={`${l.name}|${l.state}`} value={l.name}>
                  {l.name}
                  {l.state !== match.state ? ` (${l.state})` : ''}
                  {l.deliverable ? '' : ' · PO box'}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="resolved" aria-live="polite">
        {!digits && <span className="muted">Enter a postcode to price every product for that address.</span>}
        {digits.length === 4 && !match && <span className="note err">Postcode {digits} isn't in the Australian postcode list.</span>}
        {digits && digits.length < 4 && !match && <span className="faint">Keep typing…</span>}
        {dest && (
          <>
            <span className="place">
              {dest.locality}, {dest.state}
              {delivery && (
                <span className="muted">
                  {interstate ? `Interstate from ${p.origin}` : `Same state as dispatch (${p.origin})`}
                </span>
              )}
            </span>
            {delivery ? (
              <span className="zone-row">
                <span className={`zone-badge ${dest.zoneSource === 'estimate' ? 'est' : ''}`}>
                  Zone {dest.zone || '?'}
                  {zone ? ` · +${zone.surchargePct}%` : ''}
                </span>
                <span className="small muted">
                  {zone?.label}
                  {dest.zoneSource === 'estimate' && ' · estimated from ABS remoteness'}
                  {dest.zoneSource === 'schedule' && ' · Winnings schedule'}
                  {dest.zoneSource === 'manual' && ' · set manually'}
                </span>
                <select
                  className="select"
                  style={{ height: 28, fontSize: 12 }}
                  aria-label="Override zone"
                  value={p.manualZone ?? ''}
                  onChange={(e) => p.onManualZone(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Auto zone</option>
                  {card.zones.map((z) => (
                    <option key={z.zone} value={z.zone}>
                      Zone {z.zone} (+{z.surchargePct}%)
                    </option>
                  ))}
                </select>
                {spread.length > 1 && !p.manualZone && (
                  <span className="tag warn">Suburbs in {dest.postcode} span zones {spread.join(', ')}: check the suburb</span>
                )}
              </span>
            ) : (
              <span className="small muted">Customer collects from the {p.origin} warehouse. No zone, middle-mile or fuel charges.</span>
            )}
          </>
        )}
      </div>
      </div>

      <div className="opts">
        <label className="field">
          <span className="label">Dispatch from</span>
          <select className="select" value={p.origin} onChange={(e) => p.onOrigin(e.target.value as MatrixState)}>
            {MATRIX_STATES.map((s) => (
              <option key={s} value={s}>
                {s} warehouse
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span className="label">Service</span>
          <div className="seg" role="group" aria-label="Service">
            <button aria-pressed={p.service === 'delivery'} onClick={() => p.onService('delivery')}>
              Home delivery
            </button>
            <button aria-pressed={p.service === 'collection'} onClick={() => p.onService('collection')}>
              Warehouse collection
            </button>
          </div>
        </div>
        <label className="check" style={{ height: 38, opacity: delivery ? 1 : 0.45 }} title="Install charges from the rate card">
          <input type="checkbox" checked={p.install} disabled={!delivery} onChange={(e) => p.onInstall(e.target.checked)} />
          <span>
            Add install
            <span className="faint small"> (sauna {aud(card.install.sauna)}, ice bath {aud(card.install.iceBath)})</span>
          </span>
        </label>
      </div>
    </section>
  );
}
